"""Homecare-specific turn-resolution schema (routes, intents, ResolvedTurn)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal, Mapping, Optional

RouteKind = Literal["none", "checkpoint", "user_docs", "knowledge_base"]
IntentKind = Literal["greeting", "capabilities", "acknowledgment", "substantive"]
UserGoalKind = Literal["answer_from_context", "new_analysis", "replay_deliverable"]
QueryModeKind = Literal[
    "interpret_session",
    "branch_issue_search",
    "branch_entity_search",
    "branch_explicit",
]

CASUAL_INTENTS = frozenset({"greeting", "capabilities", "acknowledgment"})


@dataclass
class ResolvedTurn:
    """Machine-readable plan for the executor LLM (injected each substantive turn)."""

    intent: IntentKind
    route: RouteKind
    expanded_user_query: str
    retrieval_only: bool
    run_optional_agents: list[str] = field(default_factory=list)
    user_goal: UserGoalKind = "answer_from_context"
    query_mode: QueryModeKind = "interpret_session"
    menu_index: Optional[int] = None
    capability_key: Optional[str] = None
    resolve_source: str = "llm"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def is_casual(self) -> bool:
        return self.intent in CASUAL_INTENTS


def resolved_turn_from_state(state: Mapping[str, Any] | None) -> Optional[ResolvedTurn]:
    if not state:
        return None
    from agent_framework.routing.resolved_turn import RESOLVED_TURN_STATE_KEY

    raw = state.get(RESOLVED_TURN_STATE_KEY)
    if not isinstance(raw, dict):
        return None
    try:
        return ResolvedTurn(
            intent=raw.get("intent", "substantive"),
            route=raw.get("route", "checkpoint"),
            expanded_user_query=str(raw.get("expanded_user_query") or ""),
            retrieval_only=bool(raw.get("retrieval_only", True)),
            run_optional_agents=list(raw.get("run_optional_agents") or []),
            user_goal=(
                raw.get("user_goal")
                if raw.get("user_goal")
                in ("answer_from_context", "new_analysis", "replay_deliverable")
                else "answer_from_context"
            ),
            query_mode=(
                raw.get("query_mode")
                if raw.get("query_mode")
                in (
                    "interpret_session",
                    "branch_issue_search",
                    "branch_entity_search",
                    "branch_explicit",
                )
                else "interpret_session"
            ),
            menu_index=raw.get("menu_index"),
            capability_key=raw.get("capability_key"),
            resolve_source=str(raw.get("resolve_source") or "llm"),
        )
    except (TypeError, ValueError):
        return None
