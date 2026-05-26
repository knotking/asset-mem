"""LLM-only turn resolver (flash JSON) — single source of routing truth."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Mapping, Optional, Sequence

from google.genai import types

from .conversational_intent import (
    DEFAULT_CAPABILITY_OPTIONS,
    LAST_OFFERED_OPTIONS_KEY,
    OPTIONAL_CHECKPOINT_BRANCHES,
    hydrate_turn_state_from_context,
    prior_checkpoint_analysis_in_session,
    query_requests_full_analysis_replay,
    record_last_offered_options,
    requests_checkpoint_optional_analysis,
    resolve_requested_optional_branches,
)
from .model_config import GLOBAL_GEMINI_MODEL
from .query_mode import (
    branches_mentioned_in_query,
    infer_query_mode,
    should_answer_provider_from_context,
)
from .resolve_turn import (
    CASUAL_INTENTS,
    ResolvedTurn,
    UserGoalKind,
    _invocation_id,
    _session_events,
)

logger = logging.getLogger(__name__)

_RESOLVE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "intent": {
            "type": "string",
            "enum": ["greeting", "capabilities", "acknowledgment", "substantive"],
            "description": "Whether this turn needs tools or is casual chat.",
        },
        "route": {
            "type": "string",
            "enum": ["none", "checkpoint", "user_docs", "knowledge_base"],
        },
        "expanded_user_query": {
            "type": "string",
            "description": "Full user request for tools; for casual turns echo user_query.",
        },
        "retrieval_only": {
            "type": "boolean",
            "description": "True when only checkpoint/docs retrieval, no optional analysis.",
        },
        "run_optional_agents": {
            "type": "array",
            "items": {
                "type": "string",
                "enum": list(OPTIONAL_CHECKPOINT_BRANCHES),
            },
            "description": "Hint only — post-processing derives branches from user text, not UI toggles.",
        },
        "user_goal": {
            "type": "string",
            "enum": ["answer_from_context", "new_analysis", "replay_deliverable"],
            "description": "answer_from_context | new_analysis | replay_deliverable",
        },
        "menu_index": {
            "type": ["integer", "null"],
            "description": "0-based index into last_capability_menu when user picked from list.",
        },
        "capability_key": {
            "anyOf": [
                {"type": "null"},
                {
                    "type": "string",
                    "enum": list(DEFAULT_CAPABILITY_OPTIONS),
                },
            ],
        },
    },
    "required": [
        "intent",
        "route",
        "expanded_user_query",
        "retrieval_only",
        "run_optional_agents",
    ],
}

_RESOLVE_SYSTEM = """You are the routing resolver for a property-care AI assistant.
Output JSON only.

Capability menu order (when user says "first one", "4th one", "how about cost", etc.):
0 checkpoints, 1 documents, 2 coverage, 3 diy, 4 service, 5 cost.

Intent:
- greeting: hi/hello/good morning only — no property task.
- capabilities: "what can you do", "what do you suggest", unsure what to ask — no tools.
- acknowledgment: thanks/got it/looks good ONLY when user does NOT ask for new work.
- substantive: any property task (checkpoints, docs, coverage, diy, service, cost, show notes, etc.).

User goals (checkpoint turns — post-processing enforces; set user_goal to match your intent):
- answer_from_context: interpretive follow-up, summary, advisory, show/list notes — answer from session; no new optional branches.
- new_analysis: user explicitly requests coverage/diy/service/cost analysis or "analyse checkpoints".
- replay_deliverable: user asks to see the full prior structured report again.

Critical:
- "yes do cost analysis", "how about cost?", "I mean coverage", "4th one" → substantive, user_goal=new_analysis.
- primary_agent is the client's active tab: "docs" → prefer user_docs for policy/lease/insurance/document questions;
  "checkpoint" → prefer checkpoint for inspections. checkpoint_ids alone do not override docs mode.
- ui_optional_agents and prior_full_checkpoint_analysis are hints only — never copy toggles into run_optional_agents.
- Questions like overall condition, what's wrong, should I hire a professional → answer_from_context (even if toggles are on).
- More details / tell me about a **service provider already listed in prior analysis** → answer_from_context, retrieval_only=true, run_optional_agents=[]; do not set menu_index for provider names.
- route=none for casual intents; checkpoint for checkpoints/branches; user_docs for document/policy; knowledge_base only if no checkpoint/doc fit.
- Expand indexical/menu picks into a concrete expanded_user_query for tools.
"""

_CHECKPOINT_QUERY_HINTS = (
    "checkpoint",
    "inspection",
    "inspection note",
    "show me the latest",
    "what changed",
    "analyse my checkpoints",
    "analyze my checkpoints",
)


def resolve_llm_disabled() -> bool:
    """Emergency off-switch: ``RESOLVE_LLM_DISABLED=1`` uses safe fallback only."""
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


def _recent_dialogue(
    session_events: Sequence[Any] | None,
    *,
    current_invocation_id: Optional[str] = None,
    max_chars: int = 2000,
) -> str:
    if not session_events:
        return ""
    lines: list[str] = []
    for event in reversed(list(session_events)):
        inv_id = getattr(event, "invocation_id", None)
        if current_invocation_id and inv_id == current_invocation_id:
            continue
        author = getattr(event, "author", None)
        if author not in ("user", "property_agent", "model"):
            continue
        text = _event_text(event)
        if not text or text.strip().startswith("{"):
            continue
        role = "user" if author == "user" else "assistant"
        lines.append(f"{role}: {text[:400]}")
        if sum(len(x) for x in lines) >= max_chars:
            break
    lines.reverse()
    blob = "\n".join(lines)
    return blob[-max_chars:] if len(blob) > max_chars else blob


def _ui_context_blob(state: Mapping[str, Any]) -> dict[str, Any]:
    menu = state.get(LAST_OFFERED_OPTIONS_KEY)
    if not isinstance(menu, list) or not menu:
        menu = list(DEFAULT_CAPABILITY_OPTIONS)
    return {
        "primary_agent": state.get("primary_agent"),
        "checkpoint_ids_count": len(state.get("checkpoint_ids") or []),
        "context_doc_uris_count": len(state.get("context_doc_uris") or []),
        "ui_optional_agents": state.get("checkpoint_optional_agents")
        or state.get("_checkpoint_optional_agents_ui"),
        "prior_full_checkpoint_analysis": prior_checkpoint_analysis_in_session(state),
        "last_capability_menu": menu,
        "property_address": state.get("property_address"),
    }


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


def _branches_from_resolver_menu_hints(
    payload: Mapping[str, Any],
    state: Mapping[str, Any],
) -> list[str]:
    """Branches from resolver menu_index / capability_key (user picked from capability list)."""
    picked: list[str] = []
    cap = payload.get("capability_key")
    if cap in OPTIONAL_CHECKPOINT_BRANCHES:
        picked.append(str(cap))
    menu_index = payload.get("menu_index")
    if menu_index is not None:
        try:
            idx = int(menu_index)
        except (TypeError, ValueError):
            idx = -1
        menu = state.get(LAST_OFFERED_OPTIONS_KEY)
        if not isinstance(menu, list) or not menu:
            menu = list(DEFAULT_CAPABILITY_OPTIONS)
        if 0 <= idx < len(menu):
            key = str(menu[idx])
            if key in OPTIONAL_CHECKPOINT_BRANCHES and key not in picked:
                picked.append(key)
    return picked


def _ui_optional_branches(state: Mapping[str, Any]) -> list[str]:
    ui = state.get("checkpoint_optional_agents") or state.get(
        "_checkpoint_optional_agents_ui"
    )
    if not isinstance(ui, list):
        return []
    return [str(b) for b in ui if str(b) in OPTIONAL_CHECKPOINT_BRANCHES]


def _provider_context_payload(
    payload: dict[str, Any],
    *,
    user_query: str,
    state: Mapping[str, Any],
) -> Optional[dict[str, Any]]:
    """Named-provider follow-up: answer from session, no checkpoint re-run."""
    expanded = str(payload.get("expanded_user_query") or user_query).strip()
    if should_answer_provider_from_context(
        expanded, state=state
    ) or should_answer_provider_from_context(user_query, state=state):
        return {
            **payload,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "menu_index": None,
            "capability_key": None,
        }
    return None


def _apply_checkpoint_retrieval_plan(
    payload: dict[str, Any],
    *,
    user_query: str,
    state: Mapping[str, Any],
) -> dict[str, Any]:
    """
    Derive checkpoint routing from user intent only — never trust resolver LLM branches
    or UI toggles alone. UI toggles apply only when the user explicitly requests analysis.
    """
    if payload.get("route") != "checkpoint":
        return payload

    expanded = str(payload.get("expanded_user_query") or user_query).strip()

    provider_ctx = _provider_context_payload(
        payload, user_query=user_query, state=state
    )
    if provider_ctx is not None:
        return provider_ctx

    if query_requests_full_analysis_replay(expanded) or query_requests_full_analysis_replay(
        user_query
    ):
        return {
            **payload,
            "retrieval_only": False,
            "run_optional_agents": [],
            "user_goal": "replay_deliverable",
        }

    requested = resolve_requested_optional_branches(expanded, state)
    if not requested:
        requested = resolve_requested_optional_branches(user_query, state)
    if not requested:
        requested = _branches_from_resolver_menu_hints(payload, state)
    for branch in branches_mentioned_in_query(expanded) + branches_mentioned_in_query(
        user_query
    ):
        if branch not in requested:
            requested.append(branch)
    if requested:
        return {
            **payload,
            "retrieval_only": False,
            "run_optional_agents": requested,
            "user_goal": "new_analysis",
        }

    if requests_checkpoint_optional_analysis(
        expanded, state=state
    ) or requests_checkpoint_optional_analysis(user_query, state=state):
        provider_ctx = _provider_context_payload(
            payload, user_query=user_query, state=state
        )
        if provider_ctx is not None:
            return provider_ctx
        return {
            **payload,
            "retrieval_only": False,
            "run_optional_agents": _ui_optional_branches(state),
            "user_goal": "new_analysis",
        }

    return {
        **payload,
        "retrieval_only": True,
        "run_optional_agents": [],
        "user_goal": "answer_from_context",
    }


def _sanitize_llm_payload(
    data: dict[str, Any],
    *,
    user_query: str,
    state: Mapping[str, Any] | None = None,
) -> Optional[dict[str, Any]]:
    intent = data.get("intent")
    if intent not in ("greeting", "capabilities", "acknowledgment", "substantive"):
        return None

    expanded = str(data.get("expanded_user_query") or user_query).strip()
    if not expanded:
        expanded = (user_query or "").strip()

    if intent in CASUAL_INTENTS:
        return {
            "intent": intent,
            "route": "none",
            "expanded_user_query": expanded,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "menu_index": None,
            "capability_key": None,
        }

    route = data.get("route")
    if route not in ("checkpoint", "user_docs", "knowledge_base"):
        route = "checkpoint"

    cap = data.get("capability_key")
    if cap is not None and cap not in DEFAULT_CAPABILITY_OPTIONS:
        cap = None

    menu_index = data.get("menu_index")
    if menu_index is not None:
        try:
            menu_index = int(menu_index)
        except (TypeError, ValueError):
            menu_index = None

    payload = {
        "intent": "substantive",
        "route": route,
        "expanded_user_query": expanded,
        "retrieval_only": True,
        "run_optional_agents": [],
        "user_goal": "answer_from_context",
        "menu_index": menu_index,
        "capability_key": cap,
    }
    if route == "checkpoint":
        payload = _apply_checkpoint_retrieval_plan(
            payload, user_query=user_query, state=state or {}
        )
    elif route in ("user_docs", "knowledge_base"):
        payload = {
            **payload,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
        }
    return payload


def _query_looks_checkpoint_focused(query: str) -> bool:
    q = (query or "").lower()
    return any(hint in q for hint in _CHECKPOINT_QUERY_HINTS)


def _apply_primary_agent_constraints(
    payload: dict[str, Any],
    *,
    state: Mapping[str, Any],
    user_query: str,
) -> dict[str, Any]:
    """Honor client primary_agent tab without reintroducing brittle regex routing."""
    primary = str(state.get("primary_agent") or "").strip().lower()
    if payload.get("intent") in CASUAL_INTENTS:
        return payload

    expanded = str(payload.get("expanded_user_query") or user_query).strip()

    if primary == "docs":
        has_docs = bool(state.get("context_doc_uris"))
        if _query_looks_checkpoint_focused(expanded) and state.get("checkpoint_ids"):
            payload = {
                **payload,
                "route": "checkpoint",
                "retrieval_only": True,
                "run_optional_agents": [],
                "capability_key": "checkpoints",
            }
        else:
            payload = {
                **payload,
                "route": "user_docs",
                "retrieval_only": True,
                "run_optional_agents": [],
                "menu_index": None,
                "capability_key": "documents"
                if has_docs
                else payload.get("capability_key"),
            }
        return payload

    if primary == "checkpoint":
        if payload.get("route") == "user_docs" and _query_looks_checkpoint_focused(
            expanded
        ):
            payload = {**payload, "route": "checkpoint"}
        return payload

    return payload


def _coerce_user_goal(raw: Any, payload: Mapping[str, Any]) -> UserGoalKind:
    goal = payload.get("user_goal")
    if goal in ("answer_from_context", "new_analysis", "replay_deliverable"):
        return goal  # type: ignore[return-value]
    if raw in ("answer_from_context", "new_analysis", "replay_deliverable"):
        return raw  # type: ignore[return-value]
    if payload.get("retrieval_only"):
        return "answer_from_context"
    if query_requests_full_analysis_replay(
        str(payload.get("expanded_user_query") or "")
    ):
        return "replay_deliverable"
    if payload.get("run_optional_agents") and goal != "answer_from_context":
        return "new_analysis"
    if not payload.get("retrieval_only"):
        return "new_analysis"
    return "answer_from_context"


def _fallback_resolved_turn(user_query: str) -> ResolvedTurn:
    """Safe default when LLM resolve fails."""
    return ResolvedTurn(
        intent="substantive",
        route="checkpoint",
        expanded_user_query=user_query or "Help with my property.",
        retrieval_only=True,
        run_optional_agents=[],
        user_goal="answer_from_context",
        resolve_source="fallback",
    )


def _payload_to_resolved(
    payload: dict[str, Any],
    *,
    state: Mapping[str, Any] | None = None,
    user_query: str = "",
) -> ResolvedTurn:
    if payload.get("route") == "checkpoint" and state is not None:
        enforced = _provider_context_payload(
            payload, user_query=user_query, state=state
        )
        if enforced is not None:
            payload = enforced
    user_goal = _coerce_user_goal(payload.get("user_goal"), payload)
    optional = list(payload.get("run_optional_agents") or [])
    return ResolvedTurn(
        intent=payload["intent"],  # type: ignore[arg-type]
        route=payload["route"],  # type: ignore[arg-type]
        expanded_user_query=payload["expanded_user_query"],
        retrieval_only=payload["retrieval_only"],
        run_optional_agents=optional,
        user_goal=user_goal,
        query_mode=infer_query_mode(
            user_goal=user_goal,
            expanded_user_query=payload["expanded_user_query"],
            run_optional_agents=optional,
            state=state,
        ),
        menu_index=payload.get("menu_index"),
        capability_key=payload.get("capability_key"),
        resolve_source="llm",
    )


def call_resolve_turn_llm(
    *,
    user_query: str,
    state: Mapping[str, Any],
    session_events: Sequence[Any] | None,
    current_invocation_id: Optional[str] = None,
) -> Optional[ResolvedTurn]:
    """Single flash JSON call."""
    dialogue = _recent_dialogue(
        session_events, current_invocation_id=current_invocation_id
    )
    user_blob = json.dumps(
        {
            "user_query": user_query,
            "ui_context": _ui_context_blob(state),
            "recent_dialogue": dialogue or "(none)",
        },
        indent=2,
    )
    prompt = f"{_RESOLVE_SYSTEM}\n\nINPUT_JSON:\n{user_blob}\n"

    client = _vertex_client()
    model = getattr(GLOBAL_GEMINI_MODEL, "model", None) or "gemini-3.1-flash-lite"
    t0 = time.monotonic()
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=512,
                response_mime_type="application/json",
                response_json_schema=_RESOLVE_SCHEMA,
            ),
        )
    except Exception:
        logger.exception("resolve_turn_llm: generate_content failed")
        return None

    raw = _json_from_response(response)
    if not raw:
        logger.warning(
            "resolve_turn_llm: empty JSON (elapsed_ms=%.0f)",
            (time.monotonic() - t0) * 1000,
        )
        return None

    sanitized = _sanitize_llm_payload(raw, user_query=user_query, state=state)
    if not sanitized:
        logger.warning("resolve_turn_llm: invalid payload %r", raw)
        return None

    sanitized = _apply_primary_agent_constraints(
        sanitized, state=state, user_query=user_query
    )

    resolved = _payload_to_resolved(sanitized, state=state, user_query=user_query)
    logger.info(
        "resolve_turn_llm intent=%s route=%s user_goal=%s query_mode=%s "
        "retrieval_only=%s optional=%r elapsed_ms=%.0f",
        sanitized["intent"],
        sanitized["route"],
        resolved.user_goal,
        resolved.query_mode,
        sanitized["retrieval_only"],
        sanitized["run_optional_agents"],
        (time.monotonic() - t0) * 1000,
    )
    return resolved


def resolve_turn_llm(
    ctx: Any,
    *,
    llm_request: Any = None,
) -> ResolvedTurn:
    """LLM-only resolve for every turn (routing source of truth)."""
    state = getattr(ctx, "state", None) or {}
    user_query = hydrate_turn_state_from_context(ctx, llm_request=llm_request)
    events = _session_events(ctx)
    inv_id = _invocation_id(ctx)

    if resolve_llm_disabled():
        logger.warning("resolve_turn_llm: disabled via RESOLVE_LLM_DISABLED")
        return _fallback_resolved_turn(user_query)

    resolved = call_resolve_turn_llm(
        user_query=user_query,
        state=state,
        session_events=events,
        current_invocation_id=inv_id,
    )
    if resolved is None:
        logger.warning("resolve_turn_llm: using fallback")
        return _fallback_resolved_turn(user_query)

    if resolved.intent in ("greeting", "capabilities") and state is not None:
        record_last_offered_options(state)

    return resolved
