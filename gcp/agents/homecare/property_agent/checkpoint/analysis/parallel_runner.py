"""Parallel execution of checkpoint optional analysis branches."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional, Protocol, Sequence, Tuple

from agent_framework.execution.thread_context import to_thread

from google.adk.agents import Agent
from google.adk.tools import ToolContext
from google.adk.tools.agent_tool import AgentTool

from agent_framework.execution import run_orchestrated_branches
from agent_framework.registry.orchestration import build_execution_plan

from property_agent.checkpoint.branch_registry import (
    CHECKPOINT_OPTIONAL_BRANCH_SPECS,
    _VALID_OPTIONAL_BRANCH_IDS,
)

from property_agent.shared.inputs import CheckpointOptionalAgent
from property_agent.geo.search_location_utils import search_location_from_payload
from property_agent.checkpoint.analysis.assembler import (
    apply_tool_context_state_delta,
    build_initial_analysis,
    build_message_patch_from_analysis,
    ensure_analysis_run_id,
    merge_branch_result,
    minimal_checkpoint_progress_session_text,
    stash_checkpoint_analysis_in_state,
)
from property_agent.checkpoint.constants import (
    CHECKPOINT_BRANCH_SEARCH_INTENTS_KEY,
    CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY,
)
from property_agent.checkpoint.grounding_prefetch import (
    CHECKPOINT_GROUNDING_SUMMARY_KEY,
    grounding_summary_from_payload,
    prefetch_checkpoint_web_context,
    should_prefetch_checkpoint_grounding,
)
from property_agent.checkpoint.timing import (
    mark_synthesis_started,
    record_diy_ms,
    record_parallel_ms,
)
from property_agent.agents.coverage_agent.agent import coverage_agent
from property_agent.agents.diy_agent.agent import diy_agent
from property_agent.agents.diy_agent.orchestrator import run_diy_pipeline
from property_agent.agents.service_agent.agent import service_agent
from property_agent.checkpoint.analysis.service_providers import (
    apply_prefetched_serp_to_branch_result,
    prefetch_service_maps_providers,
    seed_service_branch_tool_state,
)
from property_agent.checkpoint.branch_search_intents import BranchSearchIntents
from property_agent.agents.cost_agent.agent import _cost_estimation_sync, cost_agent
from .search_query import (
    optional_branch_search_user_query,
    resolve_effective_search_query,
    resolve_optional_branch_user_query,
    resolve_service_branch_user_query,
)

# Branches that consume shared checkpoint web summary (await same prefetch task).
_GROUNDING_CONSUMER_BRANCHES = frozenset({"diy", "cost"})

logger = logging.getLogger(__name__)


def _branch_intents_from_state(state: Any) -> Optional[BranchSearchIntents]:
    if not hasattr(state, "get"):
        return None
    raw = state.get(CHECKPOINT_BRANCH_SEARCH_INTENTS_KEY)
    return BranchSearchIntents.from_dict(raw)


def _analysis_merge_context_from_state(state: Any) -> tuple[Optional[str], Optional[str], str]:
    """property_address, retrieval stem, markdown for merge/normalize."""
    if not hasattr(state, "get"):
        return None, None, ""
    pa = str(state.get("property_address") or "").strip() or None
    stem = str(state.get(CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY) or "").strip() or None
    from property_agent.checkpoint.constants import (
        CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY,
    )

    md = str(state.get(CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY) or "").strip()
    return pa, stem, md


class BranchCompleteCallback(Protocol):
    async def __call__(
        self,
        branch: str,
        results: Dict[str, str],
        analysis: Dict[str, Any],
        tool_context: ToolContext,
        *,
        session_event_text: str,
    ) -> None: ...


def _normalize_agent_result(result: Any) -> str:
    if result is None:
        return "SKIPPED"
    if isinstance(result, str):
        return result
    try:
        return json.dumps(result, ensure_ascii=False)
    except Exception:
        return str(result)


_BRANCH_AGENT_IMPLS: Dict[str, Agent] = {
    "coverage": coverage_agent,
    "diy": diy_agent,
    "service": service_agent,
    "cost": cost_agent,
}


def _branch_agents() -> Dict[str, Tuple[Agent, str]]:
    """Branch id → (agent, parallel_result_key) from registry orchestration metadata."""
    return {
        spec.branch_id: (
            _BRANCH_AGENT_IMPLS[spec.branch_id],
            spec.parallel_result_key,
        )
        for spec in CHECKPOINT_OPTIONAL_BRANCH_SPECS
    }


def checkpoint_optional_execution_waves(
    requested: List[str],
) -> tuple[tuple[str, ...], ...]:
    """Execution waves for ``requested`` branches (registry-derived plan)."""
    requested_specs = [
        spec
        for spec in CHECKPOINT_OPTIONAL_BRANCH_SPECS
        if spec.branch_id in requested
    ]
    return tuple(
        wave.branch_ids for wave in build_execution_plan(requested_specs)
    )


async def _run_checkpoint_diy_pipeline(payload: Dict[str, Any]) -> str:
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
    sl = search_location_from_payload(payload)
    prefetched_web = grounding_summary_from_payload(payload) or None
    intents_raw = payload.get("checkpoint_branch_search_intents")
    branch_intents = BranchSearchIntents.from_dict(intents_raw)
    return await run_diy_pipeline(
        diagnosis,
        property_address=(payload.get("property_address") or "").strip() or None,
        search_location=sl,
        context_doc_uris=uris,
        checkpoint_retrieval_search_query=seed or None,
        prefetched_web_summary=prefetched_web,
        branch_search_intents=branch_intents,
    )


def _checkpoint_cost_diagnosis(payload: Dict[str, Any]) -> str:
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
    from property_agent.geo.search_location_utils import market_label

    diagnosis = _checkpoint_cost_diagnosis(payload)
    body: Dict[str, Any] = {"diagnosis": diagnosis}
    sl = search_location_from_payload(payload)
    pa = (payload.get("property_address") or "").strip() or None
    label = market_label(sl, property_address=pa)
    if label:
        body["market_location"] = label
    if pa:
        body["property_address"] = pa
    if sl is not None:
        body["search_location"] = sl.model_dump()
    web_summary = grounding_summary_from_payload(payload)
    if web_summary:
        body["grounding_web_summary"] = web_summary
    return json.dumps(body, ensure_ascii=False)


async def _run_checkpoint_cost_pipeline(payload: Dict[str, Any]) -> str:
    query = _build_checkpoint_cost_query(payload)
    return await to_thread(_cost_estimation_sync, query)


async def _invoke_optional_agent_async(
    agent: Agent, payload: Dict[str, Any], tool_context: ToolContext
) -> Any:
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
            result = await _run_checkpoint_diy_pipeline(payload)
        elif name == "cost":
            result = await _run_checkpoint_cost_pipeline(payload)
        else:
            branch_agent, _ = _branch_agents()[name]
            result = await _invoke_optional_agent_async(
                branch_agent, payload, tool_context
            )
        return _normalize_agent_result(result)
    except Exception as exc:
        branch_failed = True
        logger.exception("checkpoint optional branch failed: %s", name)
        if name == "service":
            err = str(exc).strip().replace("\n", " ")[:400]
            return f"SKIPPED:{err}" if err else "SKIPPED"
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
    requested: Sequence[str],
    completed: List[str],
    pending: List[str],
    tool_context: ToolContext,
    on_branch_complete: Optional[BranchCompleteCallback],
    analysis: Dict[str, Any],
    run_id: str,
) -> Dict[str, Any]:
    pa, stem, md = _analysis_merge_context_from_state(tool_context.state)
    analysis = merge_branch_result(
        analysis,
        checkpoint_results=checkpoint_results,
        user_query=user_query,
        parallel_results=results,
        requested_branches=requested,
        completed_branches=completed,
        pending_branches=pending,
        in_progress=bool(pending),
        property_address=pa,
        retrieval_search_query=stem,
        markdown_source=md,
    )
    session_event_text = minimal_checkpoint_progress_session_text(
        completed_branches=completed,
        pending_branches=pending,
        requested_branches=requested,
    )
    if on_branch_complete is not None:
        await on_branch_complete(
            branch,
            results,
            analysis,
            tool_context,
            session_event_text=session_event_text,
        )
    else:
        stash_checkpoint_analysis_in_state(tool_context.state, analysis)
        apply_tool_context_state_delta(
            tool_context,
            build_message_patch_from_analysis(
                analysis,
                analysis_run_id=run_id,
                branch_completed=branch or "",
            ),
        )
    return analysis


async def run_checkpoint_optional_agents_parallel(
    checkpoint_results: str,
    user_query: str,
    checkpoint_optional_agents: List[CheckpointOptionalAgent],
    context_doc_uris: Optional[List[str]] = None,
    property_address: Optional[str] = None,
    property_id: Optional[str] = None,
    search_location: Optional[Dict[str, Any]] = None,
    search_query: Optional[str] = None,
    tool_context: ToolContext | None = None,
    on_branch_complete: Optional[BranchCompleteCallback] = None,
) -> str:
    total_start = time.monotonic()
    if (
        tool_context
        and hasattr(tool_context, "_invocation_context")
        and hasattr(tool_context._invocation_context, "session")
    ):
        tool_context.state["user_id"] = tool_context._invocation_context.session.user_id

    results: Dict[str, str] = {
        spec.parallel_result_key: "SKIPPED"
        for spec in CHECKPOINT_OPTIONAL_BRANCH_SPECS
    }

    requested = [
        n for n in (checkpoint_optional_agents or []) if n in _VALID_OPTIONAL_BRANCH_IDS
    ]
    if not requested:
        return _serialize_and_store_parallel_results(tool_context, results)

    if tool_context is None:
        return json.dumps(results, ensure_ascii=False)

    run_id = ensure_analysis_run_id(tool_context.state)
    tool_context.state["_checkpoint_pipeline_requested"] = list(requested)
    tool_context.state["_checkpoint_pipeline_completed"] = []
    tool_context.state["_checkpoint_pipeline_pending"] = list(requested)

    search_query = resolve_effective_search_query(search_query, tool_context)
    query_mode = "branch_issue_search"
    from property_agent.routing.resolve_turn import resolved_turn_from_state

    resolved = resolved_turn_from_state(tool_context.state)
    if resolved is not None and resolved.query_mode:
        query_mode = resolved.query_mode
    branch_user_query = resolve_optional_branch_user_query(
        turn_query=user_query,
        search_query=search_query or None,
        checkpoint_results=checkpoint_results,
        query_mode=query_mode,
        max_chars=400,
    )
    service_user_query = resolve_service_branch_user_query(
        turn_query=user_query,
        search_query=search_query or None,
        checkpoint_results=checkpoint_results,
        query_mode=query_mode,
        max_chars=400,
    )

    branch_intents = _branch_intents_from_state(tool_context.state)

    payload: Dict[str, Any] = {
        "user_query": branch_user_query,
        "checkpoint_results": checkpoint_results,
        "checkpoint_retrieval_search_query": search_query,
        "context_doc_uris": context_doc_uris,
        "property_address": property_address,
        "property_id": property_id,
        "search_location": search_location,
    }
    if branch_intents is not None:
        payload["checkpoint_branch_search_intents"] = branch_intents.to_dict()
        if branch_intents.service_trade_query:
            payload["checkpoint_service_trade_query"] = (
                branch_intents.service_trade_query
            )

    completed: List[str] = []
    pending: List[str] = list(requested)
    analysis = build_initial_analysis(
        checkpoint_results=checkpoint_results,
        user_query=user_query,
        requested_branches=requested,
    )
    stash_checkpoint_analysis_in_state(tool_context.state, analysis)

    await _emit_progressive_update(
        branch="",
        results=results,
        checkpoint_results=checkpoint_results,
        user_query=user_query,
        requested=requested,
        completed=[],
        pending=list(requested),
        tool_context=tool_context,
        on_branch_complete=on_branch_complete,
        analysis=analysis,
        run_id=run_id,
    )

    prefetch_task: Optional[asyncio.Task[str]] = None
    if should_prefetch_checkpoint_grounding(requested):
        prefetch_task = asyncio.create_task(
            to_thread(prefetch_checkpoint_web_context, payload)
        )
        logger.info(
            "checkpoint grounding prefetch: started in parallel with optional branches"
        )

    async def _payload_with_grounding_summary(
        branch_payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        if prefetch_task is None:
            return branch_payload
        if grounding_summary_from_payload(branch_payload):
            return branch_payload
        try:
            summary = await prefetch_task
        except Exception:
            logger.exception("checkpoint grounding prefetch task failed")
            return branch_payload
        if summary:
            return {
                **branch_payload,
                CHECKPOINT_GROUNDING_SUMMARY_KEY: summary,
            }
        return branch_payload

    async def _run_named_branch(name: str) -> Tuple[str, str]:
        branch_payload = payload
        prefetched_serp: List[Dict[str, Any]] = []
        if name == "service":
            service_payload = {**payload, "user_query": service_user_query}
            trade_q = (payload.get("checkpoint_service_trade_query") or "").strip()
            if trade_q:
                service_payload["checkpoint_service_trade_query"] = trade_q
            prefetched_serp = await to_thread(
                prefetch_service_maps_providers, service_payload
            )
            if prefetched_serp:
                service_payload["checkpoint_prefetched_serp_providers"] = prefetched_serp
            seed_service_branch_tool_state(
                tool_context, service_payload, prefetched=prefetched_serp
            )
            branch_payload = service_payload
        if name in _GROUNDING_CONSUMER_BRANCHES:
            branch_payload = await _payload_with_grounding_summary(branch_payload)
        value = await _run_single_optional_agent_async(
            name, branch_payload, tool_context
        )
        if name == "service" and prefetched_serp:
            value = apply_prefetched_serp_to_branch_result(value, prefetched_serp)
        return name, value

    async def _on_branch_complete(name: str, pair: tuple[str, str]) -> None:
        nonlocal analysis, completed, pending
        branch_name, value = pair
        _, key = _branch_agents()[branch_name]
        results[key] = value
        if branch_name in pending:
            pending.remove(branch_name)
        completed.append(branch_name)
        tool_context.state["_checkpoint_pipeline_completed"] = completed
        tool_context.state["_checkpoint_pipeline_pending"] = pending
        _serialize_and_store_parallel_results(tool_context, results)
        analysis = await _emit_progressive_update(
            branch=branch_name,
            results=results,
            checkpoint_results=checkpoint_results,
            user_query=user_query,
            requested=requested,
            completed=list(completed),
            pending=list(pending),
            tool_context=tool_context,
            on_branch_complete=on_branch_complete,
            analysis=analysis,
            run_id=run_id,
        )

    await run_orchestrated_branches(
        CHECKPOINT_OPTIONAL_BRANCH_SPECS,
        requested,
        _run_named_branch,
        on_result=_on_branch_complete,
    )

    parallel_ms = int((time.monotonic() - total_start) * 1000)
    record_parallel_ms(tool_context.state, parallel_ms)
    mark_synthesis_started(tool_context.state)
    return _serialize_and_store_parallel_results(tool_context, results)
