"""Homecare ``ResolveTurnHooks`` for ``agent_framework.routing.resolve_pipeline``."""

from __future__ import annotations

import logging
from typing import Any, Optional

from agent_framework.routing.resolve_pipeline import ResolveTurnHooks

from property_agent.memory_bank import resolve_property_id
from .constants import USER_DOCS_PASSTHROUGH_STATE_KEY
from .conversational_intent import (
    clear_executor_invocation_analysis_flag,
    last_turn_delivered_checkpoint_analysis,
    build_conversational_reply,
    resolve_property_address_from_state,
    resolve_user_query_from_state,
)
from .schema import ResolvedTurn, resolved_turn_from_state

logger = logging.getLogger(__name__)


class HomecareResolveHooks:
    """Domain hooks for property_agent resolve pipeline."""

    def prepare_state(self, ctx: Any) -> None:
        state = getattr(ctx, "state", None)
        property_id = resolve_property_id(state)
        if state is not None and property_id:
            state.setdefault("property_id", property_id)

    def early_short_circuit(self, ctx: Any) -> Any | None:
        from agent_framework.runtime.llm_short_circuit import plain_text_llm_response

        state = getattr(ctx, "state", None)
        passthrough = _take_user_docs_passthrough(state)
        if passthrough:
            logger.info(
                "resolve_turn user_docs passthrough chars=%d",
                len(passthrough),
            )
            return plain_text_llm_response(passthrough)
        return None

    def resolved_turn_from_state(self, state: Any) -> ResolvedTurn | None:
        return resolved_turn_from_state(state)

    def is_casual(self, resolved: Any) -> bool:
        return bool(getattr(resolved, "is_casual", False))

    def before_resolve(self, ctx: Any) -> None:
        clear_executor_invocation_analysis_flag(getattr(ctx, "state", None))

    def resolve_turn(self, ctx: Any, *, llm_request: Any = None) -> ResolvedTurn:
        from .resolve_turn import resolve_turn as _resolve_turn

        return _resolve_turn(ctx, llm_request=llm_request)

    def apply_to_state(self, state: Any, resolved: ResolvedTurn) -> None:
        from .resolve_turn import apply_resolved_turn_to_state

        apply_resolved_turn_to_state(state, resolved)

    def build_casual_reply(self, resolved: ResolvedTurn, ctx: Any) -> str:
        from agent_framework.routing.resolved_turn import invocation_id, session_events

        state = getattr(ctx, "state", None)
        inv_id = invocation_id(ctx)
        events = session_events(ctx)
        prior_analysis = (
            resolved.intent == "acknowledgment"
            and last_turn_delivered_checkpoint_analysis(
                events,
                current_invocation_id=inv_id,
                state=state,
            )
        )
        address = resolve_property_address_from_state(state)
        text = build_conversational_reply(
            resolved.intent,
            property_address=address,
            prior_analysis=prior_analysis,
            state=state,
        )
        logger.info(
            "resolve_turn casual intent=%s source=%s query=%r",
            resolved.intent,
            resolved.resolve_source,
            (resolve_user_query_from_state(state) or "")[:80],
        )
        return text

    def format_inject_block(
        self, resolved: ResolvedTurn, *, state: Any | None = None
    ) -> str:
        from .resolve_turn import format_resolved_turn_block_with_memory

        return format_resolved_turn_block_with_memory(resolved, state=state)

    def log_substantive_resolve(self, resolved: ResolvedTurn, ctx: Any) -> None:
        _ = ctx
        logger.info(
            "resolve_turn substantive source=%s route=%s user_goal=%s query_mode=%s "
            "retrieval_only=%s optional=%r query=%r",
            resolved.resolve_source,
            resolved.route,
            resolved.user_goal,
            resolved.query_mode,
            resolved.retrieval_only,
            resolved.run_optional_agents,
            (resolved.expanded_user_query or "")[:80],
        )


def _take_user_docs_passthrough(state: Any) -> Optional[str]:
    if state is None or not hasattr(state, "get"):
        return None
    if not state.get(USER_DOCS_PASSTHROUGH_STATE_KEY):
        return None
    result = state.get("user_docs_result")
    state[USER_DOCS_PASSTHROUGH_STATE_KEY] = False
    if isinstance(result, str) and result.strip():
        return result.strip()
    return None


HOMECARE_RESOLVE_HOOKS: ResolveTurnHooks = HomecareResolveHooks()
