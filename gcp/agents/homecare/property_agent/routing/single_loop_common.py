"""Shared single-loop turn builders (homecare-specific)."""

from __future__ import annotations

import re
from typing import Any, Mapping, Optional

from .conversational_intent import normalize_user_query
from .optional_branches import OPTIONAL_CHECKPOINT_BRANCHES
from .schema import IntentKind, ResolvedTurn, RouteKind

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
        resolve_source="single_loop",
    )
