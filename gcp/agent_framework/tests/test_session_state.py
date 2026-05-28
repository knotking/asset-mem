"""Tests for state_take."""

from __future__ import annotations

from agent_framework.state.session_state import state_take


def test_state_take_clears_key() -> None:
    state = {"key": "value"}
    assert state_take(state, "key") == "value"
    assert state["key"] is None


def test_state_take_missing_key() -> None:
    state = {}
    assert state_take(state, "missing", "default") == "default"
