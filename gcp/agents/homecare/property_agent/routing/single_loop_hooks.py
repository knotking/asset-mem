"""Homecare adapters for agent-platform single-loop routing harness."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from agent_platform.core.routing.resolved_turn import (
    inject_resolved_turn_into_llm_request,
    inject_tagged_system_block,
)
from agent_platform.core.routing.single_loop_harness import SingleLoopHarnessHooks

from property_agent.memory_bank import resolve_property_id

from .chip_action import resolve_turn_from_chip
from .conversational_intent import (
    EXECUTOR_INVOCATION_STRUCTURED_ANALYSIS_KEY,
    build_conversational_reply,
    clear_executor_invocation_analysis_flag,
    hydrate_turn_state_from_context,
    resolve_property_address_from_state,
)
from .constants import USER_DOCS_PASSTHROUGH_STATE_KEY
from .pending_user_action import resolve_turn_from_pending_offer
from .post_structured_analysis import brief_post_structured_analysis_reply
from .resolve_turn import apply_resolved_turn_to_state, format_resolved_turn_block
from .schema import IntentKind, ResolvedTurn, resolved_turn_from_state
from .single_loop_common import bare_casual_intent, minimal_substantive_resolved_turn

logger = logging.getLogger(__name__)


def format_slim_session_context_block(
    state: Any,
    *,
    now: datetime | None = None,
) -> str:
    ref = now or datetime.now(timezone.utc)
    cp_ids = state.get("checkpoint_ids") or []
    doc_uris = state.get("context_doc_uris") or []
    report_ids = state.get("report_ids") or []
    ui_optional = state.get("checkpoint_optional_agents") or []
    payload = {
        "current_date_utc": ref.strftime("%Y-%m-%d"),
        "current_year": ref.year,
        "property_address": state.get("property_address"),
        "search_location": state.get("search_location"),
        "property_id": state.get("property_id"),
        "primary_agent": state.get("primary_agent"),
        "checkpoint_ids_count": len(cp_ids) if isinstance(cp_ids, list) else 0,
        "context_doc_uris_count": len(doc_uris) if isinstance(doc_uris, list) else 0,
        "report_ids_count": len(report_ids) if isinstance(report_ids, list) else 0,
        "checkpoint_optional_agents": (
            ui_optional if isinstance(ui_optional, list) else []
        ),
        "routing_mode": "single_loop",
    }
    return (
        "[SESSION_CONTEXT]\n"
        f"{json.dumps(payload, indent=2)}\n"
        "[/SESSION_CONTEXT]"
    )


def _casual_resolved_turn(intent: IntentKind, user_query: str) -> ResolvedTurn:
    return ResolvedTurn(
        intent=intent,
        route="none",
        expanded_user_query=user_query,
        retrieval_only=True,
        resolve_source="single_loop",
    )


class PropertySingleLoopHarnessHooks(SingleLoopHarnessHooks):
    def prepare_session_state(self, ctx: Any, state: Any) -> None:
        if state is not None:
            property_id = resolve_property_id(state)
            if property_id:
                state.setdefault("property_id", property_id)

    def passthrough_short_circuit(self, state: Any) -> str | None:
        if state is None or not hasattr(state, "get"):
            return None
        if not state.get(USER_DOCS_PASSTHROUGH_STATE_KEY):
            return None
        result = state.get("user_docs_result")
        state[USER_DOCS_PASSTHROUGH_STATE_KEY] = False
        if isinstance(result, str) and result.strip():
            text = result.strip()
            logger.info("single_loop user_docs passthrough chars=%d", len(text))
            return text
        return None

    def resolved_turn_from_state(self, state: Any) -> ResolvedTurn | None:
        return resolved_turn_from_state(state)

    def is_casual_resolved(self, resolved: Any) -> bool:
        return bool(getattr(resolved, "is_casual", False))

    def inject_for_existing_resolved(
        self, llm_request: Any, resolved: ResolvedTurn, *, state: Any
    ) -> None:
        if resolved.resolve_source == "chip" or resolved.discourse_act == "accept_offer":
            block = format_resolved_turn_block(resolved, state=state)
            inject_resolved_turn_into_llm_request(llm_request, resolved, block=block)
        else:
            inject_tagged_system_block(
                llm_request,
                block=format_slim_session_context_block(state),
            )

    def post_analysis_short_circuit(self, state: Any) -> str | None:
        if state is None or not state.get(EXECUTOR_INVOCATION_STRUCTURED_ANALYSIS_KEY):
            return None
        brief = brief_post_structured_analysis_reply(state)
        if brief:
            logger.info("single_loop post-structured-analysis short-circuit")
        return brief

    def begin_new_turn(
        self, ctx: Any, state: Any, *, llm_request: Any | None
    ) -> str:
        clear_executor_invocation_analysis_flag(state)
        if state is not None and hasattr(state, "__setitem__"):
            state["checkpoint_optional_agents"] = []
        user_query = hydrate_turn_state_from_context(ctx, llm_request=llm_request)
        if state is not None and hasattr(state, "__setitem__"):
            ref = datetime.now(timezone.utc)
            state.setdefault("current_date_utc", ref.strftime("%Y-%m-%d"))
            state.setdefault("current_year", ref.year)
        return user_query

    def try_chip(self, state: Any, *, user_query: str) -> ResolvedTurn | None:
        return resolve_turn_from_chip(state, user_query=user_query)

    def try_accept_offer(self, state: Any, *, user_query: str) -> ResolvedTurn | None:
        return resolve_turn_from_pending_offer(state, user_query=user_query)

    def bare_casual_intent(self, user_query: str) -> IntentKind | None:
        return bare_casual_intent(user_query)

    def casual_resolved_turn(self, intent: IntentKind, user_query: str) -> ResolvedTurn:
        return _casual_resolved_turn(intent, user_query)

    def casual_reply(
        self, intent: IntentKind, *, state: Any, user_query: str
    ) -> str:
        address = resolve_property_address_from_state(state)
        logger.info(
            "single_loop casual intent=%s query=%r",
            intent,
            user_query[:80],
        )
        return build_conversational_reply(
            intent,
            property_address=address,
            prior_analysis=False,
            state=state,
        )

    def minimal_substantive_turn(
        self, state: Any, *, user_query: str
    ) -> ResolvedTurn:
        return minimal_substantive_resolved_turn(state, user_query=user_query)

    def apply_resolved(self, state: Any, resolved: ResolvedTurn) -> None:
        apply_resolved_turn_to_state(state, resolved)

    def mark_resolve_applied(self, ctx: Any, state: Any) -> None:
        from agent_platform.core.routing.resolved_turn import (
            RESOLVE_APPLIED_INVOCATION_KEY,
            invocation_id,
        )

        inv_id = invocation_id(ctx)
        if inv_id and state is not None:
            state[RESOLVE_APPLIED_INVOCATION_KEY] = inv_id

    def inject_for_resolved_fast_path(
        self, llm_request: Any, resolved: ResolvedTurn, *, state: Any
    ) -> None:
        block = format_resolved_turn_block(resolved, state=state)
        inject_resolved_turn_into_llm_request(llm_request, resolved, block=block)

    def inject_for_substantive_default(
        self, llm_request: Any, *, state: Any
    ) -> None:
        inject_tagged_system_block(
            llm_request,
            block=format_slim_session_context_block(state),
        )

    def log_substantive(self, resolved: ResolvedTurn, *, user_query: str) -> None:
        logger.info(
            "single_loop substantive route=%s retrieval_only=%s optional=%r query=%r",
            resolved.route,
            resolved.retrieval_only,
            resolved.run_optional_agents,
            user_query[:80],
        )


PROPERTY_SINGLE_LOOP_HOOKS = PropertySingleLoopHarnessHooks()
