"""Apply and sanitize LLM resolve-turn JSON into checkpoint routing payloads."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from .checkpoint_selection import checkpoint_selection_changed
from .conversational_intent import (
    DEFAULT_CAPABILITY_OPTIONS,
    LAST_OFFERED_OPTIONS_KEY,
    OPTIONAL_CHECKPOINT_BRANCHES,
    prior_checkpoint_analysis_in_session,
    query_requests_full_analysis_replay,
    requests_checkpoint_optional_analysis,
    resolve_requested_optional_branches,
)
from .property_analysis_routing import filter_optional_branches_for_orchestrator
from .query_mode import (
    branches_mentioned_in_query,
    infer_query_mode,
    prior_analysis_branches_completed,
    query_looks_like_explain_follow_up,
    query_requests_fresh_external_data,
    should_answer_provider_from_context,
)
from .nlu_first_resolve import (
    CASUAL_DISCOURSE_ACTS,
    DISCOURSE_ACTS,
    apply_discourse_act_to_payload,
    nlu_first_resolve_enabled,
)
from .pending_user_action import consume_pending_for_resolve, get_pending_user_action
from .resolve_llm_schema import CHECKPOINT_QUERY_HINTS
from .schema import CASUAL_INTENTS, DiscourseActKind, FocusBranchKind, ResolvedTurn, UserGoalKind
from .turn_intent_llm import apply_turn_intent_guardrails, intent_to_checkpoint_payload

def normalize_substantive_route(payload: dict[str, Any]) -> dict[str, Any]:
    """Checkpoint work should not keep ``route=none`` after sanitize."""
    if payload.get("intent") in CASUAL_INTENTS:
        return payload
    if payload.get("discourse_act") in CASUAL_DISCOURSE_ACTS:
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


def follow_up_from_resolver(payload: dict[str, Any], *, user_query: str, state: Mapping[str, Any]) -> dict[str, Any]:
    from .conversational_intent import resolve_explicit_optional_branches
    expanded = str(payload.get("expanded_user_query") or user_query).strip()
    branches = list(payload.get("run_optional_agents") or [])
    explicit = resolve_explicit_optional_branches(expanded, state) or resolve_explicit_optional_branches(user_query, state)
    if not explicit:
        hinted = branches_mentioned_in_query(expanded) + branches_mentioned_in_query(user_query)
        explicit = [b for b in hinted if b in OPTIONAL_CHECKPOINT_BRANCHES]
    if explicit and not branches:
        branches = list(explicit)
    intent: dict[str, Any] = {"user_goal": ("new_analysis" if explicit and payload.get("user_goal") == "answer_from_context" else payload.get("user_goal") or "answer_from_context"), "run_optional_agents": branches, "reason": "resolve_llm_follow_up", "source": "resolver"}
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
    if checkpoint_selection_changed(state) and prior_checkpoint_analysis_in_session(state):
        requested = (
            resolve_requested_optional_branches(expanded, state)
            or resolve_requested_optional_branches(user_query, state)
            or branches_from_resolver_menu_hints(payload, state)
            or ui_optional_branches(state)
        )
        for branch in branches_mentioned_in_query(expanded) + branches_mentioned_in_query(user_query):
            if branch not in requested:
                requested.append(branch)
        # If the UI changed which checkpoints are selected, we must re-run checkpoint
        # retrieval/assembly even when the user only asks "are there issues?" (no
        # optional branches). Otherwise we keep answering from stale session memory.
        return {
            **payload,
            "retrieval_only": False,
            "run_optional_agents": requested or ui_optional_branches(state),
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
    return {**payload, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context"}


def _coerce_discourse_act(data: Mapping[str, Any]) -> DiscourseActKind:
    act = data.get("discourse_act")
    if act in DISCOURSE_ACTS:
        return act  # type: ignore[return-value]
    intent = data.get("intent")
    if intent == "greeting":
        return "greeting"
    if intent == "capabilities":
        return "capabilities"
    if intent == "acknowledgment":
        return "closure"
    if data.get("user_goal") == "replay_deliverable":
        return "replay_report"
    if data.get("run_optional_agents"):
        return "new_work"
    return "new_work"


def _coerce_focus_branch(data: Mapping[str, Any]) -> Optional[FocusBranchKind]:
    raw = data.get("focus_branch")
    if raw in ("checkpoint", "coverage", "diy", "service", "cost", "documents"):
        return raw  # type: ignore[return-value]
    return None


def apply_thin_invariants(
    payload: dict[str, Any],
    *,
    user_query: str,
    state: Mapping[str, Any],
) -> dict[str, Any]:
    """Deterministic invariants after NLU resolve — not intent inference."""
    out = dict(payload)
    act = str(out.get("discourse_act") or "")
    expanded = str(out.get("expanded_user_query") or user_query).strip()

    if act in ("explain_prior", "provider_detail", "closure"):
        out["run_optional_agents"] = []
        out["retrieval_only"] = True
        out["user_goal"] = "answer_from_context"

    if checkpoint_selection_changed(state) and prior_checkpoint_analysis_in_session(state):
        if act in ("explain_prior", "closure", "provider_detail"):
            pass
        else:
            requested = (
                branches_from_resolver_menu_hints(out, state)
                or list(out.get("run_optional_agents") or [])
            )
            for branch in branches_mentioned_in_query(expanded) + branches_mentioned_in_query(user_query):
                if branch not in requested and act == "new_work":
                    requested.append(branch)
            out = {
                **out,
                "discourse_act": "new_work",
                "intent": "substantive",
                "retrieval_only": False,
                "run_optional_agents": requested,
                "user_goal": "new_analysis",
            }

    provider_ctx = provider_context_payload(out, user_query=user_query, state=state)
    if provider_ctx is not None and act != "new_work":
        out = {**provider_ctx, "discourse_act": "provider_detail"}

    if query_requests_full_analysis_replay(expanded) or query_requests_full_analysis_replay(user_query):
        out = {
            **out,
            "discourse_act": "replay_report",
            "user_goal": "replay_deliverable",
            "retrieval_only": False,
            "run_optional_agents": [],
        }

    if act == "new_work" and out.get("run_optional_agents"):
        completed = prior_analysis_branches_completed(state)
        explicit = branches_from_resolver_menu_hints(out, state) or list(
            out.get("run_optional_agents") or []
        )
        explicit_pick = bool(explicit)
        fresh = query_requests_fresh_external_data(user_query) or query_requests_fresh_external_data(
            expanded
        )
        filtered = filter_optional_branches_for_orchestrator(
            list(out.get("run_optional_agents") or []),
            branches_completed=completed,
            explicit_pick=explicit_pick,
            fresh_external=fresh,
        )
        if not filtered and not fresh:
            out = {
                **out,
                "discourse_act": "explain_prior",
                "user_goal": "answer_from_context",
                "run_optional_agents": [],
                "retrieval_only": True,
            }
        else:
            out["run_optional_agents"] = filtered or list(out.get("run_optional_agents") or [])

    return out


def sanitize_llm_payload_nlu_first(
    data: dict[str, Any],
    *,
    user_query: str,
    state: Mapping[str, Any] | None = None,
) -> Optional[dict[str, Any]]:
    session = state or {}
    discourse_act = _coerce_discourse_act(data)
    focus_branch = _coerce_focus_branch(data)
    expanded = str(data.get("expanded_user_query") or user_query).strip() or (user_query or "").strip()
    route = data.get("route")
    if route == "knowledge_base":
        route = "none"
    elif route not in ("checkpoint", "user_docs", "report", "none"):
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
    branches = [
        str(b)
        for b in (data.get("run_optional_agents") or [])
        if str(b) in OPTIONAL_CHECKPOINT_BRANCHES
    ]
    base: dict[str, Any] = {
        "route": route,
        "expanded_user_query": expanded,
        "retrieval_only": bool(data.get("retrieval_only", True)),
        "run_optional_agents": branches,
        "user_goal": data.get("user_goal") or "answer_from_context",
        "menu_index": menu_index,
        "capability_key": cap,
        "focus_branch": focus_branch,
    }
    payload = apply_discourse_act_to_payload(
        base,
        discourse_act=discourse_act,
        focus_branch=focus_branch,
    )
    payload = consume_pending_for_resolve(
        payload,
        user_query=user_query,
        state=session,
        discourse_act=str(payload.get("discourse_act") or discourse_act),
    )
    if payload.get("intent") == "substantive" and payload.get("route") == "checkpoint":
        if payload.get("discourse_act") in ("explain_prior", "provider_detail"):
            payload = {
                **payload,
                "retrieval_only": True,
                "run_optional_agents": [],
                "user_goal": "answer_from_context",
            }
        elif payload.get("discourse_act") == "new_work" and not payload.get("run_optional_agents"):
            if prior_checkpoint_analysis_in_session(session) and not checkpoint_selection_changed(
                session
            ):
                payload = {
                    **payload,
                    "retrieval_only": True,
                    "run_optional_agents": [],
                    "user_goal": "answer_from_context",
                }
            else:
                payload = apply_checkpoint_retrieval_plan(
                    payload, user_query=user_query, state=session
                )
        elif payload.get("discourse_act") == "accept_offer":
            if not payload.get("run_optional_agents"):
                menu_branches = branches_from_resolver_menu_hints(payload, session)
                if menu_branches:
                    payload = {
                        **payload,
                        "run_optional_agents": menu_branches,
                        "user_goal": "new_analysis",
                        "retrieval_only": False,
                    }
        elif payload.get("discourse_act") == "new_work":
            payload = apply_checkpoint_retrieval_plan(payload, user_query=user_query, state=session)
    elif payload.get("intent") == "substantive" and payload.get("route") == "user_docs":
        payload = {
            **payload,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
        }
    elif payload.get("intent") == "substantive" and payload.get("route") == "report":
        payload = {
            **payload,
            "retrieval_only": True,
            "run_optional_agents": [],
            "user_goal": "answer_from_context",
        }
    payload = apply_thin_invariants(payload, user_query=user_query, state=session)
    payload = normalize_substantive_route(payload)
    if (
        get_pending_user_action(session)
        and payload.get("discourse_act") == "accept_offer"
        and hasattr(session, "__setitem__")
    ):
        from .pending_user_action import clear_pending_user_action

        clear_pending_user_action(session)
    return payload


def sanitize_llm_payload(data: dict[str, Any], *, user_query: str, state: Mapping[str, Any] | None = None) -> Optional[dict[str, Any]]:
    if nlu_first_resolve_enabled():
        return sanitize_llm_payload_nlu_first(data, user_query=user_query, state=state)
    intent = data.get("intent")
    if intent not in ("greeting", "capabilities", "acknowledgment", "substantive"):
        return None
    expanded = str(data.get("expanded_user_query") or user_query).strip() or (user_query or "").strip()
    if intent in CASUAL_INTENTS:
        return {"intent": intent, "route": "none", "expanded_user_query": expanded, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context", "menu_index": None, "capability_key": None}
    route = data.get("route")
    if route == "knowledge_base":
        route = "none"
    elif route not in ("checkpoint", "user_docs", "report", "none"):
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
    payload: dict[str, Any] = {"intent": "substantive", "route": route, "expanded_user_query": expanded, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context", "menu_index": menu_index, "capability_key": cap}
    if route == "checkpoint":
        payload = apply_checkpoint_retrieval_plan(payload, user_query=user_query, state=state or {})
    elif route == "user_docs":
        payload = {**payload, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context"}
    elif route == "report":
        payload = {**payload, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context"}
    elif route == "none":
        payload = {**payload, "retrieval_only": True, "run_optional_agents": [], "user_goal": "answer_from_context"}
    return payload


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


def coerce_user_goal(raw: Any, payload: Mapping[str, Any]) -> UserGoalKind:
    goal = payload.get("user_goal")
    if goal in ("answer_from_context", "new_analysis", "replay_deliverable"):
        return goal  # type: ignore[return-value]
    if raw in ("answer_from_context", "new_analysis", "replay_deliverable"):
        return raw  # type: ignore[return-value]
    if payload.get("retrieval_only"):
        return "answer_from_context"
    if query_requests_full_analysis_replay(str(payload.get("expanded_user_query") or "")):
        return "replay_deliverable"
    if payload.get("run_optional_agents") and goal != "answer_from_context":
        return "new_analysis"
    if not payload.get("retrieval_only"):
        return "new_analysis"
    return "answer_from_context"


def fallback_resolved_turn(user_query: str) -> ResolvedTurn:
    return ResolvedTurn(intent="substantive", route="checkpoint", expanded_user_query=user_query or "Help with my property.", retrieval_only=True, run_optional_agents=[], user_goal="answer_from_context", resolve_source="fallback")


def payload_to_resolved(payload: dict[str, Any], *, state: Mapping[str, Any] | None = None, user_query: str = "") -> ResolvedTurn:
    if payload.get("route") == "checkpoint" and state is not None:
        enforced = provider_context_payload(payload, user_query=user_query, state=state)
        if enforced is not None:
            payload = enforced
    user_goal = coerce_user_goal(payload.get("user_goal"), payload)
    optional = list(payload.get("run_optional_agents") or [])
    discourse = payload.get("discourse_act")
    focus = payload.get("focus_branch")
    return ResolvedTurn(
        intent=payload["intent"],
        route=payload["route"],
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
        discourse_act=discourse if discourse in DISCOURSE_ACTS else None,
        focus_branch=focus if focus in (
            "checkpoint", "coverage", "diy", "service", "cost", "documents",
        ) else None,
        resolve_source="llm",
    )
