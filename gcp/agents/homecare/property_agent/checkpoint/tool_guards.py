"""Tool-boundary invariants for checkpoint executor tools (Phase 3).

Enforced in ``before_tool`` for chip, accept-offer, and single-loop routing paths.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Mapping, Optional

from property_agent.checkpoint.constants import (
    CHECKPOINT_ANALYSIS_TOOL,
    CHECKPOINT_EXPLICIT_BRANCHES_KEY,
)
from property_agent.checkpoint.executor_tools import CHECKPOINT_ROUTING_TOOLS
from property_agent.checkpoint.session_input import (
    apply_session_checkpoint_ids_to_tool_args,
    apply_session_location_to_tool_args,
    normalize_checkpoint_optional_agents,
    sync_checkpoint_tool_args_to_state,
)
from property_agent.routing.constants import REPORT_MODE_CHECKPOINT_PIPELINE_BLOCKED
from property_agent.routing.conversational_intent import (
    prior_checkpoint_analysis_in_session,
    resolve_explicit_optional_branches,
    resolve_user_query_from_state,
)
from property_agent.routing.pending_user_action import get_pending_user_action
from property_agent.routing.property_analysis_routing import (
    filter_optional_branches_for_orchestrator,
)
from property_agent.routing.query_mode.branch_analysis import (
    branches_mentioned_in_query,
    prior_analysis_branches_completed,
    query_requests_fresh_external_data,
)
from property_agent.routing.resolve_turn import resolved_turn_from_state

logger = logging.getLogger(__name__)

__all__ = [
    "block_checkpoint_tools_in_report_mode",
    "prepare_analyze_checkpoints_tool",
    "prepare_list_checkpoints_tool",
    "seed_client_decided_branches",
    "strip_dangling_pending_offer_branches",
    "user_requested_branches",
]


def user_requested_branches(
    user_query: str,
    state: Mapping[str, Any] | None,
) -> frozenset[str]:
    """Branches the user explicitly referenced this turn (text, chip, or accept_offer)."""
    requested: set[str] = set()
    for branch in resolve_explicit_optional_branches(user_query, state) or []:
        requested.add(branch)
    for branch in branches_mentioned_in_query(user_query):
        requested.add(branch)

    resolved = resolved_turn_from_state(state)
    if resolved is not None:
        if resolved.resolve_source == "chip":
            requested.update(resolved.run_optional_agents or [])
        if resolved.discourse_act == "accept_offer":
            requested.update(resolved.run_optional_agents or [])
            pending = get_pending_user_action(state)
            if pending is not None:
                requested.update(pending.run_optional_agents or [])
    return frozenset(requested)


def seed_client_decided_branches(
    branches: list[str],
    state: Mapping[str, Any] | None,
) -> list[str]:
    """Union branches the client decided deterministically into the tool args.

    Guards only *filter* the executor's ``branches`` arg; without this, a chip
    tap ("run cost") or accepted offer would depend on the executor LLM copying
    ``run_optional_agents`` from session state. UI optional toggles are seeded for their first run only — repeat
    turns with a sticky toggle fall back to the idempotency guard's cached
    answer instead of re-running.
    """
    resolved = resolved_turn_from_state(state)
    if resolved is None or not resolved.run_optional_agents:
        return branches
    decided = normalize_checkpoint_optional_agents(list(resolved.run_optional_agents))
    if not decided:
        return branches
    if resolved.resolve_source == "chip" or resolved.discourse_act == "accept_offer":
        merged = list(dict.fromkeys([*branches, *decided]))
    elif resolved.resolve_source == "single_loop":
        completed = prior_analysis_branches_completed(state)
        merged = list(
            dict.fromkeys([*branches, *(b for b in decided if b not in completed)])
        )
    else:
        return branches
    if merged != branches:
        logger.info(
            "tool_guards: seeded client-decided branches %r -> %r source=%s",
            branches,
            merged,
            resolved.resolve_source,
        )
    return merged


def strip_dangling_pending_offer_branches(
    branches: list[str],
    *,
    user_query: str,
    state: Mapping[str, Any] | None,
) -> list[str]:
    """Drop branches that appear only in a dangling assistant offer, not in user text."""
    if not branches:
        return []
    pending = get_pending_user_action(state)
    if pending is None or not pending.run_optional_agents:
        return list(dict.fromkeys(branches))

    user_requested = user_requested_branches(user_query, state)
    pending_only = frozenset(pending.run_optional_agents)
    kept = [
        b
        for b in branches
        if b in user_requested or b not in pending_only
    ]
    if kept != branches:
        logger.info(
            "tool_guards: pending-offer filter %r -> %r query=%r",
            branches,
            kept,
            (user_query or "")[:80],
        )
    return list(dict.fromkeys(kept))


def _filter_branches_idempotent(
    branches: list[str],
    *,
    user_query: str,
    state: Mapping[str, Any] | None,
) -> list[str]:
    if not branches:
        return []
    completed = prior_analysis_branches_completed(state)
    fresh = query_requests_fresh_external_data(user_query)
    requested = user_requested_branches(user_query, state)
    explicit_pick = bool(set(branches) & requested) or bool(
        resolve_explicit_optional_branches(user_query, state)
    )
    return filter_optional_branches_for_orchestrator(
        branches,
        branches_completed=completed,
        explicit_pick=explicit_pick,
        fresh_external=fresh,
    )


def maybe_short_circuit_completed_branches(
    original_branches: list[str],
    filtered_branches: list[str],
    *,
    user_query: str,
    state: Mapping[str, Any] | None,
) -> Optional[dict]:
    """When idempotency removed all branches, skip re-run and use session cache."""
    if not original_branches or filtered_branches:
        return None
    if query_requests_fresh_external_data(user_query):
        return None
    if not prior_checkpoint_analysis_in_session(state):
        return None
    completed = prior_analysis_branches_completed(state)
    if not set(original_branches).issubset(completed):
        return None
    logger.info(
        "tool_guards: idempotent skip branches %r (already completed)",
        original_branches,
    )
    return {
        "result": (
            "Skipped: optional branch analysis already completed this session. "
            "Answer from prior analysis in session history."
        )
    }


def block_checkpoint_tools_in_report_mode(
    tool_name: str,
    state: Mapping[str, Any] | None,
    *,
    user_query: str = "",
) -> Optional[dict]:
    """Report route must not invoke checkpoint analysis tools."""
    if tool_name != CHECKPOINT_ANALYSIS_TOOL:
        return None
    resolved = resolved_turn_from_state(state)
    if resolved is None or resolved.route != "report":
        return None
    uq = user_query or resolve_user_query_from_state(state)
    logger.info(
        "tool_guards: blocked %s (report mode) query=%r",
        tool_name,
        (uq or "")[:80],
    )
    return {"result": REPORT_MODE_CHECKPOINT_PIPELINE_BLOCKED}


def prepare_list_checkpoints_tool(
    state: Any,
    args: Dict[str, Any],
) -> None:
    """Sync session checkpoint ids for list tool (UI selection only)."""
    apply_session_checkpoint_ids_to_tool_args(state, args)
    sync_checkpoint_tool_args_to_state(state, args)


def prepare_analyze_checkpoints_tool(
    state: Any,
    args: Dict[str, Any],
    *,
    user_query: str = "",
) -> Optional[dict]:
    """Apply branch + idempotency + pending-offer guards; sync session fields.

    Returns a short-circuit tool result dict when idempotency skips a duplicate run.
    """
    if not isinstance(args, dict):
        return None

    uq = user_query or resolve_user_query_from_state(state) or str(
        args.get("user_query") or ""
    )
    branches = normalize_checkpoint_optional_agents(args.get("branches") or [])
    branches = seed_client_decided_branches(branches, state)
    branches = strip_dangling_pending_offer_branches(
        branches, user_query=uq, state=state
    )
    pre_idempotent = list(branches)
    branches = _filter_branches_idempotent(branches, user_query=uq, state=state)
    branches = list(dict.fromkeys(branches))

    short = maybe_short_circuit_completed_branches(
        pre_idempotent, branches, user_query=uq, state=state
    )
    if short is not None:
        return short

    if state is not None and hasattr(state, "__setitem__"):
        state[CHECKPOINT_EXPLICIT_BRANCHES_KEY] = True
        state["checkpoint_optional_agents"] = branches
    args["branches"] = branches
    args["checkpoint_optional_agents"] = branches
    apply_session_checkpoint_ids_to_tool_args(state, args)
    apply_session_location_to_tool_args(state, args)
    sync_checkpoint_tool_args_to_state(state, args)
    logger.info(
        "tool_guards: analyze_checkpoints branches=%r checkpoint_ids=%r",
        branches,
        args.get("checkpoint_ids"),
    )
    return None


def is_checkpoint_routing_tool_name(tool_name: str | None) -> bool:
    return (tool_name or "").strip() in CHECKPOINT_ROUTING_TOOLS
