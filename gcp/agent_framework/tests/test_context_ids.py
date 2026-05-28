"""Tests for context id resolution."""

from __future__ import annotations

from types import SimpleNamespace

from agent_framework.state.context_ids import (
    resolve_auth_uid_from_context,
    resolve_correlation_id_from_context,
    resolve_user_id_from_context,
)


def test_resolve_user_id_from_state() -> None:
    ctx = SimpleNamespace(state={"user_id": "uid-1"}, session=None, user_id=None)
    assert resolve_user_id_from_context(ctx) == "uid-1"
    assert resolve_auth_uid_from_context(ctx) == "uid-1"


def test_resolve_correlation_id_from_session_state() -> None:
    ctx = SimpleNamespace(
        session=SimpleNamespace(state={"correlation_id": "req-abc"}),
    )
    assert resolve_correlation_id_from_context(ctx) == "req-abc"
