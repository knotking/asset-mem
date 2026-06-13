"""Parallel execution of checkpoint optional analysis branches."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional, Protocol, Tuple

from agent_platform.core.execution.thread_context import to_thread

from google.adk.agents import Agent
from google.adk.tools import ToolContext
from google.adk.tools.agent_tool import AgentTool

from agent_platform.core.registry.orchestration import build_execution_plan

from property_agent.checkpoint.branch_registry import (
    CHECKPOINT_OPTIONAL_BRANCH_SPECS,
)

from property_agent.shared.inputs import CheckpointOptionalAgent
from property_agent.geo.search_location_utils import search_location_from_payload
from property_agent.checkpoint.constants import (
    CHECKPOINT_BRANCH_SEARCH_INTENTS_KEY,
)
from property_agent.checkpoint.grounding_prefetch import (
    CHECKPOINT_GROUNDING_SUMMARY_KEY,
    CHECKPOINT_PRICING_GROUNDING_SUMMARY_KEY,
    checkpoint_cost_diagnosis,
    grounding_summary_from_payload,
    prefetch_checkpoint_pricing_context,
    prefetch_checkpoint_web_context,
    pricing_grounding_summary_from_payload,
    should_prefetch_cost_pricing_grounding,
    should_prefetch_diy_grounding,
)
from property_agent.checkpoint.timing import (
    record_diy_ms,
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
from property_agent.checkpoint.session_input import resolve_checkpoint_location_fields
from property_agent.agents.cost_agent.agent import _cost_estimation_sync, cost_agent
from .search_query import (
    resolve_effective_search_query,
    resolve_optional_branch_user_query,
    resolve_service_branch_user_query,
)

logger = logging.getLogger(__name__)


def _branch_intents_from_state(state: Any) -> Optional[BranchSearchIntents]:
    if not hasattr(state, "get"):
        return None
    raw = state.get(CHECKPOINT_BRANCH_SEARCH_INTENTS_KEY)
    return BranchSearchIntents.from_dict(raw)


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


def _build_checkpoint_cost_query(payload: Dict[str, Any]) -> str:
    from property_agent.geo.search_location_utils import market_label

    diagnosis = checkpoint_cost_diagnosis(payload)
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
    web_summary = pricing_grounding_summary_from_payload(payload)
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



async def _payload_with_prefetch_summary(
    branch_payload: Dict[str, Any],
    *,
    prefetch_task: Optional[asyncio.Task[str]],
    payload_key: str,
    existing_summary: str,
    log_label: str,
) -> Dict[str, Any]:
    if prefetch_task is None:
        return branch_payload
    if existing_summary:
        return branch_payload
    try:
        summary = await prefetch_task
    except Exception:
        logger.exception("checkpoint %s prefetch task failed", log_label)
        return branch_payload
    if summary:
        return {**branch_payload, payload_key: summary}
    return branch_payload


def build_checkpoint_branch_payload(
    tool_context: ToolContext,
    *,
    checkpoint_results: str,
    user_query: str,
    requested_branches: List[str],
    search_query: Optional[str] = None,
    context_doc_uris: Optional[List[str]] = None,
    property_address: Optional[str] = None,
    property_id: Optional[str] = None,
    search_location: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Shared branch agent payload for composite hooks and parallel_runner."""
    if (
        hasattr(tool_context, "_invocation_context")
        and hasattr(tool_context._invocation_context, "session")
    ):
        tool_context.state["user_id"] = tool_context._invocation_context.session.user_id

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
    property_address, search_location = resolve_checkpoint_location_fields(
        tool_context.state,
        property_address=property_address,
        search_location=search_location,
    )
    payload: Dict[str, Any] = {
        "user_query": branch_user_query,
        "service_user_query": service_user_query,
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
    return payload


def start_checkpoint_branch_prefetch_tasks(
    payload: Dict[str, Any],
    requested: List[str],
    extras: Dict[str, Any],
) -> None:
    """Start DIY / cost prefetch tasks; store asyncio tasks in ``extras``."""
    if should_prefetch_diy_grounding(requested):
        extras["diy_prefetch_task"] = asyncio.create_task(
            to_thread(prefetch_checkpoint_web_context, payload)
        )
        logger.info(
            "checkpoint DIY grounding prefetch: started in parallel with optional branches"
        )
    if should_prefetch_cost_pricing_grounding(requested):
        extras["pricing_prefetch_task"] = asyncio.create_task(
            to_thread(prefetch_checkpoint_pricing_context, payload)
        )
        logger.info(
            "checkpoint cost pricing prefetch: started in parallel with optional branches"
        )


async def run_checkpoint_optional_branch(
    branch_id: str,
    payload: Dict[str, Any],
    tool_context: ToolContext,
    *,
    prefetch_tasks: Dict[str, Any],
) -> str:
    """Run one optional checkpoint branch (coverage, diy, service, cost)."""
    branch_payload = payload
    prefetched_serp: List[Dict[str, Any]] = []
    if branch_id == "service":
        service_payload = {
            **payload,
            "user_query": (payload.get("service_user_query") or payload.get("user_query") or ""),
        }
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
    if branch_id == "diy":
        diy_task = prefetch_tasks.get("diy_prefetch_task")
        branch_payload = await _payload_with_prefetch_summary(
            branch_payload,
            prefetch_task=diy_task if isinstance(diy_task, asyncio.Task) else None,
            payload_key=CHECKPOINT_GROUNDING_SUMMARY_KEY,
            existing_summary=grounding_summary_from_payload(branch_payload),
            log_label="DIY grounding",
        )
    elif branch_id == "cost":
        pricing_task = prefetch_tasks.get("pricing_prefetch_task")
        branch_payload = await _payload_with_prefetch_summary(
            branch_payload,
            prefetch_task=pricing_task if isinstance(pricing_task, asyncio.Task) else None,
            payload_key=CHECKPOINT_PRICING_GROUNDING_SUMMARY_KEY,
            existing_summary=pricing_grounding_summary_from_payload(branch_payload),
            log_label="cost pricing",
        )
    value = await _run_single_optional_agent_async(
        branch_id, branch_payload, tool_context
    )
    if branch_id == "service" and prefetched_serp:
        value = apply_prefetched_serp_to_branch_result(value, prefetched_serp)
    return value


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
    """Deprecated alias — branches run via ``CheckpointPipelineHooks``."""
    from property_agent.checkpoint.composite_hooks import run_checkpoint_optional_branches

    return await run_checkpoint_optional_branches(
        checkpoint_results=checkpoint_results,
        user_query=user_query,
        checkpoint_optional_agents=list(checkpoint_optional_agents or []),
        context_doc_uris=context_doc_uris,
        property_address=property_address,
        property_id=property_id,
        search_location=search_location,
        search_query=search_query,
        tool_context=tool_context,
        on_branch_complete=on_branch_complete,
    )
