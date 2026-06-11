"""Tests for ADK App + events compaction configuration."""

from __future__ import annotations

import importlib

import pytest
from google.adk.apps.app import EventsCompactionConfig


def test_events_compaction_config_requires_paired_token_fields():
    with pytest.raises(ValueError, match="must be set together"):
        EventsCompactionConfig(
            compaction_interval=100,
            overlap_size=1,
            token_threshold=50_000,
        )


def test_build_events_compaction_config_defaults(monkeypatch):
    monkeypatch.delenv("ADK_EVENTS_COMPACTION_DISABLED", raising=False)
    for key in (
        "ADK_COMPACTION_INTERVAL",
        "ADK_COMPACTION_OVERLAP_SIZE",
        "ADK_COMPACTION_TOKEN_THRESHOLD",
        "ADK_COMPACTION_EVENT_RETENTION_SIZE",
    ):
        monkeypatch.delenv(key, raising=False)

    from property_agent.runtime import app_config

    importlib.reload(app_config)
    config = app_config.build_events_compaction_config()

    assert config is not None
    # G4 session-diet defaults: ~65% of 200k effective executor context.
    assert config.token_threshold == 130_000
    assert config.event_retention_size == 32
    assert config.compaction_interval == 10_000


def test_build_events_compaction_config_disabled(monkeypatch):
    monkeypatch.setenv("ADK_EVENTS_COMPACTION_DISABLED", "1")

    from property_agent.runtime import app_config

    importlib.reload(app_config)
    assert app_config.build_events_compaction_config() is None

    importlib.reload(app_config)


def test_property_app_has_root_agent(monkeypatch):
    monkeypatch.delenv("ADK_EVENTS_COMPACTION_DISABLED", raising=False)

    from property_agent.runtime import app_config

    importlib.reload(app_config)
    app = app_config.build_property_app()

    assert app.name == "property_agent"
    assert app.root_agent.name == "property_agent"
    assert app.events_compaction_config is not None

    importlib.reload(app_config)
