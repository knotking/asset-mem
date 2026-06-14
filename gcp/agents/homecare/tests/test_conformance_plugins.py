"""Tests for conformance plugin wiring."""

from __future__ import annotations

import pytest

from property_agent.runtime.conformance_plugins import (
    conformance_plugin_mode,
    load_conformance_plugins,
)


def test_load_conformance_plugins_empty_by_default(monkeypatch) -> None:
    monkeypatch.delenv("HOMEAPP_ADK_CONFORMANCE_PLUGINS", raising=False)
    assert load_conformance_plugins() == []


def test_load_conformance_plugins_replay_mode(monkeypatch) -> None:
    monkeypatch.setenv("HOMEAPP_ADK_CONFORMANCE_PLUGINS", "replay")
    plugins = load_conformance_plugins()
    assert len(plugins) == 1
    assert plugins[0].name == "adk_replay"


def test_conformance_plugin_mode_rejects_unknown(monkeypatch) -> None:
    monkeypatch.setenv("HOMEAPP_ADK_CONFORMANCE_PLUGINS", "invalid")
    with pytest.raises(ValueError, match="HOMEAPP_ADK_CONFORMANCE_PLUGINS"):
        conformance_plugin_mode()
