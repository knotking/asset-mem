"""Tests for Agent Engine AdkApp runner wiring."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from property_agent.vertex_adk_app import HomecareAdkApp
from property_agent.app_config import property_app


def test_homecare_adk_app_wires_runner_with_property_app():
    adk = HomecareAdkApp(agent=property_app.root_agent, enable_tracing=False)
    adk._tmpl_attrs = {
        "app_name": "test-engine-id",
        "session_service": MagicMock(),
        "artifact_service": MagicMock(),
        "memory_service": MagicMock(),
        "credential_service": MagicMock(),
        "in_memory_session_service": MagicMock(),
        "in_memory_artifact_service": MagicMock(),
        "in_memory_memory_service": MagicMock(),
    }

    with patch.object(HomecareAdkApp, "set_up", wraps=adk._wire_runners_with_property_app):
        adk._wire_runners_with_property_app()

    runner = adk._tmpl_attrs["runner"]
    assert runner.app is property_app
    assert runner.app.events_compaction_config is not None
    assert adk._tmpl_attrs["in_memory_runner"].app is property_app
