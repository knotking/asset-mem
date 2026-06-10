"""Session helpers for checkpoint pipeline input staging."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from property_agent.checkpoint.constants import (
    _VALID_OPTIONAL_BRANCHES,
)

logger = logging.getLogger(__name__)


def normalize_checkpoint_optional_agents(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return list(
        dict.fromkeys(str(x) for x in value if str(x) in _VALID_OPTIONAL_BRANCHES)
    )


def optional_agents_for_progress_from_state(state: Any) -> List[str]:
    if not hasattr(state, "get"):
        return []
    from property_agent.routing.resolve_turn import resolved_turn_from_state

    resolved = resolved_turn_from_state(state)
    if (
        resolved is not None
        and resolved.run_optional_agents
        and not resolved.retrieval_only
    ):
        return list(
            dict.fromkeys(
                b for b in resolved.run_optional_agents if b in _VALID_OPTIONAL_BRANCHES
            )
        )
    return normalize_checkpoint_optional_agents(state.get("checkpoint_optional_agents"))


def should_run_optional_analysis(state: Any, user_query: str) -> bool:
    agents = optional_agents_for_progress_from_state(state)
    if not agents:
        return False
    from property_agent.routing.resolve_turn import resolved_turn_from_state

    resolved = resolved_turn_from_state(state)
    if resolved is not None:
        return not resolved.retrieval_only and bool(resolved.run_optional_agents)
    from property_agent.routing.conversational_intent import (
        requests_checkpoint_optional_analysis,
    )

    return requests_checkpoint_optional_analysis(user_query, state=state)


def checkpoint_ids_for_pipeline_from_state(state: Any) -> List[str]:
    """UI-selected checkpoint document ids (Firestore), not executor-invented slugs."""
    if not hasattr(state, "get"):
        return []
    raw = state.get("checkpoint_ids")
    if not isinstance(raw, list):
        return []
    return [str(x).strip() for x in raw if x is not None and str(x).strip()]


def apply_session_checkpoint_ids_to_tool_args(state: Any, args: Dict[str, Any]) -> None:
    """Force ``run_checkpoint_pipeline`` ids to match session UI selection only."""
    if not isinstance(args, dict):
        return
    session_ids = checkpoint_ids_for_pipeline_from_state(state)
    executor_ids = args.get("checkpoint_ids")
    if isinstance(executor_ids, list) and executor_ids:
        executor_set = {
            str(x).strip() for x in executor_ids if x is not None and str(x).strip()
        }
        session_set = set(session_ids)
        if executor_set != session_set:
            dropped = sorted(executor_set - session_set)
            logger.info(
                "before_tool: dropped executor checkpoint_ids not in UI selection "
                "dropped=%r session_ids=%r",
                dropped,
                session_ids,
            )
    args["checkpoint_ids"] = session_ids or None


def sync_checkpoint_tool_args_to_state(state: Any, args: Dict[str, Any]) -> None:
    from property_agent.checkpoint.constants import CHECKPOINT_SESSION_INPUT_KEYS

    if not hasattr(state, "__setitem__") or not isinstance(args, dict):
        return
    for key in CHECKPOINT_SESSION_INPUT_KEYS:
        if key in args and args[key] is not None:
            state[key] = args[key]
