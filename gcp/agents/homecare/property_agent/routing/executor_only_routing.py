"""Executor-only routing experiment (Phase 4 single-loop refactor).

When ``HOMEAPP_EXECUTOR_ONLY_ROUTING=1``, skip ``resolve_turn_llm`` and let the
root executor choose tools. Injects a slim ``[SESSION_CONTEXT]`` block instead of
full ``[RESOLVED_TURN]`` + working-memory hydration. Bare greetings short-circuit
via cheap regex (fail-open to the executor for everything else).
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Mapping, Optional

from agent_framework.routing.resolved_turn import (
    RESOLVE_APPLIED_INVOCATION_KEY,
    inject_resolved_turn_into_llm_request,
    invocation_id,
)
from agent_framework.runtime.llm_short_circuit import plain_text_llm_response
from google.genai import types

from property_agent.memory_bank import resolve_property_id

from .chip_action import resolve_turn_from_chip
from .conversational_intent import (
    build_conversational_reply,
    clear_executor_invocation_analysis_flag,
    hydrate_turn_state_from_context,
    normalize_user_query,
    resolve_property_address_from_state,
)
from .constants import USER_DOCS_PASSTHROUGH_STATE_KEY
from .optional_branches import OPTIONAL_CHECKPOINT_BRANCHES
from .schema import IntentKind, ResolvedTurn, RouteKind, resolved_turn_from_state

logger = logging.getLogger(__name__)

_BARE_GREETING_RE = re.compile(
    r"^(?:"
    r"hi|hello|hey|howdy|yo|"
    r"good\s+(?:morning|afternoon|evening)|"
    r"hiya|greetings"
    r")\s*[!.,]?\s*$",
    re.IGNORECASE,
)

_BARE_CAPABILITIES_RE = re.compile(
    r"^what(?:'s|\s+can)\s+you\s+do(?:\s+for\s+me)?\s*[!.,]?\s*$",
    re.IGNORECASE,
)


def executor_only_routing_enabled() -> bool:
    raw = (os.getenv("HOMEAPP_EXECUTOR_ONLY_ROUTING") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def bare_casual_intent(user_query: str) -> Optional[IntentKind]:
    """Cheap regex for obvious casual turns; None → fail-open to executor."""
    normalized = normalize_user_query(user_query)
    if not normalized:
        return None
    if _BARE_CAPABILITIES_RE.match(normalized):
        return "capabilities"
    if _BARE_GREETING_RE.match(normalized):
        return "greeting"
    return None


def _route_from_primary_agent(state: Mapping[str, Any]) -> RouteKind:
    primary = str(state.get("primary_agent") or "").strip().lower()
    if primary == "report":
        return "report"
    if primary == "docs":
        return "user_docs"
    if primary == "checkpoint":
        return "checkpoint"
    return "none"


def minimal_substantive_resolved_turn(
    state: Any,
    *,
    user_query: str,
) -> ResolvedTurn:
    """Thin state record for tool guards — not injected into the executor prompt."""
    route = _route_from_primary_agent(state)
    ui_optional = state.get("checkpoint_optional_agents") or []
    optional: list[str] = []
    if isinstance(ui_optional, list):
        optional = [
            str(b)
            for b in ui_optional
            if str(b) in OPTIONAL_CHECKPOINT_BRANCHES
        ]
    has_optional = bool(optional)
    return ResolvedTurn(
        intent="substantive",
        route=route,
        expanded_user_query=user_query,
        retrieval_only=not has_optional,
        run_optional_agents=list(optional),
        user_goal="new_analysis" if has_optional else "answer_from_context",
        query_mode="branch_explicit" if has_optional else "interpret_session",
        resolve_source="executor_only",
    )


def format_slim_session_context_block(state: Any) -> str:
    cp_ids = state.get("checkpoint_ids") or []
    doc_uris = state.get("context_doc_uris") or []
    report_ids = state.get("report_ids") or []
    payload = {
        "property_address": state.get("property_address"),
        "property_id": state.get("property_id"),
        "primary_agent": state.get("primary_agent"),
        "checkpoint_ids_count": len(cp_ids) if isinstance(cp_ids, list) else 0,
        "context_doc_uris_count": len(doc_uris) if isinstance(doc_uris, list) else 0,
        "report_ids_count": len(report_ids) if isinstance(report_ids, list) else 0,
        "routing_mode": "executor_only",
    }
    return (
        "[SESSION_CONTEXT]\n"
        f"{json.dumps(payload, indent=2)}\n"
        "[/SESSION_CONTEXT]"
    )


def _ensure_generate_content_config(llm_request: Any) -> Any:
    config = getattr(llm_request, "config", None)
    if config is None:
        config = types.GenerateContentConfig()
        llm_request.config = config
    return config


def _system_instruction_text(llm_request: Any) -> str:
    config = getattr(llm_request, "config", None)
    if config is None:
        return ""
    si = getattr(config, "system_instruction", None)
    if si is None:
        return ""
    if isinstance(si, str):
        return si
    if isinstance(si, types.Content):
        parts = getattr(si, "parts", None) or []
        return "".join((getattr(part, "text", None) or "") for part in parts)
    return str(si)


def inject_slim_session_context_into_llm_request(
    llm_request: Any,
    *,
    block: str,
) -> None:
    """Append slim session context; strip prior resolve/memory blocks."""
    config = _ensure_generate_content_config(llm_request)
    existing = _system_instruction_text(llm_request).strip()
    for tag in ("RESOLVED_TURN", "SESSION_WORKING_MEMORY", "SESSION_CONTEXT"):
        existing = re.sub(
            rf"\[{tag}\][\s\S]*?\[/{tag}\]\n?",
            "",
            existing,
        ).strip()
    combined = f"{existing}\n\n{block}" if existing else block
    config.system_instruction = combined


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


def _casual_resolved_turn(intent: IntentKind, user_query: str) -> ResolvedTurn:
    return ResolvedTurn(
        intent=intent,
        route="none",
        expanded_user_query=user_query,
        retrieval_only=True,
        resolve_source="executor_only",
    )


def prepare_executor_only_before_model(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> Optional[Any]:
    """Skip resolve LLM; inject slim context or short-circuit bare greetings."""
    state = getattr(ctx, "state", None)
    inv_id = invocation_id(ctx)

    if state is not None:
        property_id = resolve_property_id(state)
        if property_id:
            state.setdefault("property_id", property_id)

    passthrough = _take_user_docs_passthrough(state)
    if passthrough:
        logger.info(
            "executor_only user_docs passthrough chars=%d",
            len(passthrough),
        )
        return plain_text_llm_response(passthrough)

    if (
        inv_id
        and state is not None
        and state.get(RESOLVE_APPLIED_INVOCATION_KEY) == inv_id
    ):
        existing = resolved_turn_from_state(state)
        if existing is not None and not existing.is_casual:
            if llm_request is not None:
                if existing.resolve_source == "chip":
                    from .resolve_turn import format_resolved_turn_block

                    block = format_resolved_turn_block(existing, state=state)
                    inject_resolved_turn_into_llm_request(
                        llm_request, existing, block=block
                    )
                else:
                    inject_slim_session_context_into_llm_request(
                        llm_request,
                        block=format_slim_session_context_block(state),
                    )
            logger.debug(
                "executor_only skip re-resolve invocation_id=%s",
                inv_id,
            )
            return None

    clear_executor_invocation_analysis_flag(state)
    user_query = hydrate_turn_state_from_context(ctx, llm_request=llm_request)

    chip = resolve_turn_from_chip(state, user_query=user_query)
    if chip is not None:
        from .resolve_turn import apply_resolved_turn_to_state, format_resolved_turn_block

        apply_resolved_turn_to_state(state, chip)
        if inv_id and state is not None:
            state[RESOLVE_APPLIED_INVOCATION_KEY] = inv_id
        if llm_request is not None:
            block = format_resolved_turn_block(chip, state=state)
            inject_resolved_turn_into_llm_request(llm_request, chip, block=block)
        return None

    casual_intent = bare_casual_intent(user_query)
    if casual_intent is not None:
        resolved = _casual_resolved_turn(casual_intent, user_query)
        from .resolve_turn import apply_resolved_turn_to_state

        apply_resolved_turn_to_state(state, resolved)
        if inv_id and state is not None:
            state[RESOLVE_APPLIED_INVOCATION_KEY] = inv_id
        address = resolve_property_address_from_state(state)
        text = build_conversational_reply(
            casual_intent,
            property_address=address,
            prior_analysis=False,
            state=state,
        )
        logger.info(
            "executor_only casual intent=%s query=%r",
            casual_intent,
            user_query[:80],
        )
        return plain_text_llm_response(text)

    resolved = minimal_substantive_resolved_turn(state, user_query=user_query)
    from .resolve_turn import apply_resolved_turn_to_state

    apply_resolved_turn_to_state(state, resolved)
    if inv_id and state is not None:
        state[RESOLVE_APPLIED_INVOCATION_KEY] = inv_id

    if llm_request is not None:
        inject_slim_session_context_into_llm_request(
            llm_request,
            block=format_slim_session_context_block(state),
        )

    logger.info(
        "executor_only substantive route=%s retrieval_only=%s optional=%r query=%r",
        resolved.route,
        resolved.retrieval_only,
        resolved.run_optional_agents,
        user_query[:80],
    )
    return None
