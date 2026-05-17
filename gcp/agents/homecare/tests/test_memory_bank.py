"""Tests for Vertex Memory Bank ingest helpers."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from google.adk.events.event import Event
from google.adk.events.event_actions import EventActions, EventCompaction
from google.genai import types

from property_agent.memory_bank import (
    build_ingest_custom_metadata,
    invocation_used_doculink,
    memory_stream_id,
    resolve_property_id,
    select_events_for_memory_ingest,
)


def _text_event(*, author: str, text: str, invocation_id: str = "inv-1") -> Event:
    return Event(
        invocation_id=invocation_id,
        author=author,
        content=types.Content(role=author, parts=[types.Part(text=text)]),
    )


def test_resolve_property_id():
    assert resolve_property_id({"property_id": "prop-123"}) == "prop-123"
    assert resolve_property_id({}) is None


def test_memory_stream_id():
    assert memory_stream_id(property_id="p1") == "property:p1"
    assert memory_stream_id(property_id=None) == "user-general"


def test_select_events_for_memory_ingest_filters_tools():
    events = [
        _text_event(author="user", text="Hello"),
        Event(
            invocation_id="inv-1",
            author="doculink_agent",
            content=types.Content(
                role="model",
                parts=[
                    types.Part(
                        function_call=types.FunctionCall(name="checkpoint_agent", args={})
                    )
                ],
            ),
        ),
        _text_event(author="doculink_agent", text="Final answer"),
        Event(
            invocation_id="inv-1",
            author="user",
            actions=EventActions(
                compaction=EventCompaction(
                    start_timestamp=1.0,
                    end_timestamp=2.0,
                    compacted_content=types.Content(
                        role="model", parts=[types.Part(text="summary")]
                    ),
                )
            ),
        ),
    ]
    selected = select_events_for_memory_ingest(
        events,
        invocation_id="inv-1",
        allowed_authors=frozenset({"user", "doculink_agent"}),
    )
    assert len(selected) == 2
    assert selected[0].author == "user"
    assert selected[1].author == "doculink_agent"
    assert "Final answer" in selected[1].content.parts[0].text


def test_build_ingest_custom_metadata_force_flush(monkeypatch):
    monkeypatch.setenv("ADK_MEMORY_FORCE_FLUSH", "1")
    meta = build_ingest_custom_metadata(stream_id="property:p1")
    assert meta["stream_id"] == "property:p1"
    assert meta["force_flush"] is True


def test_invocation_used_doculink():
    events = [
        Event(
            invocation_id="inv-1",
            author="property_agent",
            actions=EventActions(transfer_to_agent="doculink_agent"),
        )
    ]
    assert invocation_used_doculink(events, "inv-1") is True
    assert invocation_used_doculink(events, "inv-2") is False


@pytest.mark.asyncio
async def test_ingest_skips_when_disabled(monkeypatch):
    monkeypatch.setenv("ADK_MEMORY_INGEST_ENABLED", "0")
    from property_agent import memory_bank as mb

    ctx = MagicMock()
    await mb.ingest_invocation_to_memory_bank(ctx, agent_name="doculink_agent")
    ctx.add_events_to_memory.assert_not_called()


@pytest.mark.asyncio
async def test_ingest_checkpoint_facts_use_add_events_not_add_memory(monkeypatch):
    monkeypatch.setenv("ADK_MEMORY_INGEST_ENABLED", "1")
    from property_agent import memory_bank as mb

    dual_format = 'Summary\n```json\n{"analysis": {"title": "Roof moisture risk"}}\n```'
    event = _text_event(author="user", text="Analyze kitchen")
    session = MagicMock()
    session.events = [event]
    invocation = MagicMock()
    invocation.invocation_id = "inv-1"
    invocation.memory_service = MagicMock()
    invocation.session = session

    ctx = MagicMock()
    ctx._invocation_context = invocation
    ctx.state = {
        "property_id": "prop-1",
        mb.CHECKPOINT_DUAL_FORMAT_STATE_KEY: dual_format,
    }
    ctx.add_events_to_memory = AsyncMock()

    await mb.ingest_invocation_to_memory_bank(
        ctx, agent_name="doculink_agent", include_checkpoint_facts=True
    )
    assert ctx.add_events_to_memory.await_count == 2
    ctx.add_memory.assert_not_called()


@pytest.mark.asyncio
async def test_ingest_calls_add_events_when_enabled(monkeypatch):
    monkeypatch.setenv("ADK_MEMORY_INGEST_ENABLED", "1")
    from property_agent import memory_bank as mb

    event = _text_event(author="user", text="Hi")
    session = MagicMock()
    session.events = [event]
    invocation = MagicMock()
    invocation.invocation_id = "inv-1"
    invocation.memory_service = MagicMock()
    invocation.session = session

    ctx = MagicMock()
    ctx._invocation_context = invocation
    ctx.state = {"property_id": "prop-abc"}
    ctx.add_events_to_memory = AsyncMock()

    await mb.ingest_invocation_to_memory_bank(
        ctx, agent_name="doculink_agent", include_checkpoint_facts=False
    )
    ctx.add_events_to_memory.assert_awaited_once()
    call_kwargs = ctx.add_events_to_memory.await_args.kwargs
    assert call_kwargs["custom_metadata"]["stream_id"] == "property:prop-abc"
