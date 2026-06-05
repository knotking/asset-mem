"""NLU-first resolve flag and discourse_act → routing payload mapping."""

from __future__ import annotations

import os
from typing import Any, Mapping, Optional

from .schema import DiscourseActKind, FocusBranchKind, IntentKind, UserGoalKind

NLU_FIRST_RESOLVE_ENV = "HOMEAPP_NLU_FIRST_RESOLVE"

DISCOURSE_ACTS: frozenset[str] = frozenset(
    {
        "greeting",
        "capabilities",
        "closure",
        "accept_offer",
        "explain_prior",
        "new_work",
        "replay_report",
        "provider_detail",
    }
)

CASUAL_DISCOURSE_ACTS: frozenset[str] = frozenset(
    {"greeting", "capabilities", "closure"}
)

CONTEXT_ONLY_DISCOURSE_ACTS: frozenset[str] = frozenset(
    {"explain_prior", "closure", "provider_detail"}
)


def nlu_first_resolve_enabled() -> bool:
    """NLU-first resolve is on by default; set HOMEAPP_NLU_FIRST_RESOLVE=0 to disable."""
    raw = (os.getenv(NLU_FIRST_RESOLVE_ENV) or "").strip().lower()
    if not raw:
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    return raw in ("1", "true", "yes", "on")


def discourse_act_to_intent(discourse_act: str) -> IntentKind:
    if discourse_act == "greeting":
        return "greeting"
    if discourse_act == "capabilities":
        return "capabilities"
    if discourse_act == "closure":
        return "acknowledgment"
    return "substantive"


def default_user_goal_for_discourse(discourse_act: str) -> UserGoalKind:
    if discourse_act == "replay_report":
        return "replay_deliverable"
    if discourse_act in ("explain_prior", "provider_detail", "closure"):
        return "answer_from_context"
    if discourse_act == "accept_offer":
        return "new_analysis"
    if discourse_act == "new_work":
        return "new_analysis"
    return "answer_from_context"


def apply_discourse_act_to_payload(
    payload: dict[str, Any],
    *,
    discourse_act: DiscourseActKind,
    focus_branch: Optional[FocusBranchKind] = None,
) -> dict[str, Any]:
    """Map resolve discourse_act into intent/user_goal/optional branches."""
    intent = discourse_act_to_intent(discourse_act)
    out = dict(payload)
    out["discourse_act"] = discourse_act
    if focus_branch:
        out["focus_branch"] = focus_branch
    if discourse_act in CASUAL_DISCOURSE_ACTS:
        return {
            **out,
            "intent": intent,
            "route": "none",
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "menu_index": None,
            "capability_key": None,
        }
    out["intent"] = "substantive"
    goal = default_user_goal_for_discourse(discourse_act)
    if discourse_act == "explain_prior":
        return {
            **out,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
        }
    if discourse_act == "provider_detail":
        return {
            **out,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
            "menu_index": None,
            "capability_key": None,
        }
    if discourse_act == "replay_report":
        return {
            **out,
            "retrieval_only": False,
            "run_optional_agents": [],
            "user_goal": "replay_deliverable",
        }
    if discourse_act == "accept_offer":
        return {
            **out,
            "user_goal": goal,
            "retrieval_only": not bool(out.get("run_optional_agents")),
        }
    if discourse_act == "new_work":
        branches = list(out.get("run_optional_agents") or [])
        if not branches and out.get("route") == "none":
            return {
                **out,
                "user_goal": "answer_from_context",
                "retrieval_only": True,
            }
        return {
            **out,
            "user_goal": "new_analysis" if branches else goal,
            "retrieval_only": not bool(branches),
        }
    return out


def should_block_ui_optional_merge(resolved: Mapping[str, Any]) -> bool:
    """Thin invariant: do not merge client UI toggles on context-only discourse acts."""
    if not nlu_first_resolve_enabled():
        return False
    act = str(resolved.get("discourse_act") or "")
    if act in CONTEXT_ONLY_DISCOURSE_ACTS:
        return True
    if resolved.get("user_goal") == "answer_from_context" and not resolved.get(
        "run_optional_agents"
    ):
        return True
    return False
