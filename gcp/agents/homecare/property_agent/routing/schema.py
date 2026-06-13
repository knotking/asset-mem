"""Homecare-specific turn-resolution schema (routes, intents, ResolvedTurn)."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal, Optional

RouteKind = Literal["none", "checkpoint", "user_docs", "report"]
IntentKind = Literal["greeting", "capabilities", "acknowledgment", "substantive"]
UserGoalKind = Literal["answer_from_context", "new_analysis", "replay_deliverable"]
DiscourseActKind = Literal[
    "greeting",
    "capabilities",
    "closure",
    "accept_offer",
    "explain_prior",
    "new_work",
    "replay_analysis",
    "provider_detail",
]
FocusBranchKind = Literal[
    "checkpoint",
    "coverage",
    "diy",
    "service",
    "cost",
    "documents",
]
QueryModeKind = Literal[
    "interpret_session",
    "branch_issue_search",
    "branch_entity_search",
    "branch_explicit",
]

CASUAL_INTENTS = frozenset({"greeting", "capabilities", "acknowledgment"})

DISCOURSE_ACTS: frozenset[str] = frozenset(
    {
        "greeting",
        "capabilities",
        "closure",
        "accept_offer",
        "explain_prior",
        "new_work",
        "replay_analysis",
        "provider_detail",
    }
)


# ADK ``State``, plain mappings, and resolver payloads share dict-like access.
SessionStateLike = Any


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
    discourse_act: Optional[DiscourseActKind] = None
    focus_branch: Optional[FocusBranchKind] = None
    resolve_source: str = "single_loop"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @property
    def is_casual(self) -> bool:
        return self.intent in CASUAL_INTENTS


def resolved_turn_from_state(state: SessionStateLike | None) -> Optional[ResolvedTurn]:
    if not state:
        return None
    from agent_platform.core.routing.resolved_turn import RESOLVED_TURN_STATE_KEY

    raw = state.get(RESOLVED_TURN_STATE_KEY)
    if not isinstance(raw, dict):
        return None
    try:
        raw_user_goal = raw.get("user_goal")
        user_goal: UserGoalKind = (
            raw_user_goal
            if raw_user_goal
            in ("answer_from_context", "new_analysis", "replay_deliverable")
            else "answer_from_context"
        )
        raw_query_mode = raw.get("query_mode")
        query_mode: QueryModeKind = (
            raw_query_mode
            if raw_query_mode
            in (
                "interpret_session",
                "branch_issue_search",
                "branch_entity_search",
                "branch_explicit",
            )
            else "interpret_session"
        )
        raw_discourse = raw.get("discourse_act")
        discourse_act: DiscourseActKind | None = (
            raw_discourse if raw_discourse in (
                "greeting", "capabilities", "closure", "accept_offer",
                "explain_prior", "new_work", "replay_analysis", "provider_detail",
            ) else None
        )
        raw_focus = raw.get("focus_branch")
        focus_branch: FocusBranchKind | None = (
            raw_focus if raw_focus in (
                "checkpoint", "coverage", "diy", "service", "cost", "documents",
            ) else None
        )
        raw_source = str(raw.get("resolve_source") or "single_loop")
        if raw_source == "executor_only":
            raw_source = "single_loop"
        return ResolvedTurn(
            intent=raw.get("intent", "substantive"),
            route=raw.get("route", "checkpoint"),
            expanded_user_query=str(raw.get("expanded_user_query") or ""),
            retrieval_only=bool(raw.get("retrieval_only", True)),
            run_optional_agents=list(raw.get("run_optional_agents") or []),
            user_goal=user_goal,
            query_mode=query_mode,
            menu_index=raw.get("menu_index"),
            capability_key=raw.get("capability_key"),
            discourse_act=discourse_act,
            focus_branch=focus_branch,
            resolve_source=raw_source,
        )
    except (TypeError, ValueError):
        return None
