"""Tests for Agent Engine AdkApp runner wiring."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from google.adk.runners import Runner

from property_agent.runtime.homecare_runner import HomecareRunner
from property_agent.vertex_app import HomecareAdkApp
from property_agent.runtime.app_config import property_app


async def _empty_stream():
    if False:
        yield {}
    return


@pytest.mark.asyncio
async def test_async_stream_query_replaces_stock_runner():
    with patch("property_agent.vertex_app.AdkApp.__init__", return_value=None):
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
        "runner": Runner(
            agent=property_app.root_agent,
            app_name="test-engine-id",
            session_service=MagicMock(),
        ),
    }

    with (
        patch.object(
            HomecareAdkApp,
            "_wire_runners_with_property_app",
            wraps=adk._wire_runners_with_property_app,
        ) as wire,
        patch(
            "property_agent.vertex_app.AdkApp.async_stream_query",
            return_value=_empty_stream(),
        ),
    ):
        async for _ in adk.async_stream_query(message="hello", user_id="user-1"):
            pass

    wire.assert_called_once()
    assert isinstance(adk._tmpl_attrs["runner"], HomecareRunner)


def test_stream_query_routes_through_async_multiplex(monkeypatch: pytest.MonkeyPatch):
    with patch("property_agent.vertex_app.AdkApp.__init__", return_value=None):
        adk = HomecareAdkApp(agent=property_app.root_agent, enable_tracing=False)
    adk._tmpl_attrs = {"runner": MagicMock()}
    monkeypatch.setattr(adk, "_ensure_homecare_runner", lambda: None)

    async def _fake_async_stream_query(**_kwargs):
        yield {"author": "checkpoint_analysis_progress", "invocation_id": "e-1"}
        yield {"author": "property_agent", "invocation_id": "e-1"}

    monkeypatch.setattr(adk, "async_stream_query", _fake_async_stream_query)
    monkeypatch.setattr(
        "property_agent.vertex_app.checkpoint_progress_streaming_enabled",
        lambda: True,
    )

    events = list(
        adk.stream_query(message="hello", user_id="user-1", session_id="sess-1")
    )
    assert any(e.get("author") == "checkpoint_analysis_progress" for e in events)


def test_unpickle_clears_stock_runner_so_set_up_can_wire_homecare_runner():
    with patch("property_agent.vertex_app.AdkApp.__init__", return_value=None):
        adk = HomecareAdkApp(agent=property_app.root_agent, enable_tracing=False)
    stock = Runner(
        agent=property_app.root_agent,
        app_name="test-engine-id",
        session_service=MagicMock(),
    )
    adk._tmpl_attrs = {
        "runner": stock,
        "in_memory_runner": stock,
        "session_service": MagicMock(),
        "artifact_service": MagicMock(),
        "memory_service": MagicMock(),
        "credential_service": MagicMock(),
        "in_memory_session_service": MagicMock(),
        "in_memory_artifact_service": MagicMock(),
        "in_memory_memory_service": MagicMock(),
        "app_name": "test-engine-id",
    }
    import cloudpickle

    loaded = cloudpickle.loads(cloudpickle.dumps(adk))
    assert loaded._tmpl_attrs.get("runner") is None
    assert loaded._tmpl_attrs.get("in_memory_runner") is None


def test_homecare_adk_app_wires_runner_with_property_app():
    # AdkApp.__init__ resolves GCP project/credentials; not available in CI.
    with patch("property_agent.vertex_app.AdkApp.__init__", return_value=None):
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

    with patch.object(
        HomecareAdkApp, "set_up", wraps=adk._wire_runners_with_property_app
    ):
        adk._wire_runners_with_property_app()

    runner = adk._tmpl_attrs["runner"]
    assert runner.app is property_app
    assert runner.app.events_compaction_config is not None
    assert adk._tmpl_attrs["in_memory_runner"].app is property_app
