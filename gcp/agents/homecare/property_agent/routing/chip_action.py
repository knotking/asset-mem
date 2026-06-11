"""Deterministic ResolvedTurn from client chip taps.

Suggested-action chips carry a structured ``action`` object; clients echo it
back as ``chip_action`` in the chat request. When present, routing is fully
deterministic with ``resolve_source="chip"``.

Free-text turns (including typed "yes" replies to offers) are unaffected.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

from .optional_branches import OPTIONAL_CHECKPOINT_BRANCHES
from .schema import ResolvedTurn

logger = logging.getLogger(__name__)

CHIP_ACTION_STATE_KEY = "chip_action"

_DISCUSS_TOPICS = frozenset(
    {"checkpoint", "coverage", "diy", "service", "cost", "documents"}
)


@dataclass(frozen=True)
class ChipAction:
    type: str  # "run_branch" | "discuss" | "replay_report"
    branch: Optional[str] = None
    topic: Optional[str] = None


def parse_chip_action(value: Any) -> Optional[ChipAction]:
    """Validate a client chip_action payload; None when malformed/unknown."""
    if not isinstance(value, dict):
        return None
    kind = str(value.get("type") or "").strip()
    if kind == "run_branch":
        branch = str(value.get("branch") or "").strip()
        if branch not in OPTIONAL_CHECKPOINT_BRANCHES:
            return None
        return ChipAction(type="run_branch", branch=branch)
    if kind == "discuss":
        topic = str(value.get("topic") or "").strip() or None
        if topic is not None and topic not in _DISCUSS_TOPICS:
            topic = None
        return ChipAction(type="discuss", topic=topic)
    if kind == "replay_report":
        return ChipAction(type="replay_report")
    return None


def take_chip_action(state: Any) -> Optional[ChipAction]:
    """Read and consume ``chip_action`` from session state.

    Consume-once: session state persists across turns, so a stale chip action
    must never leak into the next free-text turn.
    """
    if state is None or not hasattr(state, "get"):
        return None
    raw = state.get(CHIP_ACTION_STATE_KEY)
    if raw is None:
        return None
    if hasattr(state, "__setitem__"):
        state[CHIP_ACTION_STATE_KEY] = None
    return parse_chip_action(raw)


def resolved_turn_from_chip_action(
    action: ChipAction,
    *,
    user_query: str,
) -> ResolvedTurn:
    """Map a validated chip action to the executor's ResolvedTurn."""
    expanded = (user_query or "").strip()
    if action.type == "run_branch":
        branch = str(action.branch)
        return ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query=expanded or f"Run {branch} analysis",
            retrieval_only=False,
            run_optional_agents=[branch],
            user_goal="new_analysis",
            query_mode="branch_explicit",
            discourse_act="new_work",
            focus_branch=branch,  # type: ignore[arg-type]
            resolve_source="chip",
        )
    if action.type == "replay_report":
        return ResolvedTurn(
            intent="substantive",
            route="checkpoint",
            expanded_user_query=expanded or "Show the full analysis report again",
            retrieval_only=True,
            run_optional_agents=[],
            user_goal="replay_deliverable",
            query_mode="interpret_session",
            discourse_act="replay_report",
            resolve_source="chip",
        )
    # discuss
    return ResolvedTurn(
        intent="substantive",
        route="checkpoint",
        expanded_user_query=expanded or "Explain the prior analysis in more detail",
        retrieval_only=True,
        run_optional_agents=[],
        user_goal="answer_from_context",
        query_mode="interpret_session",
        discourse_act="explain_prior",
        focus_branch=action.topic,  # type: ignore[arg-type]
        resolve_source="chip",
    )


def resolve_turn_from_chip(
    state: Any,
    *,
    user_query: str,
) -> Optional[ResolvedTurn]:
    """Deterministic chip fast-path; None when no (valid) chip action present."""
    action = take_chip_action(state)
    if action is None:
        return None
    resolved = resolved_turn_from_chip_action(action, user_query=user_query)

    # A chip tap supersedes any dangling assistant offer; clearing prevents the
    # next short reply from accidentally accepting a stale offer.
    from .pending_user_action import clear_pending_user_action

    clear_pending_user_action(state)

    logger.info(
        "resolve_turn chip type=%s branch=%s topic=%s route=%s retrieval_only=%s "
        "optional=%r query=%r",
        action.type,
        action.branch,
        action.topic,
        resolved.route,
        resolved.retrieval_only,
        resolved.run_optional_agents,
        (user_query or "")[:80],
    )
    try:
        from property_agent.metrics.routing_metrics import record_routing_turn

        record_routing_turn(
            intent=resolved.intent,
            route=resolved.route,
            prompt_text="",
            elapsed_ms=0.0,
            executor_skipped=False,
        )
    except Exception:
        logger.debug("chip resolve metrics skipped", exc_info=True)
    return resolved
