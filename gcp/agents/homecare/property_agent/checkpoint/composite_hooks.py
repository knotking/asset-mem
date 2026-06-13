"""Homecare CompositePipelineHooks for run_checkpoint_pipeline."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any

from agent_platform.core.pipeline.ports import PipelineContext, RetrievalResult
from google.adk.tools import ToolContext

from property_agent.checkpoint.analysis.assembler import (
    apply_tool_context_state_delta,
    build_initial_analysis,
    build_message_patch_from_analysis,
    format_checkpoints_for_analysis_blob,
    merge_branch_result,
    minimal_checkpoint_progress_session_text,
    prepend_inventory_disclosure_to_blob,
    prepend_location_disclosure_to_blob,
    prepend_temporal_disclosure_to_blob,
    render_markdown,
    stash_checkpoint_analysis_in_state,
)
from property_agent.checkpoint.analysis.parallel_runner import (
    BranchCompleteCallback,
    build_checkpoint_branch_payload,
    run_checkpoint_optional_branch,
    start_checkpoint_branch_prefetch_tasks,
)
from property_agent.checkpoint.analysis.synthesis_runner import (
    synthesize_checkpoint_markdown,
)
from property_agent.checkpoint.branch_registry import CHECKPOINT_OPTIONAL_BRANCH_SPECS
from property_agent.checkpoint.constants import (
    CHECKPOINT_INVENTORY_META_STATE_KEY,
    CHECKPOINT_LOCATION_META_STATE_KEY,
    CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY,
    CHECKPOINT_TEMPORAL_META_STATE_KEY,
)
from property_agent.checkpoint.progress_stream import emit_checkpoint_progress_event
from property_agent.checkpoint.retrieval.agent import ask_checkpoints_retrieval
from property_agent.checkpoint.timing import (
    mark_synthesis_started,
    record_parallel_ms,
    record_synthesis_ms,
)

logger = logging.getLogger(__name__)

_PARALLEL_KEY_BY_BRANCH: dict[str, str] = {
    spec.branch_id: spec.parallel_result_key for spec in CHECKPOINT_OPTIONAL_BRANCH_SPECS
}


def empty_retrieval_message(retrieval: dict[str, Any] | None) -> str:
    temporal_meta = (
        retrieval.get("temporal_meta") if isinstance(retrieval, dict) else None
    )
    location_meta = (
        retrieval.get("location_meta") if isinstance(retrieval, dict) else None
    )
    label = (
        str(temporal_meta.get("label") or "").strip()
        if isinstance(temporal_meta, dict)
        else ""
    )
    requested_location = (
        str(location_meta.get("requested") or "").strip()
        if isinstance(location_meta, dict)
        else ""
    )
    if label:
        return f"No checkpoints were captured during {label} (UTC) for this property."
    if requested_location:
        return (
            f"No checkpoints were captured for {requested_location} "
            "on this property."
        )
    return (
        "No matching checkpoints found for your query. "
        "Try rephrasing or check that checkpoints exist for this property."
    )


@dataclass
class CheckpointPipelineHooks:
    """Maps homecare checkpoint analysis onto ``run_composite_pipeline``."""

    tool_context: ToolContext
    property_id: str
    checkpoint_ids: list[str] | None
    context_doc_uris: list[str] | None
    property_address: str | None
    search_location: dict[str, Any] | None
    requested_branches: list[str]
    refine_branch_intents: bool
    on_branch_complete: BranchCompleteCallback | None = None
    streaming: bool = False
    _parallel_start: float = field(default=0.0, repr=False)

    async def retrieve(self, ctx: PipelineContext) -> RetrievalResult:
        retrieval = ask_checkpoints_retrieval(
            user_query=ctx.user_query,
            property_id=self.property_id,
            checkpoint_ids=self.checkpoint_ids,
            tool_context=self.tool_context,
            refine_branch_intents=self.refine_branch_intents,
        )
        if not isinstance(retrieval, dict):
            return RetrievalResult(items=(), empty_message=empty_retrieval_message(None))

        for key, state_key in (
            ("inventory_meta", CHECKPOINT_INVENTORY_META_STATE_KEY),
            ("temporal_meta", CHECKPOINT_TEMPORAL_META_STATE_KEY),
            ("location_meta", CHECKPOINT_LOCATION_META_STATE_KEY),
        ):
            meta = retrieval.get(key)
            if isinstance(meta, dict):
                self.tool_context.state[state_key] = meta

        checkpoints = retrieval.get("checkpoints")
        if not isinstance(checkpoints, list) or not checkpoints:
            return RetrievalResult(
                items=(),
                empty_message=empty_retrieval_message(retrieval),
                metadata=retrieval,
            )
        return RetrievalResult(
            items=tuple(checkpoints),
            metadata=retrieval,
        )

    def build_initial_payload(
        self,
        ctx: PipelineContext,
        retrieval: RetrievalResult,
    ) -> dict[str, Any]:
        checkpoints = list(retrieval.items)
        metadata = dict(retrieval.metadata or {})
        inventory_meta = metadata.get("inventory_meta")
        temporal_meta = metadata.get("temporal_meta")
        location_meta = metadata.get("location_meta")

        blob = format_checkpoints_for_analysis_blob(checkpoints)
        blob = prepend_inventory_disclosure_to_blob(
            blob, inventory_meta if isinstance(inventory_meta, dict) else None
        )
        blob = prepend_temporal_disclosure_to_blob(
            blob, temporal_meta if isinstance(temporal_meta, dict) else None
        )
        blob = prepend_location_disclosure_to_blob(
            blob, location_meta if isinstance(location_meta, dict) else None
        )
        self.tool_context.state["checkpoint_results"] = blob
        ctx.extras["checkpoint_blob"] = blob

        search_query = ""
        sq = metadata.get("search_query")
        if isinstance(sq, str):
            search_query = sq
            self.tool_context.state[CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY] = sq
        ctx.extras["search_query"] = search_query

        requested = list(self.requested_branches)
        ctx.extras["requested_branches"] = requested
        ctx.extras["completed_branches"] = []
        ctx.extras["pending_branches"] = list(requested)
        ctx.extras["parallel_results"] = {
            spec.parallel_result_key: "SKIPPED"
            for spec in CHECKPOINT_OPTIONAL_BRANCH_SPECS
        }
        ctx.extras["emit_phase"] = "initial"

        if requested:
            self.tool_context.state["_checkpoint_pipeline_requested"] = list(requested)
            self.tool_context.state["_checkpoint_pipeline_completed"] = []
            self.tool_context.state["_checkpoint_pipeline_pending"] = list(requested)

        analysis = build_initial_analysis(
            checkpoint_results=blob,
            user_query=ctx.user_query,
            requested_branches=requested,
            property_address=self.property_address,
            retrieval_search_query=search_query or None,
            inventory_meta=inventory_meta if isinstance(inventory_meta, dict) else None,
        )
        stash_checkpoint_analysis_in_state(self.tool_context.state, analysis)

        branch_payload = build_checkpoint_branch_payload(
            self.tool_context,
            checkpoint_results=blob,
            user_query=ctx.user_query,
            requested_branches=requested,
            search_query=search_query or None,
            context_doc_uris=self.context_doc_uris,
            property_address=self.property_address,
            property_id=self.property_id,
            search_location=self.search_location,
        )
        ctx.extras["branch_payload"] = branch_payload
        start_checkpoint_branch_prefetch_tasks(
            branch_payload,
            requested,
            ctx.extras,
        )
        import time

        self._parallel_start = time.monotonic()
        ctx.extras["checkpoint_count"] = len(checkpoints)
        return analysis

    async def run_branch(
        self,
        ctx: PipelineContext,
        branch_id: str,
        *,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        branch_payload = ctx.extras.get("branch_payload")
        if not isinstance(branch_payload, dict):
            branch_payload = {}
        value = await run_checkpoint_optional_branch(
            branch_id,
            branch_payload,
            self.tool_context,
            prefetch_tasks=ctx.extras,
        )
        return {"result": value}

    def merge_branch(
        self,
        ctx: PipelineContext,
        payload: dict[str, Any],
        branch_id: str,
        branch_result: dict[str, Any],
    ) -> dict[str, Any]:
        parallel_key = _PARALLEL_KEY_BY_BRANCH.get(branch_id)
        parallel_results = ctx.extras.get("parallel_results")
        if not isinstance(parallel_results, dict) or not parallel_key:
            return payload

        raw = branch_result.get("result", "SKIPPED")
        parallel_results[parallel_key] = str(raw) if raw is not None else "SKIPPED"
        self.tool_context.state["checkpoint_parallel_results"] = json.dumps(
            parallel_results, ensure_ascii=False
        )

        completed = ctx.extras.setdefault("completed_branches", [])
        if branch_id not in completed:
            completed.append(branch_id)
        pending = [
            b
            for b in ctx.extras.get("requested_branches", [])
            if b not in completed
        ]
        ctx.extras["pending_branches"] = pending
        ctx.extras["last_branch_completed"] = branch_id
        ctx.extras["emit_phase"] = "branch"

        self.tool_context.state["_checkpoint_pipeline_completed"] = list(completed)
        self.tool_context.state["_checkpoint_pipeline_pending"] = list(pending)

        from property_agent.checkpoint.constants import (
            CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY,
        )

        pa = self.property_address
        stem = str(ctx.extras.get("search_query") or "").strip() or None
        md = str(self.tool_context.state.get(CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY) or "").strip()

        analysis = merge_branch_result(
            payload,
            checkpoint_results=str(ctx.extras.get("checkpoint_blob") or ""),
            user_query=ctx.user_query,
            parallel_results=parallel_results,
            requested_branches=ctx.extras.get("requested_branches", []),
            completed_branches=list(completed),
            pending_branches=list(pending),
            in_progress=bool(pending),
            property_address=pa,
            retrieval_search_query=stem,
            markdown_source=md,
        )
        stash_checkpoint_analysis_in_state(self.tool_context.state, analysis)
        return analysis

    def branch_progress_text(
        self,
        ctx: PipelineContext,
        branch_id: str,
        *,
        payload: dict[str, Any],
    ) -> str:
        completed = list(ctx.extras.get("completed_branches", []))
        pending = list(ctx.extras.get("pending_branches", []))
        requested = list(ctx.extras.get("requested_branches", []))
        return minimal_checkpoint_progress_session_text(
            completed_branches=completed,
            pending_branches=pending,
            requested_branches=requested,
        )

    async def synthesize_markdown(
        self,
        ctx: PipelineContext,
        payload: dict[str, Any],
    ) -> str:
        import time

        if self._parallel_start:
            record_parallel_ms(
                self.tool_context.state,
                int((time.monotonic() - self._parallel_start) * 1000),
            )

        from property_agent.checkpoint.analysis.assembler import (
            checkpoint_synthesis_progress_session_text,
            set_synthesis_analysis_status,
        )

        mark_synthesis_started(self.tool_context.state)
        analysis_running = set_synthesis_analysis_status(payload, phase="running")
        stash_checkpoint_analysis_in_state(self.tool_context.state, analysis_running)
        ctx.extras["emit_phase"] = "synthesis_started"
        synthesis_patch = self.build_state_delta_patch(
            ctx,
            analysis_running,
            markdown=checkpoint_synthesis_progress_session_text(),
        )
        await self.emit_patch(
            ctx,
            synthesis_patch,
            progress_text=checkpoint_synthesis_progress_session_text(),
        )

        blob = str(ctx.extras.get("checkpoint_blob") or "")
        mark_synthesis_started(self.tool_context.state)
        try:
            markdown = await synthesize_checkpoint_markdown(
                analysis_running,
                checkpoint_results=blob,
                user_query=ctx.user_query,
            )
            record_synthesis_ms(self.tool_context.state)
            if isinstance(markdown, str) and markdown.strip():
                markdown = markdown.strip()
            else:
                markdown = render_markdown(analysis_running)
        except Exception:
            logger.exception(
                "checkpoint pipeline: synthesis failed; using render_markdown"
            )
            markdown = render_markdown(analysis_running)

        from property_agent.checkpoint.analysis.analysis_normalize import (
            apply_analysis_title_from_markdown,
            normalize_assembled_analysis,
        )
        from property_agent.checkpoint.constants import (
            CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY,
        )

        if hasattr(self.tool_context.state, "__setitem__"):
            self.tool_context.state[CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY] = markdown
        apply_analysis_title_from_markdown(analysis_running, markdown)
        normalize_assembled_analysis(
            analysis_running,
            property_address=self.property_address,
            retrieval_search_query=str(ctx.extras.get("search_query") or "") or None,
            markdown_source=markdown,
        )
        analysis_completed = set_synthesis_analysis_status(
            analysis_running, phase="completed"
        )
        stash_checkpoint_analysis_in_state(
            self.tool_context.state, analysis_completed
        )
        ctx.extras["final_analysis"] = analysis_completed
        return markdown

    def render_markdown(self, ctx: PipelineContext, payload: dict[str, Any]) -> str:
        return render_markdown(payload)

    def build_state_delta_patch(
        self,
        ctx: PipelineContext,
        payload: dict[str, Any],
        *,
        markdown: str,
    ) -> dict[str, Any]:
        if not payload:
            return {
                "contentMarkdown": markdown,
                "contentJson": None,
                "analysisRunId": ctx.run_id,
            }
        analysis = ctx.extras.get("final_analysis", payload)
        if not isinstance(analysis, dict):
            analysis = payload
        branch_completed = str(ctx.extras.get("last_branch_completed") or "")
        patch = build_message_patch_from_analysis(
            analysis,
            analysis_run_id=ctx.run_id,
            branch_completed=branch_completed,
        )
        patch["contentMarkdown"] = markdown
        return patch

    async def emit_patch(
        self,
        ctx: PipelineContext,
        patch: dict[str, Any],
        *,
        progress_text: str,
    ) -> None:
        phase = ctx.extras.get("emit_phase", "")
        requested = list(ctx.extras.get("requested_branches", []))

        if phase == "initial" and self.streaming and requested:
            await emit_checkpoint_progress_event(
                self.tool_context,
                session_event_text=minimal_checkpoint_progress_session_text(
                    completed_branches=[],
                    pending_branches=requested,
                    requested_branches=requested,
                ),
                state_delta=patch,
            )
            return

        if phase == "synthesis_started" and not self.streaming:
            apply_tool_context_state_delta(self.tool_context, patch)
            return

        if self.streaming and self.on_branch_complete is not None:
            await emit_checkpoint_progress_event(
                self.tool_context,
                session_event_text=progress_text,
                state_delta=patch,
            )
            return

        apply_tool_context_state_delta(self.tool_context, patch)
