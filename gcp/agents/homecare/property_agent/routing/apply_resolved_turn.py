"""Checkpoint retrieval-plan helpers (used by tests and legacy post-process paths)."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from .checkpoint_selection import checkpoint_selection_changed, checkpoint_selection_cleared
from .constants import CHECKPOINT_QUERY_HINTS
from .conversational_intent import (
    DEFAULT_CAPABILITY_OPTIONS,
    LAST_OFFERED_OPTIONS_KEY,
    OPTIONAL_CHECKPOINT_BRANCHES,
    prior_checkpoint_analysis_in_session,
    query_requests_full_analysis_replay,
    requests_checkpoint_optional_analysis,
    resolve_explicit_optional_branches,
    resolve_requested_optional_branches,
)
from .property_analysis_routing import filter_optional_branches_for_orchestrator
from .query_mode import (
    branches_mentioned_in_query,
    prior_analysis_branches_completed,
    query_looks_like_explain_follow_up,
    query_requests_checkpoint_inventory,
    query_requests_fresh_external_data,
    should_answer_provider_from_context,
)
from .schema import CASUAL_INTENTS


def normalize_substantive_route(payload: dict[str, Any]) -> dict[str, Any]:
    """Checkpoint work should not keep ``route=none`` after sanitize."""
    if payload.get("intent") in CASUAL_INTENTS:
        return payload
    branches = list(payload.get("run_optional_agents") or [])
    needs_checkpoint_route = bool(branches) or (
        payload.get("user_goal") == "new_analysis" and not payload.get("retrieval_only")
    )
    if needs_checkpoint_route and payload.get("route") == "none":
        return {**payload, "route": "checkpoint"}
    return payload


def branches_from_resolver_menu_hints(payload: Mapping[str, Any], state: Mapping[str, Any]) -> list[str]:
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


def ui_optional_branches(state: Mapping[str, Any]) -> list[str]:
    ui = state.get("checkpoint_optional_agents") or state.get("_checkpoint_optional_agents_ui")
    if not isinstance(ui, list):
        return []
    return [str(b) for b in ui if str(b) in OPTIONAL_CHECKPOINT_BRANCHES]


def provider_context_payload(payload: dict[str, Any], *, user_query: str, state: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    expanded = str(payload.get("expanded_user_query") or user_query).strip()
    if should_answer_provider_from_context(expanded, state=state) or should_answer_provider_from_context(user_query, state=state):
        return {**payload, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context", "menu_index": None, "capability_key": None}
    return None


def apply_turn_intent_guardrails(
    intent: dict[str, Any],
    *,
    user_query: str,
    expanded_user_query: str,
    state: Mapping[str, Any],
    branches_completed: Optional[frozenset[str]] = None,
) -> dict[str, Any]:
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


def intent_to_checkpoint_payload(intent: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    goal = intent.get("user_goal", "answer_from_context")
    branches = list(intent.get("run_optional_agents") or [])
    if goal == "replay_deliverable":
        return {**payload, "retrieval_only": False, "run_optional_agents": [], "user_goal": "replay_deliverable"}
    if goal == "new_analysis" and branches:
        return {**payload, "retrieval_only": False, "run_optional_agents": branches, "user_goal": "new_analysis"}
    return {**payload, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context"}


def follow_up_from_resolver(payload: dict[str, Any], *, user_query: str, state: Mapping[str, Any]) -> dict[str, Any]:
    expanded = str(payload.get("expanded_user_query") or user_query).strip()
    branches = list(payload.get("run_optional_agents") or [])
    explicit = resolve_explicit_optional_branches(expanded, state) or resolve_explicit_optional_branches(user_query, state)
    if not explicit:
        hinted = branches_mentioned_in_query(expanded) + branches_mentioned_in_query(user_query)
        explicit = [b for b in hinted if b in OPTIONAL_CHECKPOINT_BRANCHES]
    if explicit and not branches:
        branches = list(explicit)
    intent: dict[str, Any] = {
        "user_goal": ("new_analysis" if explicit and payload.get("user_goal") == "answer_from_context" else payload.get("user_goal") or "answer_from_context"),
        "run_optional_agents": branches,
        "reason": "resolver_follow_up",
        "source": "resolver",
    }
    completed = prior_analysis_branches_completed(state)
    guarded = apply_turn_intent_guardrails(intent, user_query=user_query, expanded_user_query=expanded, state=state, branches_completed=completed)
    if explicit and guarded.get("user_goal") != "new_analysis" and not query_looks_like_explain_follow_up(user_query) and not query_looks_like_explain_follow_up(expanded):
        guarded = {**guarded, "user_goal": "new_analysis", "run_optional_agents": list(explicit), "reason": ((guarded.get("reason") or "") + " [explicit branch pick]").strip()}
    explicit_pick = bool(explicit) and set(guarded.get("run_optional_agents") or []) <= set(explicit)
    fresh = query_requests_fresh_external_data(user_query) or query_requests_fresh_external_data(expanded)
    if guarded.get("user_goal") == "new_analysis":
        deduped = list(dict.fromkeys(list(guarded.get("run_optional_agents") or [])))
        guarded["run_optional_agents"] = deduped
        filtered = filter_optional_branches_for_orchestrator(deduped, branches_completed=completed, explicit_pick=explicit_pick, fresh_external=fresh)
        if not filtered:
            guarded = {**guarded, "user_goal": "answer_from_context", "run_optional_agents": [], "reason": ((guarded.get("reason") or "") + " [branches already completed]").strip()}
        else:
            guarded["run_optional_agents"] = filtered
    return intent_to_checkpoint_payload(guarded, payload)


def apply_checkpoint_retrieval_plan(payload: dict[str, Any], *, user_query: str, state: Mapping[str, Any]) -> dict[str, Any]:
    if payload.get("route") != "checkpoint":
        return payload
    expanded = str(payload.get("expanded_user_query") or user_query).strip()
    provider_ctx = provider_context_payload(payload, user_query=user_query, state=state)
    if provider_ctx is not None:
        return provider_ctx
    if query_requests_full_analysis_replay(expanded) or query_requests_full_analysis_replay(user_query):
        return {**payload, "retrieval_only": False, "run_optional_agents": [], "user_goal": "replay_deliverable"}
    if prior_checkpoint_analysis_in_session(state) and not checkpoint_selection_changed(state):
        return follow_up_from_resolver(payload, user_query=user_query, state=state)
    if checkpoint_selection_changed(state):
        if checkpoint_selection_cleared(state):
            return {
                **payload,
                "retrieval_only": True,
                "run_optional_agents": [],
                "user_goal": "new_analysis",
            }
        if prior_checkpoint_analysis_in_session(state):
            requested = (
                resolve_requested_optional_branches(expanded, state)
                or resolve_requested_optional_branches(user_query, state)
                or branches_from_resolver_menu_hints(payload, state)
                or ui_optional_branches(state)
            )
            for branch in branches_mentioned_in_query(expanded) + branches_mentioned_in_query(
                user_query
            ):
                if branch not in requested:
                    requested.append(branch)
            return {
                **payload,
                "retrieval_only": False,
                "run_optional_agents": requested or ui_optional_branches(state),
                "user_goal": "new_analysis",
            }
        return {
            **payload,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "new_analysis",
        }
    requested = resolve_requested_optional_branches(expanded, state) or resolve_requested_optional_branches(user_query, state) or branches_from_resolver_menu_hints(payload, state)
    for branch in branches_mentioned_in_query(expanded) + branches_mentioned_in_query(user_query):
        if branch not in requested:
            requested.append(branch)
    if requested:
        return {**payload, "retrieval_only": False, "run_optional_agents": requested, "user_goal": "new_analysis"}
    if requests_checkpoint_optional_analysis(expanded, state=state) or requests_checkpoint_optional_analysis(user_query, state=state):
        provider_ctx = provider_context_payload(payload, user_query=user_query, state=state)
        if provider_ctx is not None:
            return provider_ctx
        return {**payload, "retrieval_only": False, "run_optional_agents": ui_optional_branches(state), "user_goal": "new_analysis"}
    if query_requests_checkpoint_inventory(expanded) or query_requests_checkpoint_inventory(
        user_query
    ):
        return {
            **payload,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "new_analysis",
        }
    if not prior_checkpoint_analysis_in_session(state):
        return {
            **payload,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "new_analysis",
        }
    return {**payload, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context"}


def query_looks_checkpoint_focused(query: str) -> bool:
    q = (query or "").lower()
    return any(hint in q for hint in CHECKPOINT_QUERY_HINTS)


def apply_primary_agent_constraints(payload: dict[str, Any], *, state: Mapping[str, Any], user_query: str) -> dict[str, Any]:
    primary = str(state.get("primary_agent") or "").strip().lower()
    if payload.get("intent") in CASUAL_INTENTS:
        return payload
    expanded = str(payload.get("expanded_user_query") or user_query).strip()
    if primary == "docs":
        has_docs = bool(state.get("context_doc_uris"))
        if query_looks_checkpoint_focused(expanded) and state.get("checkpoint_ids"):
            return {**payload, "route": "checkpoint", "retrieval_only": True, "run_optional_agents": [], "capability_key": "checkpoints"}
        return {**payload, "route": "user_docs", "retrieval_only": True, "run_optional_agents": [], "menu_index": None, "capability_key": "documents" if has_docs else payload.get("capability_key")}
    if primary == "checkpoint":
        if payload.get("route") == "user_docs" and query_looks_checkpoint_focused(expanded):
            return {**payload, "route": "checkpoint"}
        return payload
    if primary == "report":
        has_reports = bool(state.get("report_ids"))
        return {
            **payload,
            "route": "report",
            "retrieval_only": True,
            "run_optional_agents": [],
            "menu_index": None,
            "capability_key": "reports" if has_reports else payload.get("capability_key"),
        }
    return payload
