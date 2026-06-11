"""Turn resolution: single-loop routing + state apply + chip/accept inject."""

from __future__ import annotations

import logging
from typing import Any, Mapping, Optional

from agent_framework.routing.resolved_turn import (
    RESOLVED_TURN_STATE_KEY,
    format_resolved_turn_block as _platform_format_resolved_turn_block,
    inject_resolved_turn_into_llm_request as _platform_inject_resolved_turn,
)

from .constants import REPORT_MODE_EXECUTOR_NOTE, RESOLVED_TURN_UI_CONTEXT_NOTE
from .schema import CASUAL_INTENTS, ResolvedTurn, SessionStateLike, resolved_turn_from_state

from .conversational_intent import CONVERSATIONAL_TURN_STATE_KEY
from .checkpoint_selection import (
    checkpoint_selection_changed,
    clear_stale_checkpoint_analysis_state,
)
from .query_mode import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    query_requests_checkpoint_inventory,
    session_has_checkpoint_answer_context,
    should_answer_provider_from_context,
    snapshot_session_analysis_context,
)

_CHECKPOINT_SNAPSHOT_KEYS = (
    "checkpoint_summary",
    "analysis_digest",
    "analysis_title",
    "branches_completed",
    "checkpoint_ids_analyzed",
    "analysis_run_id",
    "last_response_kind",
)

logger = logging.getLogger(__name__)

__all__ = [
    "CASUAL_INTENTS",
    "RESOLVED_TURN_STATE_KEY",
    "ResolvedTurn",
    "apply_resolved_turn_to_state",
    "format_resolved_turn_block",
    "inject_resolved_turn_into_llm_request",
    "prepare_before_model_turn",
    "requests_optional_analysis_from_resolved",
    "resolved_turn_from_state",
]


def is_executor_conversational_turn(
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None = None,
) -> bool:
    """True when routing tools should be blocked (plain-text executor only)."""
    if resolved.is_casual:
        return True
    if resolved.resolve_source in ("single_loop", "executor_only"):
        return False
    if resolved.route in ("report", "user_docs"):
        return False
    if resolved.run_optional_agents:
        return False
    if resolved.user_goal in ("new_analysis", "replay_deliverable") and not resolved.retrieval_only:
        return False
    if resolved.retrieval_only and resolved.user_goal == "answer_from_context":
        if resolved.discourse_act in ("explain_prior", "provider_detail"):
            return True
        expanded = str(resolved.expanded_user_query or "").strip()
        if expanded and query_requests_checkpoint_inventory(expanded):
            return False
        return session_has_checkpoint_answer_context(state)
    return False


def apply_resolved_turn_to_state(state: Any, resolved: ResolvedTurn) -> None:
    """Persist routing output and sync checkpoint_optional_agents for tools."""
    if state is None or not hasattr(state, "__setitem__"):
        return

    state[RESOLVED_TURN_STATE_KEY] = resolved.to_dict()
    if resolved.expanded_user_query:
        state["user_query"] = resolved.expanded_user_query

    state[CONVERSATIONAL_TURN_STATE_KEY] = is_executor_conversational_turn(
        resolved, state=state
    )

    if resolved.route == "checkpoint" and checkpoint_selection_changed(state):
        clear_stale_checkpoint_analysis_state(state)
        snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
        if isinstance(snapshot, dict):
            for key in _CHECKPOINT_SNAPSHOT_KEYS:
                snapshot.pop(key, None)

    if resolved.is_casual:
        state["_saved_checkpoint_optional_agents"] = state.get(
            "checkpoint_optional_agents"
        )
        state["checkpoint_optional_agents"] = []
        return

    if resolved.route == "user_docs":
        _clear_checkpoint_passthrough_stash(state)
        state["checkpoint_optional_agents"] = []
        return

    if resolved.route == "report":
        _clear_checkpoint_passthrough_stash(state)
        state["checkpoint_optional_agents"] = []
        return

    if resolved.run_optional_agents:
        session_query = str(
            state.get("user_query") or resolved.expanded_user_query or ""
        )
        if should_answer_provider_from_context(session_query, state=state):
            snapshot_session_analysis_context(state)
            if state.get("checkpoint_optional_agents"):
                state["_checkpoint_optional_agents_ui"] = state.get(
                    "checkpoint_optional_agents"
                )
            state["checkpoint_optional_agents"] = []
            return
        _clear_checkpoint_passthrough_stash(state)
        if hasattr(state, "__setitem__"):
            state["checkpoint_parallel_results"] = None
        ui = state.get("checkpoint_optional_agents") or state.get(
            "_checkpoint_optional_agents_ui"
        )
        if isinstance(ui, list) and ui:
            filtered = [b for b in resolved.run_optional_agents if b in ui]
            state["checkpoint_optional_agents"] = filtered or list(
                resolved.run_optional_agents
            )
        else:
            state["checkpoint_optional_agents"] = list(resolved.run_optional_agents)
    elif resolved.retrieval_only:
        if state.get("checkpoint_optional_agents"):
            state["_checkpoint_optional_agents_ui"] = state.get(
                "checkpoint_optional_agents"
            )
        state["checkpoint_optional_agents"] = []
        if resolved.user_goal == "answer_from_context":
            snapshot_session_analysis_context(state)
        else:
            _clear_checkpoint_passthrough_stash(state)


def _clear_checkpoint_passthrough_stash(state: Any) -> None:
    if state is None or not hasattr(state, "__setitem__"):
        return
    for key in (
        "checkpoint_analysis",
        "checkpoint_analysis_progress",
        "checkpoint_parallel_results",
        "checkpoint_result",
        "checkpoint_last_response_kind",
        "checkpoint_analysis_markdown",
    ):
        if key in state:
            state[key] = None


def requests_optional_analysis_from_resolved(
    state: SessionStateLike | None,
    *,
    user_query: str = "",
) -> bool:
    _ = user_query
    resolved = resolved_turn_from_state(state)
    if resolved is None or resolved.is_casual:
        return False
    return bool(resolved.run_optional_agents) and not resolved.retrieval_only


def format_resolved_turn_block(
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None = None,
) -> str:
    extra: list[str] = []
    if resolved.route == "report":
        extra.append(REPORT_MODE_EXECUTOR_NOTE)
    return _platform_format_resolved_turn_block(
        resolved,
        extra_blocks=extra or None,
        metadata={"ui_context_note": RESOLVED_TURN_UI_CONTEXT_NOTE},
    )


def inject_resolved_turn_into_llm_request(
    llm_request: Any,
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None = None,
) -> None:
    block = format_resolved_turn_block(resolved, state=state)
    _platform_inject_resolved_turn(llm_request, resolved, block=block)


def prepare_before_model_turn(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> Optional[Any]:
    """Single-loop routing: chip/accept/casual regex or slim session context."""
    from .single_loop_routing import prepare_single_loop_before_model

    return prepare_single_loop_before_model(ctx, llm_request=llm_request)
