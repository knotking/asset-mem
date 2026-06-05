"""Single checkpoint pipeline entry (retrieval → parallel → assemble → synthesis)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, cast

from google.adk.tools import ToolContext

from property_agent.checkpoint.analysis.assembler import (
    apply_tool_context_state_delta,
    build_initial_analysis,
    build_message_patch_from_analysis,
    ensure_analysis_run_id,
    format_checkpoints_for_analysis_blob,
    merge_branch_result,
    render_markdown,
    stash_checkpoint_analysis_in_state,
)
from property_agent.checkpoint.session_input import optional_agents_for_progress_from_state
from property_agent.shared.inputs import CheckpointOptionalAgent
from property_agent.checkpoint.analysis.synthesis_runner import (
    synthesize_checkpoint_markdown,
)
from property_agent.checkpoint.constants import CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY
from property_agent.checkpoint.retrieval.agent import ask_checkpoints_retrieval
from property_agent.checkpoint.analysis.parallel_runner import (
    BranchCompleteCallback,
    run_checkpoint_optional_agents_parallel,
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
    if checkpoint_progress_streaming_enabled():
        inv = getattr(tool_context, "_invocation_context", None)
        if inv is not None:
            # Agent Engine may use a different InvocationContext than HomecareRunner's;
            # ensure the queue lives on the context the tool actually sees.
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
    if property_address is not None:
        tool_context.state["property_address"] = property_address
    if search_location is not None:
        tool_context.state["search_location"] = search_location
    tool_context.state["user_query"] = user_query
    tool_context.state["property_id"] = property_id

    retrieval = ask_checkpoints_retrieval(
        user_query=user_query,
        property_id=property_id,
        checkpoint_ids=checkpoint_ids,
        tool_context=tool_context,
    )
    checkpoints = retrieval.get("checkpoints") if isinstance(retrieval, dict) else []
    if not checkpoints:
        summary = (
            "No matching checkpoints found for your query. "
            "Try rephrasing or check that checkpoints exist for this property."
        )
        patch = {
            "contentMarkdown": summary,
            "contentJson": None,
            "analysisRunId": run_id,
        }
        apply_tool_context_state_delta(tool_context, patch)
        return summary

    blob = format_checkpoints_for_analysis_blob(checkpoints)
    tool_context.state["checkpoint_results"] = blob
    search_query = ""
    if isinstance(retrieval, dict):
        sq = retrieval.get("search_query")
        if isinstance(sq, str):
            search_query = sq
            tool_context.state[CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY] = sq

    requested = optional_agents_for_progress_from_state(tool_context.state)
    if not requested and checkpoint_optional_agents:
        requested = [
            b for b in checkpoint_optional_agents if b in ("coverage", "diy", "service", "cost")
        ]

    resolved = resolved_turn_from_state(tool_context.state)
    retrieval_only = bool(resolved and resolved.retrieval_only)
    if retrieval_only:
        requested = []

    analysis = build_initial_analysis(
        checkpoint_results=blob,
        user_query=user_query,
        requested_branches=requested,
        property_address=property_address,
        retrieval_search_query=search_query or None,
    )
    stash_checkpoint_analysis_in_state(tool_context.state, analysis)
    initial_patch = build_message_patch_from_analysis(
        analysis, analysis_run_id=run_id
    )
    # Initial 0/N progress is emitted by ``run_checkpoint_optional_agents_parallel``
    # (``_emit_progressive_update`` at parallel start). Emitting here too duplicates
    # the first ``checkpoint_analysis_progress`` event in ADK web.
    if on_branch_complete is not None and not requested:
        from property_agent.checkpoint.analysis.assembler import (
            minimal_checkpoint_progress_session_text,
        )

        await emit_checkpoint_progress_event(
            tool_context,
            session_event_text=minimal_checkpoint_progress_session_text(
                completed_branches=[],
                pending_branches=list(requested),
                requested_branches=list(requested),
            ),
            state_delta=initial_patch,
        )
    else:
        apply_tool_context_state_delta(tool_context, initial_patch)

    if requested:
        await run_checkpoint_optional_agents_parallel(
            checkpoint_results=blob,
            user_query=user_query,
            checkpoint_optional_agents=cast(list[CheckpointOptionalAgent], requested),
            context_doc_uris=context_doc_uris,
            property_address=property_address,
            property_id=property_id,
            search_location=search_location,
            search_query=search_query or None,
            tool_context=tool_context,
            on_branch_complete=on_branch_complete,
        )
        parallel_raw = tool_context.state.get("checkpoint_parallel_results")
        parallel_results: Dict[str, str] = {}
        if isinstance(parallel_raw, str) and parallel_raw.strip():
            try:
                parsed = json.loads(parallel_raw)
                if isinstance(parsed, dict):
                    parallel_results = {str(k): str(v) for k, v in parsed.items()}
            except json.JSONDecodeError:
                pass
        analysis = merge_branch_result(
            analysis,
            checkpoint_results=blob,
            user_query=user_query,
            parallel_results=parallel_results,
            requested_branches=requested,
            completed_branches=list(requested),
            pending_branches=[],
            in_progress=False,
            property_address=property_address,
            retrieval_search_query=search_query or None,
        )
        stash_checkpoint_analysis_in_state(tool_context.state, analysis)

        markdown = await _run_synthesis_markdown(
            analysis=analysis,
            user_query=user_query,
            tool_context=tool_context,
            checkpoint_results=blob,
        )
        if hasattr(tool_context.state, "__setitem__"):
            from property_agent.checkpoint.constants import (
                CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY,
            )

            tool_context.state[CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY] = markdown
        from property_agent.checkpoint.analysis.analysis_normalize import (
            apply_analysis_title_from_markdown,
            normalize_assembled_analysis,
        )

        apply_analysis_title_from_markdown(analysis, markdown)
        normalize_assembled_analysis(
            analysis,
            property_address=property_address,
            retrieval_search_query=search_query or None,
            markdown_source=markdown,
        )
        stash_checkpoint_analysis_in_state(tool_context.state, analysis)
        final_patch = build_message_patch_from_analysis(
            analysis, analysis_run_id=run_id
        )
        final_patch["contentMarkdown"] = markdown
        if on_branch_complete is not None:
            await emit_checkpoint_progress_event(
                tool_context,
                session_event_text=markdown,
                state_delta=final_patch,
            )
        else:
            apply_tool_context_state_delta(tool_context, final_patch)
    else:
        markdown = render_markdown(analysis)
        final_patch = build_message_patch_from_analysis(
            analysis, analysis_run_id=run_id
        )
        final_patch["contentMarkdown"] = markdown
        if on_branch_complete is not None:
            await emit_checkpoint_progress_event(
                tool_context,
                session_event_text=markdown,
                state_delta=final_patch,
            )
        else:
            apply_tool_context_state_delta(tool_context, final_patch)

    record_checkpoint_ids_analyzed(tool_context.state)

    if isinstance(markdown, str) and markdown.strip():
        return markdown.strip()
    title = str(analysis.get("title") or "Checkpoint analysis")
    n = len(checkpoints)
    return f"Completed checkpoint analysis for {n} checkpoint(s): {title}."
