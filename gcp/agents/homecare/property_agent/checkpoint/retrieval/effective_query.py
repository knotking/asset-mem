"""Resolve the effective user query for checkpoint retrieval tools."""

from __future__ import annotations

from typing import Any

from property_agent.routing.conversational_intent import resolve_user_query_from_state
from property_agent.routing.pending_user_action import is_short_reply


def resolve_effective_checkpoint_query(
    state: Any,
    user_query: str,
) -> str:
    """
    Prefer the expanded routing query in session state over a short tool arg.

    Accept-offer turns pass ``user_query='yes'`` to tools while
    ``state['user_query']`` holds the concrete task (e.g. inventory list).
    """
    tool_query = (user_query or "").strip()
    state_query = resolve_user_query_from_state(state)
    if state_query and tool_query:
        if tool_query.lower() == state_query.lower():
            return state_query
        if is_short_reply(tool_query) and len(state_query) > len(tool_query):
            return state_query
    return tool_query or state_query


__all__ = ["resolve_effective_checkpoint_query"]
