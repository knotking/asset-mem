"""Parallel execution of checkpoint optional analysis branches."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, AsyncGenerator, Awaitable, Callable, Dict, List, Optional, Tuple

from google.adk.agents import Agent, BaseAgent
from google.adk.agents.context import Context
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events.event import Event
from google.adk.tools import ToolContext
from google.adk.tools.agent_tool import AgentTool
from typing_extensions import override

from ...agent_inputs import CheckpointOptionalAgent
from ...search_location_utils import legacy_search_location_from_payload
from ..checkpoint_dual_format_guard import (
    CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY,
    CHECKPOINT_BRANCH_COMPLETED_STATE_KEY,
    CHECKPOINT_PROGRESS_EVENT_AUTHOR,
    bump_checkpoint_progress_emit_seq,
    build_phase0_checkpoint_dual_format,
    build_progressive_checkpoint_dual_format,
    stash_checkpoint_dual_format_in_state,
)
from ..checkpoint_request_timing import mark_synthesis_started, record_diy_ms, record_parallel_ms
from ..coverage_agent.agent import coverage_agent
from ..diy_agent.agent import diy_agent
from ..diy_agent.orchestrator import run_diy_pipeline
from ..service_agent.agent import service_agent
from ..service_agent.orchestrator import run_service_pipeline_from_payload
from ..cost_agent.agent import _cost_estimation_sync, cost_agent
from .input_schema import CheckpointAnalysisInput
from .legacy_parse import _parse_checkpoint_analysis_input
from .search_query import (
    optional_branch_search_user_query,
    resolve_branch_search_user_query,
    resolve_effective_search_query,
    _stash_retrieval_search_query,
)

logger = logging.getLogger(__name__)


def _agent_attr(name: str):
    """Resolve callables on ``agent`` so tests can monkeypatch ``caa.<name>``."""
    from . import agent as _agent

    return getattr(_agent, name)


BranchCompleteCallback = Callable[
    [str, Dict[str, str], str, ToolContext], Awaitable[None]
]

async def execute_checkpoint_optional_parallel(
    ctx: InvocationContext,
    *,
    on_branch_complete: Optional[BranchCompleteCallback] = None,
) -> Context:
    """Run optional branches in Python (no LLM). Returns context with session state updates."""
    tool_ctx = _agent_attr("Context")(invocation_context=ctx)
    inp = _parse_checkpoint_analysis_input(ctx)
    run_parallel = _agent_attr("run_checkpoint_optional_agents_parallel")
    if inp is None:
        await run_parallel(
            checkpoint_results="",
            user_query="",
            checkpoint_optional_agents=[],
            tool_context=tool_ctx,
            on_branch_complete=on_branch_complete,
        )
        return tool_ctx

    _stash_retrieval_search_query(tool_ctx, inp)
    await run_parallel(
        checkpoint_results=inp.checkpoint_results,
        user_query=inp.user_query,
        checkpoint_optional_agents=inp.checkpoint_optional_agents,
        context_doc_uris=inp.context_doc_uris,
        property_address=inp.property_address,
        property_id=inp.property_id,
        search_location=inp.search_location,
        search_query=inp.search_query,
        tool_context=tool_ctx,
        on_branch_complete=on_branch_complete,
    )
    return tool_ctx


class CheckpointOptionalParallelAgent(BaseAgent):
    """Python-only parallel runner (replaces the prior LLM tool-caller hop)."""

    @override
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        from google.genai import types
        from google.adk.events.event import EventActions

        progress_queue: asyncio.Queue[Optional[Event]] = asyncio.Queue()
        tool_ctx_holder: List[Optional[ToolContext]] = [None]

        async def on_branch_complete(
            branch: str,
            results: Dict[str, str],
            body: str,
            tool_context: ToolContext,
        ) -> None:
            stash_checkpoint_dual_format_in_state(tool_context.state, body)
            if hasattr(tool_context.state, "__setitem__"):
                tool_context.state[CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY] = body
                bump_checkpoint_progress_emit_seq(tool_context.state)
            delta: Dict[str, Any] = {
                "checkpoint_parallel_results": json.dumps(
                    results, ensure_ascii=False
                ),
            }
            if branch:
                delta[CHECKPOINT_BRANCH_COMPLETED_STATE_KEY] = branch
            await progress_queue.put(
                Event(
                    invocation_id=ctx.invocation_id,
                    author=CHECKPOINT_PROGRESS_EVENT_AUTHOR,
                    branch=ctx.branch,
                    content=types.Content(
                        role="model", parts=[types.Part(text=body)]
                    ),
                    actions=EventActions(state_delta=delta),
                )
            )

        async def run_parallel() -> None:
            tool_ctx_holder[0] = await execute_checkpoint_optional_parallel(
                ctx, on_branch_complete=on_branch_complete
            )
            await progress_queue.put(None)

        runner_task = asyncio.create_task(run_parallel())
        try:
            while True:
                ev = await progress_queue.get()
                if ev is None:
                    break
                yield ev
        finally:
            await runner_task

        tool_ctx = tool_ctx_holder[0]
        if tool_ctx is not None and tool_ctx.state.has_delta():
            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                branch=ctx.branch,
                actions=tool_ctx.actions,
            )


def _normalize_agent_result(result: Any) -> str:
    if result is None:
        return "SKIPPED"
    if isinstance(result, str):
        return result
    try:
        return json.dumps(result, ensure_ascii=False)
    except Exception:
        return str(result)


_BRANCH_AGENTS: Dict[str, Tuple[Agent, str]] = {
    "coverage": (coverage_agent, "checkpoint_parallel_coverage_result"),
    "diy": (diy_agent, "checkpoint_parallel_diy_result"),
    "service": (service_agent, "checkpoint_parallel_service_result"),
    "cost": (cost_agent, "checkpoint_parallel_cost_result"),
}


async def _run_checkpoint_diy_pipeline(payload: Dict[str, Any]) -> str:
    """Call the DIY orchestrator directly so parallel state is JSON (videos/products), not LLM prose."""
    branch_q = (payload.get("user_query") or "").strip()
    ck = (payload.get("checkpoint_results") or "").strip()
    if ck and branch_q:
        diagnosis = f"{branch_q}\n\nCheckpoint context:\n{ck[:6000]}"
    elif ck:
        diagnosis = ck[:8000]
    else:
        diagnosis = branch_q or "Property maintenance"
    uris = payload.get("context_doc_uris")
    seed = (payload.get("checkpoint_retrieval_search_query") or "").strip()
    sl = legacy_search_location_from_payload(payload)
    return await run_diy_pipeline(
        diagnosis,
        property_address=(payload.get("property_address") or "").strip() or None,
        search_location=sl,
        context_doc_uris=uris,
        checkpoint_retrieval_search_query=seed or None,
    )


def _checkpoint_cost_diagnosis(payload: Dict[str, Any]) -> str:
    """Diagnosis for checkpoint cost tools: retrieval seed, else branch query, else compact blob."""
    seed = (payload.get("checkpoint_retrieval_search_query") or "").strip()
    if seed:
        return seed
    branch_q = (payload.get("user_query") or "").strip()
    if branch_q:
        return branch_q
    ck = (payload.get("checkpoint_results") or "").strip()
    if ck:
        return optional_branch_search_user_query(ck)
    return "Property maintenance"


def _build_checkpoint_cost_query(payload: Dict[str, Any]) -> str:
    """JSON query for cost tools: diagnosis + market location from search_location."""
    from ...search_location_utils import market_label

    diagnosis = _checkpoint_cost_diagnosis(payload)
    body: Dict[str, Any] = {"diagnosis": diagnosis}
    sl = legacy_search_location_from_payload(payload)
    pa = (payload.get("property_address") or "").strip() or None
    label = market_label(sl, property_address=pa)
    if label:
        body["market_location"] = label
    if pa:
        body["property_address"] = pa
    if sl is not None:
        body["search_location"] = sl.model_dump()
    return json.dumps(body, ensure_ascii=False)


async def _run_checkpoint_cost_pipeline(payload: Dict[str, Any]) -> str:
    """Run full cost estimation in a worker thread (no cost_agent LLM), mirroring the DIY direct path."""
    query = _build_checkpoint_cost_query(payload)
    return await asyncio.to_thread(_agent_attr("_cost_estimation_sync"), query)


async def _invoke_optional_agent_async(
    agent: Agent, payload: Dict[str, Any], tool_context: ToolContext
) -> Any:
    """Drive a sub-agent through AgentTool on the caller's event loop.

    AgentTool wires the child Runner up to live async objects on
    tool_context._invocation_context (credential_service, plugin_manager,
    ForwardingArtifactService). Those are pinned to the parent event loop,
    so we MUST stay on the same loop instead of dispatching to threads +
    asyncio.run() — that would attach those objects to a fresh loop and
    fail with cross-loop RuntimeErrors mid-stream.

    skip_summarization=True: default AgentTool summarization drops structured
    payloads (e.g. DIY JSON with youtubeSearch / recommendedProducts); the
    synthesis step needs the raw branch tool output.
    """
    agent_tool = AgentTool(agent, skip_summarization=True)
    return await agent_tool.run_async(args=payload, tool_context=tool_context)


async def _run_single_optional_agent_async(
    name: str,
    payload: Dict[str, Any],
    tool_context: ToolContext,
) -> str:
    branch_start = time.monotonic()
    branch_failed = False
    try:
        if name == "diy":
            result = await _agent_attr("_run_checkpoint_diy_pipeline")(payload)
        elif name == "cost":
            result = await _agent_attr("_run_checkpoint_cost_pipeline")(payload)
        elif name == "service":
            result = await asyncio.to_thread(run_service_pipeline_from_payload, payload)
        else:
            branch_agent, _ = _BRANCH_AGENTS[name]
            result = await _agent_attr("_invoke_optional_agent_async")(
                branch_agent, payload, tool_context
            )
        return _normalize_agent_result(result)
    except Exception:
        branch_failed = True
        logger.exception("checkpoint optional branch failed: %s", name)
        return "SKIPPED"
    finally:
        branch_ms = int((time.monotonic() - branch_start) * 1000)
        if name == "diy" and tool_context is not None:
            record_diy_ms(tool_context.state, branch_ms)
        logger.info(
            "checkpoint optional branch timing: branch=%s duration_ms=%d failed=%s",
            name,
            branch_ms,
            branch_failed,
        )


def _serialize_and_store_parallel_results(
    tool_context: Optional[ToolContext], results: Dict[str, str]
) -> str:
    """Canonical JSON for optional branches; always persist to session when context exists."""
    out = json.dumps(results, ensure_ascii=False)
    if tool_context is not None:
        tool_context.state["checkpoint_parallel_results"] = out
    return out


async def _emit_progressive_update(
    *,
    branch: str,
    results: Dict[str, str],
    checkpoint_results: str,
    user_query: str,
    requested: List[str],
    completed: List[str],
    pending: List[str],
    tool_context: ToolContext,
    on_branch_complete: Optional[BranchCompleteCallback],
) -> None:
    body = build_progressive_checkpoint_dual_format(
        checkpoint_results=checkpoint_results,
        user_query=user_query,
        parallel_results=results,
        requested_branches=requested,
        completed_branches=completed,
        pending_branches=pending,
        in_progress=bool(pending),
    )
    if on_branch_complete is not None:
        await on_branch_complete(branch, results, body, tool_context)


async def run_checkpoint_optional_agents_parallel(
    checkpoint_results: str,
    user_query: str,
    checkpoint_optional_agents: List[CheckpointOptionalAgent],
    context_doc_uris: Optional[List[str]] = None,
    property_address: Optional[str] = None,
    property_id: Optional[str] = None,
    search_location: Optional[Dict[str, Any]] = None,
    search_query: Optional[str] = None,
    tool_context: ToolContext = None,
    on_branch_complete: Optional[BranchCompleteCallback] = None,
) -> str:
    """Run requested optional agents concurrently on the active event loop."""
    total_start = time.monotonic()
    if tool_context and hasattr(tool_context, "_invocation_context") and hasattr(tool_context._invocation_context, "session"):
        tool_context.state["user_id"] = tool_context._invocation_context.session.user_id

    results: Dict[str, str] = {
        "checkpoint_parallel_coverage_result": "SKIPPED",
        "checkpoint_parallel_diy_result": "SKIPPED",
        "checkpoint_parallel_service_result": "SKIPPED",
        "checkpoint_parallel_cost_result": "SKIPPED",
    }

    requested = [n for n in (checkpoint_optional_agents or []) if n in _BRANCH_AGENTS]
    if not requested:
        logger.info(
            "checkpoint optional parallel: skip duration_ms=%d reason=no_valid_branches",
            int((time.monotonic() - total_start) * 1000),
        )
        return _serialize_and_store_parallel_results(tool_context, results)

    if tool_context is None:
        logger.error(
            "run_checkpoint_optional_agents_parallel missing tool_context; skipping optional branches"
        )
        return json.dumps(results, ensure_ascii=False)

    search_query = resolve_effective_search_query(search_query, tool_context)
    branch_user_query = resolve_branch_search_user_query(
        search_query or None, checkpoint_results, max_chars=400
    )
    logger.info(
        "checkpoint optional parallel: start branches=%s checkpoint_blob_len=%d "
        "retrieval_search_query_len=%d branch_user_query_len=%d",
        sorted(set(requested)),
        len(checkpoint_results or ""),
        len(search_query),
        len(branch_user_query),
    )
    if not search_query and len(branch_user_query) + 40 < len(
        checkpoint_results or ""
    ):
        logger.debug(
            "checkpoint optional branches: derived from checkpoint_results only query_len=%d checkpoint_results_len=%d",
            len(branch_user_query),
            len(checkpoint_results or ""),
        )

    payload: Dict[str, Any] = {
        # Passed to coverage/diy/service/cost as DocsInput.user_query; DIY YouTube/shopping use
        # ``checkpoint_retrieval_search_query`` as the API query stem when set (orchestrator adds DIY tails).
        "user_query": branch_user_query,
        "checkpoint_results": checkpoint_results,
        "checkpoint_retrieval_search_query": search_query,
        "context_doc_uris": context_doc_uris,
        "property_address": property_address,
        "property_id": property_id,
        "search_location": search_location,
    }

    completed: List[str] = []
    pending: List[str] = list(requested)
    phase0 = build_phase0_checkpoint_dual_format(
        checkpoint_results=checkpoint_results,
        user_query=user_query,
        requested_branches=requested,
    )
    if on_branch_complete is not None:
        await on_branch_complete("", results, phase0, tool_context)
    else:
        stash_checkpoint_dual_format_in_state(tool_context.state, phase0)

    async def _run_named_branch(name: str) -> Tuple[str, str]:
        value = await _agent_attr("_run_single_optional_agent_async")(
            name, payload, tool_context
        )
        return name, value

    branch_tasks = {
        asyncio.create_task(_run_named_branch(name)): name for name in requested
    }
    for finished in asyncio.as_completed(branch_tasks.keys()):
        name, value = await finished
        _, key = _BRANCH_AGENTS[name]
        results[key] = value
        if name in pending:
            pending.remove(name)
        completed.append(name)
        _serialize_and_store_parallel_results(tool_context, results)
        await _emit_progressive_update(
            branch=name,
            results=results,
            checkpoint_results=checkpoint_results,
            user_query=user_query,
            requested=requested,
            completed=list(completed),
            pending=list(pending),
            tool_context=tool_context,
            on_branch_complete=on_branch_complete,
        )

    parallel_ms = int((time.monotonic() - total_start) * 1000)
    if tool_context is not None:
        record_parallel_ms(tool_context.state, parallel_ms)
        mark_synthesis_started(tool_context.state)
    logger.info(
        "checkpoint optional parallel: done requested=%s wall_ms=%d branch_user_query_len=%d",
        sorted(set(requested)),
        parallel_ms,
        len(branch_user_query),
    )
    return _serialize_and_store_parallel_results(tool_context, results)


