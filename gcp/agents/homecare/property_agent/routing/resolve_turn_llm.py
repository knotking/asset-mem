"""LLM-only turn resolver (flash JSON) — single source of routing truth."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Mapping, Optional, Sequence

from google.genai import types

from agent_framework.routing.resolved_turn import invocation_id, session_events
from agent_framework.state.context_ids import resolve_user_id_from_context

from ..model_config import GLOBAL_GEMINI_MODEL
from .apply_resolved_turn import (
    apply_primary_agent_constraints,
    fallback_resolved_turn,
    payload_to_resolved,
    sanitize_llm_payload,
)
from .checkpoint_selection import checkpoint_selection_changed
from .conversational_intent import (
    DEFAULT_CAPABILITY_OPTIONS,
    LAST_OFFERED_OPTIONS_KEY,
    hydrate_turn_state_from_context,
    prior_checkpoint_analysis_in_session,
    record_last_offered_options,
)
from .property_analysis_routing import property_analysis_routing_blob
from .resolve_llm_schema import RESOLVE_SCHEMA, RESOLVE_SYSTEM

logger = logging.getLogger(__name__)

_PROGRESS_EVENT_AUTHORS = frozenset(
    {
        "checkpoint_analysis_progress",
        "checkpoint_optional_agents_parallel_runner",
        "checkpoint_progress_synthesis_agent",
    }
)


def resolve_llm_disabled() -> bool:
    raw = (os.getenv("RESOLVE_LLM_DISABLED") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _vertex_client():
    return GLOBAL_GEMINI_MODEL.api_client


def _event_text(event: Any) -> str:
    content = getattr(event, "content", None)
    if content is None:
        return ""
    parts = getattr(content, "parts", None) or []
    chunks: list[str] = []
    for part in parts:
        text = getattr(part, "text", None)
        if isinstance(text, str) and text.strip():
            chunks.append(text.strip())
    return "\n".join(chunks)


def _is_heavy_dialogue_for_resolve(text: str) -> bool:
    stripped = (text or "").strip()
    if not stripped:
        return True
    if stripped.startswith("{") or "```json" in stripped:
        return True
    if "# Checkpoint" in stripped and "analysis" in stripped.lower() and len(stripped) > 600:
        return True
    return False


def _recent_dialogue(
    session_events: Sequence[Any] | None,
    *,
    current_invocation_id: Optional[str] = None,
    max_chars: int = 1500,
) -> str:
    if not session_events:
        return ""
    lines: list[str] = []
    for event in reversed(list(session_events)):
        inv_id = getattr(event, "invocation_id", None)
        if current_invocation_id and inv_id == current_invocation_id:
            continue
        author = getattr(event, "author", None)
        if author in _PROGRESS_EVENT_AUTHORS:
            continue
        if author not in ("user", "property_agent", "model"):
            continue
        text = _event_text(event)
        if _is_heavy_dialogue_for_resolve(text):
            continue
        role = "user" if author == "user" else "assistant"
        lines.append(f"{role}: {text[:350]}")
        if sum(len(x) for x in lines) >= max_chars:
            break
    lines.reverse()
    blob = "\n".join(lines)
    return blob[-max_chars:] if len(blob) > max_chars else blob


def _ui_context_blob(
    state: Mapping[str, Any],
    *,
    user_id: Optional[str] = None,
    property_id: Optional[str] = None,
) -> dict[str, Any]:
    menu = state.get(LAST_OFFERED_OPTIONS_KEY)
    if not isinstance(menu, list) or not menu:
        menu = list(DEFAULT_CAPABILITY_OPTIONS)
    cp_ids = state.get("checkpoint_ids") or []
    blob: dict[str, Any] = {
        "primary_agent": state.get("primary_agent"),
        "checkpoint_ids_count": len(cp_ids),
        "checkpoint_selection_changed": checkpoint_selection_changed(state),
        "context_doc_uris_count": len(state.get("context_doc_uris") or []),
        "ui_optional_agents": state.get("checkpoint_optional_agents")
        or state.get("_checkpoint_optional_agents_ui"),
        "prior_full_checkpoint_analysis": prior_checkpoint_analysis_in_session(state),
        "last_capability_menu": menu,
        "property_address": state.get("property_address"),
    }
    blob["property_analysis"] = property_analysis_routing_blob(
        state, user_id=user_id, property_id=property_id
    )
    return blob


def _json_from_response(response: Any) -> Optional[dict[str, Any]]:
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, dict):
        return parsed
    primary = (getattr(response, "text", None) or "").strip()
    for candidate in (primary,):
        if not candidate:
            continue
        cleaned = candidate.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```\s*$", "", cleaned).strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    for cand in getattr(response, "candidates", None) or []:
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", None) if content else None
        if not parts:
            continue
        blob = "\n".join(
            getattr(p, "text", "") or "" for p in parts if getattr(p, "text", None)
        ).strip()
        if not blob:
            continue
        try:
            data = json.loads(blob)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    return None


def call_resolve_turn_llm(
    *,
    user_query: str,
    state: Mapping[str, Any],
    session_events: Sequence[Any] | None,
    current_invocation_id: Optional[str] = None,
    user_id: Optional[str] = None,
    property_id: Optional[str] = None,
) -> Optional[Any]:
    from .schema import ResolvedTurn
    from property_agent.observability.turn_request_timing import mark, record_duration_ms

    mark("resolve_start")
    t0 = time.monotonic()

    def _finish_resolve_timing() -> float:
        elapsed_ms = (time.monotonic() - t0) * 1000
        record_duration_ms("resolve_ms", elapsed_ms)
        mark("resolve_end")
        return elapsed_ms

    dialogue = _recent_dialogue(
        session_events, current_invocation_id=current_invocation_id
    )
    user_blob = json.dumps(
        {
            "user_query": user_query,
            "ui_context": _ui_context_blob(
                state, user_id=user_id, property_id=property_id
            ),
            "recent_dialogue": dialogue or "(none)",
        },
        indent=2,
    )
    prompt = f"{RESOLVE_SYSTEM}\n\nINPUT_JSON:\n{user_blob}\n"
    model = getattr(GLOBAL_GEMINI_MODEL, "model", None) or "gemini-3.1-flash-lite"
    try:
        client = _vertex_client()
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=512,
                response_mime_type="application/json",
                response_json_schema=RESOLVE_SCHEMA,
            ),
        )
    except Exception:
        logger.exception("resolve_turn_llm: generate_content failed")
        _finish_resolve_timing()
        return None
    raw = _json_from_response(response)
    if not raw:
        elapsed_ms = _finish_resolve_timing()
        logger.warning(
            "resolve_turn_llm: empty JSON (elapsed_ms=%.0f)",
            elapsed_ms,
        )
        return None
    sanitized = sanitize_llm_payload(raw, user_query=user_query, state=state)
    if not sanitized:
        _finish_resolve_timing()
        logger.warning("resolve_turn_llm: invalid payload %r", raw)
        return None
    sanitized = apply_primary_agent_constraints(
        sanitized, state=state, user_query=user_query
    )
    resolved = payload_to_resolved(sanitized, state=state, user_query=user_query)
    elapsed_ms = _finish_resolve_timing()
    logger.info(
        "resolve_turn_llm intent=%s route=%s user_goal=%s query_mode=%s "
        "retrieval_only=%s optional=%r elapsed_ms=%.0f",
        sanitized["intent"],
        sanitized["route"],
        resolved.user_goal,
        resolved.query_mode,
        sanitized["retrieval_only"],
        sanitized["run_optional_agents"],
        elapsed_ms,
    )
    try:
        from property_agent.metrics.routing_metrics import record_resolve_turn

        record_resolve_turn(
            intent=str(sanitized.get("intent") or ""),
            route=str(sanitized.get("route") or ""),
            prompt_text=prompt,
            elapsed_ms=elapsed_ms,
            executor_skipped=bool(getattr(resolved, "is_casual", False)),
        )
    except Exception:
        logger.debug("resolve_turn_llm metrics skipped", exc_info=True)
    return resolved


def resolve_turn_llm(ctx: Any, *, llm_request: Any = None) -> Any:
    from .schema import ResolvedTurn

    state = getattr(ctx, "state", None) or {}
    user_query = hydrate_turn_state_from_context(ctx, llm_request=llm_request)
    events = session_events(ctx)
    inv_id = invocation_id(ctx)
    if resolve_llm_disabled():
        logger.warning("resolve_turn_llm: disabled via RESOLVE_LLM_DISABLED")
        return fallback_resolved_turn(user_query)
    from ..memory_bank import resolve_property_id

    resolved = call_resolve_turn_llm(
        user_query=user_query,
        state=state,
        session_events=events,
        current_invocation_id=inv_id,
        user_id=resolve_user_id_from_context(ctx),
        property_id=resolve_property_id(state),
    )
    if resolved is None:
        logger.warning("resolve_turn_llm: using fallback")
        return fallback_resolved_turn(user_query)
    if resolved.intent in ("greeting", "capabilities") and state is not None:
        record_last_offered_options(state)
    return resolved
