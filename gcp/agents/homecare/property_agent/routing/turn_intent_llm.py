"""Deterministic guardrails for checkpoint follow-up intent (explain vs re-run branches)."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from .checkpoint_selection import checkpoint_selection_changed
from .conversational_intent import (
    query_requests_full_analysis_replay,
    resolve_explicit_optional_branches,
)
from .query_mode import (
    prior_analysis_branches_completed,
    query_looks_like_explain_follow_up,
    query_requests_fresh_external_data,
)

TurnIntentResult = dict[str, Any]


def apply_turn_intent_guardrails(
    intent: TurnIntentResult,
    *,
    user_query: str,
    expanded_user_query: str,
    state: Mapping[str, Any],
    branches_completed: Optional[frozenset[str]] = None,
) -> TurnIntentResult:
    q = (user_query or "").strip()
    expanded = (expanded_user_query or q).strip()
    out = dict(intent)
    branches = list(out.get("run_optional_agents") or [])
    if checkpoint_selection_changed(state) and branches:
        out["user_goal"] = "new_analysis"
        out["run_optional_agents"] = branches
        out["reason"] = ((out.get("reason") or "") + " [checkpoint selection changed]").strip()
        return out
    if query_requests_full_analysis_replay(expanded) or query_requests_full_analysis_replay(q):
        out["user_goal"] = "replay_deliverable"
        out["run_optional_agents"] = []
        return out
    if query_requests_fresh_external_data(q) or query_requests_fresh_external_data(expanded):
        out["user_goal"] = "new_analysis"
        if "service" not in branches:
            branches = ["service"]
        out["run_optional_agents"] = branches
        return out
    completed = branches_completed if branches_completed is not None else prior_analysis_branches_completed(state)
    explicit = resolve_explicit_optional_branches(expanded, state) or resolve_explicit_optional_branches(q, state)
    explicit_pick = bool(explicit) and set(branches) <= set(explicit)
    if out.get("user_goal") == "new_analysis" and branches:
        if (query_looks_like_explain_follow_up(q) or query_looks_like_explain_follow_up(expanded)) and all(
            b in completed for b in branches
        ):
            out["user_goal"] = "answer_from_context"
            out["run_optional_agents"] = []
            out["reason"] = ((out.get("reason") or "") + " [guardrail: explain follow-up, branches in prior analysis]").strip()
            return out
        if not explicit_pick and not query_requests_fresh_external_data(q) and not query_requests_fresh_external_data(expanded):
            needed = [b for b in branches if b not in completed]
            if not needed:
                out["user_goal"] = "answer_from_context"
                out["run_optional_agents"] = []
                out["reason"] = ((out.get("reason") or "") + " [guardrail: all requested branches already completed]").strip()
            else:
                out["run_optional_agents"] = needed
    return out


def intent_to_checkpoint_payload(intent: TurnIntentResult, payload: dict[str, Any]) -> dict[str, Any]:
    goal = intent.get("user_goal", "answer_from_context")
    branches = list(intent.get("run_optional_agents") or [])
    if goal == "replay_deliverable":
        return {**payload, "retrieval_only": False, "run_optional_agents": [], "user_goal": "replay_deliverable"}
    if goal == "new_analysis" and branches:
        return {**payload, "retrieval_only": False, "run_optional_agents": branches, "user_goal": "new_analysis"}
    return {**payload, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context"}
