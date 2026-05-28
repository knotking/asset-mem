"""Session helpers for checkpoint pipeline input staging."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from property_agent.checkpoint.constants import (
    CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY,
    CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY,
    _VALID_OPTIONAL_BRANCHES,
)

logger = logging.getLogger(__name__)


def normalize_checkpoint_optional_agents(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(x) for x in value if str(x) in _VALID_OPTIONAL_BRANCHES]


def checkpoint_results_text_from_state(state: Any) -> Optional[str]:
    if not hasattr(state, "get"):
        return None
    for key in ("checkpoint_results", "checkpoint_result"):
        raw = state.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


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
        return [
            b for b in resolved.run_optional_agents if b in _VALID_OPTIONAL_BRANCHES
        ]
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

    return requests_checkpoint_optional_analysis(user_query, state)


def build_checkpoint_analysis_pending_payload(state: Any) -> Optional[Dict[str, Any]]:
    if not hasattr(state, "get"):
        return None
    requested = optional_agents_for_progress_from_state(state)
    if not requested:
        return None
    checkpoint_results = checkpoint_results_text_from_state(state)
    if not checkpoint_results:
        return None
    user_query = state.get("user_query")
    if not isinstance(user_query, str):
        user_query = ""
    search_query = state.get(CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY)
    if not isinstance(search_query, str):
        search_query = ""
    payload: Dict[str, Any] = {
        "checkpoint_results": checkpoint_results.strip(),
        "user_query": user_query,
        "search_query": search_query,
        "checkpoint_optional_agents": requested,
    }
    for key in (
        "context_doc_uris",
        "property_address",
        "property_id",
        "search_location",
    ):
        value = state.get(key)
        if value is not None:
            payload[key] = value
    return payload


def ensure_checkpoint_analysis_pending_stashed(state: Any) -> bool:
    if not hasattr(state, "get"):
        return False
    existing = state.get(CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY)
    if isinstance(existing, str) and existing.strip():
        return True
    if isinstance(existing, dict) and existing:
        return True
    payload = build_checkpoint_analysis_pending_payload(state)
    if payload is None:
        return False
    state[CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY] = json.dumps(
        payload, ensure_ascii=False
    )
    logger.info(
        "checkpoint session: ensured pending analysis input branches=%s blob_len=%d",
        payload.get("checkpoint_optional_agents"),
        len(str(payload.get("checkpoint_results") or "")),
    )
    return True


def sync_checkpoint_tool_args_to_state(state: Any, args: Dict[str, Any]) -> None:
    from property_agent.checkpoint.constants import CHECKPOINT_SESSION_INPUT_KEYS

    if not hasattr(state, "__setitem__") or not isinstance(args, dict):
        return
    for key in CHECKPOINT_SESSION_INPUT_KEYS:
        if key in args and args[key] is not None:
            state[key] = args[key]
