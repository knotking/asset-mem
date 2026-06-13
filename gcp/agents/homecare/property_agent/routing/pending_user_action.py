"""Pending user action state for short affirmations after assistant offers."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any, Literal, Mapping, Optional

from .conversational_intent import (
    DEFAULT_CAPABILITY_OPTIONS,
    LAST_OFFERED_OPTIONS_KEY,
    is_closure_phrase,
    normalize_user_query,
)
from .optional_branches import OPTIONAL_CHECKPOINT_BRANCHES

PENDING_USER_ACTION_KEY = "pending_user_action"

PendingKind = Literal["run_branch", "pick_capability", "confirm_action"]

_SHORT_REPLY_RE = re.compile(
    r"^(?:yes|yeah|yep|yup|ok(?:ay)?|sure|alright|fine|k|kk|please|do it|go ahead"
    r"|sounds good|that works)(?:[.!]?)$",
    re.IGNORECASE,
)

@dataclass
class PendingUserAction:
    kind: PendingKind
    expanded_user_query: str
    run_optional_agents: list[str]
    capability_key: Optional[str] = None
    offered_summary: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def is_short_reply(user_query: str) -> bool:
    normalized = normalize_user_query(user_query)
    if not normalized:
        return False
    if len(normalized.split()) <= 3 and _SHORT_REPLY_RE.match(normalized):
        return True
    return bool(_SHORT_REPLY_RE.match(normalized))


def get_pending_user_action(state: Mapping[str, Any] | None) -> Optional[PendingUserAction]:
    if not state:
        return None
    raw = state.get(PENDING_USER_ACTION_KEY)
    if not isinstance(raw, dict):
        return None
    try:
        return PendingUserAction(
            kind=raw.get("kind", "confirm_action"),
            expanded_user_query=str(raw.get("expanded_user_query") or ""),
            run_optional_agents=list(raw.get("run_optional_agents") or []),
            capability_key=raw.get("capability_key"),
            offered_summary=raw.get("offered_summary"),
        )
    except (TypeError, ValueError):
        return None


def set_pending_user_action(state: Any, pending: PendingUserAction) -> None:
    if state is None or not hasattr(state, "__setitem__"):
        return
    state[PENDING_USER_ACTION_KEY] = pending.to_dict()


def clear_pending_user_action(state: Any) -> None:
    if state is None or not hasattr(state, "__setitem__"):
        return
    state[PENDING_USER_ACTION_KEY] = None


def consume_pending_for_resolve(
    payload: dict[str, Any],
    *,
    user_query: str,
    state: Mapping[str, Any] | None,
    discourse_act: str,
) -> dict[str, Any]:
    """Apply pending offer when resolve says accept_offer (or short reply + pending)."""
    pending = get_pending_user_action(state)
    if pending is None:
        return payload
    act = discourse_act
    if act not in ("accept_offer",) and is_short_reply(user_query) and not is_closure_phrase(
        user_query
    ):
        act = "accept_offer"
    if act != "accept_offer":
        return payload
    out = dict(payload)
    out["discourse_act"] = "accept_offer"
    out["intent"] = "substantive"
    expanded = (pending.expanded_user_query or "").strip()
    if expanded:
        out["expanded_user_query"] = expanded
    branches = list(pending.run_optional_agents or [])
    cap = pending.capability_key
    if pending.kind == "pick_capability" and not branches and not cap:
        menu = state.get(LAST_OFFERED_OPTIONS_KEY) if state else None
        if not isinstance(menu, list) or not menu:
            menu = list(DEFAULT_CAPABILITY_OPTIONS)
        cap = str(menu[0]) if menu else None
    if cap in OPTIONAL_CHECKPOINT_BRANCHES and cap not in branches:
        branches.append(str(cap))
    if cap in DEFAULT_CAPABILITY_OPTIONS:
        out["capability_key"] = cap
        if cap == "checkpoints":
            out["route"] = "checkpoint"
        elif cap == "documents":
            out["route"] = "user_docs"
    if branches:
        out["run_optional_agents"] = branches
        out["user_goal"] = "new_analysis"
        out["retrieval_only"] = False
        out["route"] = out.get("route") or "checkpoint"
    elif pending.kind == "confirm_action":
        out["user_goal"] = out.get("user_goal") or "answer_from_context"
        out["retrieval_only"] = True
    return out


def resolve_turn_from_pending_offer(
    state: Any,
    *,
    user_query: str,
) -> Optional[Any]:
    """Deterministic accept-offer fast-path when user short-replies to a pending offer."""
    from agent_platform.core.routing.fast_paths import (
        AcceptOfferFastPathHooks,
        default_is_short_affirmative_reply,
        try_accept_offer_fast_path,
    )

    from .conversational_intent import is_closure_phrase
    from .schema import resolved_turn_from_state
    from .single_loop_common import minimal_substantive_resolved_turn
    from agent_platform.core.routing.resolved_turn import RESOLVED_TURN_STATE_KEY

    class _AcceptHooks(AcceptOfferFastPathHooks):
        def get_pending_offer(self, work: Any) -> Any | None:
            return get_pending_user_action(work)

        def is_accept_reply(self, query: str, *, state: Any) -> bool:
            _ = state
            return default_is_short_affirmative_reply(
                query, closure_checker=is_closure_phrase
            )

        def build_base_substantive_turn(self, work: Any, *, user_query: str) -> Any:
            return minimal_substantive_resolved_turn(work, user_query=user_query)

        def apply_pending_to_turn(
            self, base_turn: Any, *, user_query: str, state: Any
        ) -> Any | None:
            payload = consume_pending_for_resolve(
                {**base_turn.to_dict(), "resolve_source": "single_loop"},
                user_query=user_query,
                state=state,
                discourse_act="accept_offer",
            )
            if payload.get("discourse_act") != "accept_offer":
                return None
            return resolved_turn_from_state({RESOLVED_TURN_STATE_KEY: payload})

        def clear_pending_offer(self, work: Any) -> None:
            clear_pending_user_action(work)

    return try_accept_offer_fast_path(
        state, user_query=user_query, hooks=_AcceptHooks()
    )
