"""Turn resolution: LLM-only routing + state apply + executor inject."""

from __future__ import annotations

import logging
from typing import Any, Mapping, Optional

from agent_framework.routing.resolve_pipeline import run_resolve_before_model
from agent_framework.routing.resolved_turn import (
    RESOLVED_TURN_STATE_KEY,
    format_resolved_turn_block as _platform_format_resolved_turn_block,
    inject_resolved_turn_into_llm_request as _platform_inject_resolved_turn,
)

from .constants import RESOLVED_TURN_UI_CONTEXT_NOTE
from .homecare_resolve_hooks import HOMECARE_RESOLVE_HOOKS
from .schema import CASUAL_INTENTS, ResolvedTurn, SessionStateLike, resolved_turn_from_state

from .conversational_intent import CONVERSATIONAL_TURN_STATE_KEY
from agent_framework.context.hydrator_render import render_hydrated_context

from property_agent.context.homecare_hydrator_v1 import (
    DEFAULT_HOMECARE_CONTEXT_BUDGETS,
    hydrate_session_context_sync,
)

from .query_mode import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    should_answer_provider_from_context,
    snapshot_session_analysis_context,
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
    "resolve_turn",
    "resolved_turn_from_state",
]


def resolve_turn(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> ResolvedTurn:
    """LLM-only routing (see ``resolve_turn_llm.resolve_turn_llm``)."""
    from .resolve_turn_llm import resolve_turn_llm

    return resolve_turn_llm(ctx, llm_request=llm_request)


def apply_resolved_turn_to_state(state: Any, resolved: ResolvedTurn) -> None:
    """Persist resolve output and sync checkpoint_optional_agents for tools."""
    if state is None or not hasattr(state, "__setitem__"):
        return

    state[RESOLVED_TURN_STATE_KEY] = resolved.to_dict()
    if resolved.expanded_user_query:
        state["user_query"] = resolved.expanded_user_query

    if resolved.is_casual or resolved.route == "none":
        state[CONVERSATIONAL_TURN_STATE_KEY] = True
        state["_saved_checkpoint_optional_agents"] = state.get(
            "checkpoint_optional_agents"
        )
        state["checkpoint_optional_agents"] = []
        return

    state[CONVERSATIONAL_TURN_STATE_KEY] = False

    if resolved.route == "user_docs":
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
    """Drop stale checkpoint dual-format state so docs turns are not overwritten."""
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
    """Enforce optional analysis only from resolve output."""
    _ = user_query
    resolved = resolved_turn_from_state(state)
    if resolved is None or resolved.is_casual:
        return False
    return bool(resolved.run_optional_agents) and not resolved.retrieval_only


def _should_inject_session_working_memory(
    resolved: ResolvedTurn,
    state: Mapping[str, Any],
) -> bool:
    if resolved.user_goal == "answer_from_context":
        return True
    if resolved.retrieval_only and state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY):
        return True
    return False


def format_resolved_turn_block_with_memory(
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None = None,
) -> str:
    extra: list[str] = []
    if state is not None and _should_inject_session_working_memory(resolved, state):
        hydrated = hydrate_session_context_sync(
            query=resolved.expanded_user_query or "",
            state=state,
            budgets=DEFAULT_HOMECARE_CONTEXT_BUDGETS,
        )
        memory = render_hydrated_context(hydrated)
        if memory:
            extra.append(memory)
    return _platform_format_resolved_turn_block(
        resolved,
        extra_blocks=extra or None,
        metadata={"ui_context_note": RESOLVED_TURN_UI_CONTEXT_NOTE},
    )


def inject_resolved_turn_into_llm_request_plugin(
    llm_request: Any,
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None = None,
) -> None:
    block = format_resolved_turn_block_with_memory(resolved, state=state)
    _platform_inject_resolved_turn(llm_request, resolved, block=block)


def format_resolved_turn_block(
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None = None,
) -> str:
    return format_resolved_turn_block_with_memory(resolved, state=state)


def inject_resolved_turn_into_llm_request(
    llm_request: Any,
    resolved: ResolvedTurn,
    *,
    state: Mapping[str, Any] | None = None,
) -> None:
    inject_resolved_turn_into_llm_request_plugin(
        llm_request, resolved, state=state
    )


def prepare_before_model_turn(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> Optional[Any]:
    """
    LLM resolve → canned reply for casual intents, else inject [RESOLVED_TURN] for executor.

    Returns LlmResponse to short-circuit the executor, or None to run the executor LLM.
    """
    return run_resolve_before_model(
        ctx, llm_request=llm_request, hooks=HOMECARE_RESOLVE_HOOKS
    )
