"""Tests for CONFORMANCE_USER_ID resolution."""

from __future__ import annotations

from property_agent.runtime.conformance_user import (
    DEFAULT_CONFORMANCE_USER_ID,
    resolve_conformance_user_id,
)


def test_default_conformance_user_id(monkeypatch) -> None:
    monkeypatch.delenv("CONFORMANCE_USER_ID", raising=False)
    assert resolve_conformance_user_id() == DEFAULT_CONFORMANCE_USER_ID


def test_conformance_user_id_from_env(monkeypatch) -> None:
    monkeypatch.setenv("CONFORMANCE_USER_ID", "NHnSq8V6BsWpREpm56tpCheADsr1")
    assert resolve_conformance_user_id() == "NHnSq8V6BsWpREpm56tpCheADsr1"
