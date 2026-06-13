"""Single checkpoint pipeline entry (retrieval → parallel → assemble → synthesis)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from agent_platform.core.pipeline import PipelineContext, run_composite_pipeline
from google.adk.tools import ToolContext

from property_agent.checkpoint.analysis.assembler import (
    ensure_analysis_run_id,
    render_markdown,
)
from property_agent.checkpoint.analysis.parallel_runner import BranchCompleteCallback
from property_agent.checkpoint.analysis.synthesis_runner import (
    synthesize_checkpoint_markdown,
)
from property_agent.checkpoint.branch_registry import CHECKPOINT_OPTIONAL_BRANCH_SPECS
from property_agent.checkpoint.composite_hooks import CheckpointPipelineHooks
from property_agent.checkpoint.session_input import (
    normalize_checkpoint_optional_agents,
    optional_agents_for_progress_from_state,
    resolve_checkpoint_location_fields,
)
from property_agent.checkpoint.progress_stream import (
    checkpoint_progress_streaming_enabled,
    emit_checkpoint_progress_event,
    get_checkpoint_progress_queue,
    init_checkpoint_progress_queue,
)
from property_agent.checkpoint.timing import (
    begin_checkpoint_request,
    mark_synthesis_started,
    record_synthesis_ms,
)
from property_agent.checkpoint.constants import CHECKPOINT_EXPLICIT_BRANCHES_KEY
from property_agent.routing.checkpoint_selection import (
    clear_stale_checkpoint_analysis_state,
    record_checkpoint_ids_analyzed,
)
from property_agent.routing.resolve_turn import resolved_turn_from_state

logger = logging.getLogger(__name__)


async def _pipeline_branch_complete(
    branch: str,
    results: dict,
    analysis: dict,
    tool_context: ToolContext,
    *,
    session_event_text: str,
) -> None:
    """Progress hook for optional branches (streams via ``HomecareRunner``)."""
    from property_agent.checkpoint.analysis.assembler import (
        build_message_patch_from_analysis,
        ensure_analysis_run_id,
        stash_checkpoint_analysis_in_state,
    )

    run_id = ensure_analysis_run_id(tool_context.state)
    stash_checkpoint_analysis_in_state(tool_context.state, analysis)
    delta = build_message_patch_from_analysis(
        analysis,
        analysis_run_id=run_id,
        branch_completed=branch or "",
    )
    await emit_checkpoint_progress_event(
        tool_context,
        session_event_text=session_event_text,
        state_delta=delta,
    )


async def _run_synthesis_markdown(
    *,
    analysis: Dict[str, Any],
    user_query: str,
    tool_context: ToolContext,
    checkpoint_results: str,
) -> str:
    """Executive markdown via synthesis_runner; falls back to render_markdown."""
    mark_synthesis_started(tool_context.state)
    try:
        markdown = await synthesize_checkpoint_markdown(
            analysis,
            checkpoint_results=checkpoint_results,
            user_query=user_query,
        )
        record_synthesis_ms(tool_context.state)
        if isinstance(markdown, str) and markdown.strip():
            return markdown.strip()
    except Exception:
        logger.exception("checkpoint pipeline: synthesis failed; using render_markdown")
    return render_markdown(analysis)


async def run_checkpoint_pipeline(
    user_query: str,
    property_id: str,
    checkpoint_ids: Optional[List[str]] = None,
    checkpoint_optional_agents: Optional[List[str]] = None,
    context_doc_uris: Optional[List[str]] = None,
    property_address: Optional[str] = None,
    search_location: Optional[Dict[str, Any]] = None,
    tool_context: ToolContext | None = None,
) -> str:
    """
    Full checkpoint flow: vector retrieval, optional parallel branches, structured message patch.

    Returns executive markdown for the orchestrator / ADK web; Firestore fields are written
    via ``state_delta`` (contentMarkdown / contentJson).
    """
    if tool_context is None:
        return "Checkpoint pipeline requires tool context."

    begin_checkpoint_request(tool_context.state)
    clear_stale_checkpoint_analysis_state(tool_context.state)
    run_id = ensure_analysis_run_id(tool_context.state)

    if not checkpoint_ids:
        state_ids = tool_context.state.get("checkpoint_ids")
        if isinstance(state_ids, list) and state_ids:
            checkpoint_ids = [str(x) for x in state_ids if x]

    on_branch_complete: BranchCompleteCallback | None = None
    streaming = checkpoint_progress_streaming_enabled()
    if streaming:
        inv = getattr(tool_context, "_invocation_context", None)
        if inv is not None:
            init_checkpoint_progress_queue(inv)
        on_branch_complete = _pipeline_branch_complete
        if inv is not None and get_checkpoint_progress_queue(inv) is None:
            logger.warning(
                "checkpoint progress streaming enabled but progress queue missing "
                "on tool invocation_context invocation_id=%s",
                getattr(inv, "invocation_id", "") or "",
            )

    if checkpoint_optional_agents is not None:
        tool_context.state["checkpoint_optional_agents"] = checkpoint_optional_agents
    if context_doc_uris is not None:
        tool_context.state["context_doc_uris"] = context_doc_uris
    property_address, search_location = resolve_checkpoint_location_fields(
        tool_context.state,
        property_address=property_address,
        search_location=search_location,
    )
    if property_address is not None:
        tool_context.state["property_address"] = property_address
    if search_location is not None:
        tool_context.state["search_location"] = search_location
    tool_context.state["user_query"] = user_query
    tool_context.state["property_id"] = property_id

    explicit_branches = bool(tool_context.state.get(CHECKPOINT_EXPLICIT_BRANCHES_KEY))
    if explicit_branches:
        requested = normalize_checkpoint_optional_agents(
            checkpoint_optional_agents or tool_context.state.get("checkpoint_optional_agents")
        )
    else:
        requested = optional_agents_for_progress_from_state(tool_context.state)
        if not requested and checkpoint_optional_agents:
            requested = [
                b
                for b in checkpoint_optional_agents
                if b in ("coverage", "diy", "service", "cost")
            ]
        resolved = resolved_turn_from_state(tool_context.state)
        retrieval_only = bool(resolved and resolved.retrieval_only)
        if retrieval_only:
            requested = []

    hooks = CheckpointPipelineHooks(
        tool_context=tool_context,
        property_id=property_id,
        checkpoint_ids=checkpoint_ids,
        context_doc_uris=context_doc_uris,
        property_address=property_address,
        search_location=search_location,
        requested_branches=list(requested),
        refine_branch_intents=bool(requested),
        on_branch_complete=on_branch_complete,
        streaming=streaming,
    )
    ctx = PipelineContext(
        state=tool_context.state,
        user_query=user_query,
        run_id=run_id,
    )
    result = await run_composite_pipeline(
        ctx,
        hooks=hooks,
        branch_specs=CHECKPOINT_OPTIONAL_BRANCH_SPECS,
        requested_branches=requested,
    )

    record_checkpoint_ids_analyzed(tool_context.state)

    if isinstance(result.markdown, str) and result.markdown.strip():
        return result.markdown.strip()

    checkpoints = ctx.extras.get("checkpoint_blob")
    analysis_title = "Checkpoint analysis"
    if isinstance(result.payload, dict):
        analysis_title = str(result.payload.get("title") or analysis_title)
    n = int(ctx.extras.get("checkpoint_count") or 0)
    if n <= 0 and checkpoints:
        n = 1
    return f"Completed checkpoint analysis for {n} checkpoint(s): {analysis_title}."
