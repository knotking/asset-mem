"""Tests for optional conversation_summary (disabled by default)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from property_agent.routing.conversation_summary import (
    conversation_summary_enabled,
    maybe_update_conversation_summary,
)


def test_conversation_summary_disabled_by_default(monkeypatch) -> None:
    monkeypatch.delenv("HOMEAPP_CONVERSATION_SUMMARY", raising=False)
    assert conversation_summary_enabled() is False

    state: dict[str, object] = {}
    maybe_update_conversation_summary(state, [])
    assert "conversation_summary" not in state


def test_conversation_summary_skips_llm_when_disabled(monkeypatch) -> None:
    monkeypatch.delenv("HOMEAPP_CONVERSATION_SUMMARY", raising=False)
    state: dict[str, object] = {}
    with patch(
        "property_agent.routing.conversation_summary.flash_lite_model_client"
    ) as mock_client:
        maybe_update_conversation_summary(state, [MagicMock()] * 20)
    mock_client.assert_not_called()


def test_conversation_summary_enabled_when_env_set(monkeypatch) -> None:
    monkeypatch.setenv("HOMEAPP_CONVERSATION_SUMMARY", "1")
    assert conversation_summary_enabled() is True
