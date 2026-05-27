"""Shared pytest fixtures for homecare agent unit tests."""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def disable_turn_intent_llm_in_unit_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unit tests must not call Vertex/Gemini (CI has no credentials)."""
    monkeypatch.setenv("TURN_INTENT_LLM_DISABLED", "1")
