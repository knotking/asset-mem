"""Session state helpers for ADK ``State`` objects."""

from __future__ import annotations

from typing import Any


def state_take(state: Any, key: str, default: Any = None) -> Any:
    """Read and clear a session state key (ADK ``State`` has no ``dict.pop``)."""
    if state is None or not hasattr(state, "get"):
        return default
    value = state.get(key, default)
    if hasattr(state, "__setitem__"):
        state[key] = None
    return value
