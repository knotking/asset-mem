"""Tests for HomecareRunner checkpoint progress multiplexing."""

from __future__ import annotations

import asyncio

import pytest
from google.adk.events.event import Event
from google.genai import types

from property_agent.checkpoint.constants import CHECKPOINT_PROGRESS_EVENT_AUTHOR
from property_agent.runtime.homecare_runner import multiplex_agent_and_progress_queue


def _progress_event(text: str) -> Event:
    return Event(
        invocation_id="inv-test",
        author=CHECKPOINT_PROGRESS_EVENT_AUTHOR,
        content=types.Content(role="model", parts=[types.Part(text=text)]),
    )


def _agent_event(text: str) -> Event:
    return Event(
        invocation_id="inv-test",
        author="property_agent",
        content=types.Content(role="model", parts=[types.Part(text=text)]),
    )


@pytest.mark.asyncio
async def test_multiplex_yields_progress_without_cancelling_blocked_agent():
    """Progress wins asyncio.wait; agent __anext__ must stay alive (tool keeps running)."""
    agent_cancelled = False
    agent_completed = asyncio.Event()

    async def agent_gen():
        nonlocal agent_cancelled
        try:
            await asyncio.sleep(2.0)
            yield _agent_event("final")
            agent_completed.set()
        except asyncio.CancelledError:
            agent_cancelled = True
            raise

    queue: asyncio.Queue[Event] = asyncio.Queue()
    await queue.put(_progress_event("_Progress 0/4 — running: coverage._"))

    out: list[str] = []

    async def drain():
        agen = multiplex_agent_and_progress_queue(agent_gen(), queue)
        async for ev in agen:
            text = ""
            if ev.content and ev.content.parts:
                text = ev.content.parts[0].text or ""
            out.append(f"{ev.author}:{text}")

    drain_task = asyncio.create_task(drain())
    await asyncio.sleep(0.05)
    assert out == [f"{CHECKPOINT_PROGRESS_EVENT_AUTHOR}:_Progress 0/4 — running: coverage._"]
    assert not agent_cancelled
    assert not agent_completed.is_set()

    drain_task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await drain_task
    await asyncio.sleep(0.05)
    assert agent_cancelled


@pytest.mark.asyncio
async def test_multiplex_interleaves_progress_then_agent_events():
    async def agent_gen():
        await asyncio.sleep(0.02)
        yield _agent_event("tool-done")
        yield _agent_event("follow-up")

    queue: asyncio.Queue[Event] = asyncio.Queue()
    await queue.put(_progress_event("_Progress 1/4 — completed: coverage._"))
    await queue.put(_progress_event("_Progress 2/4 — completed: diy._"))

    authors: list[str] = []
    agen = multiplex_agent_and_progress_queue(agent_gen(), queue)
    async for ev in agen:
        authors.append(ev.author or "")

    assert authors == [
        CHECKPOINT_PROGRESS_EVENT_AUTHOR,
        CHECKPOINT_PROGRESS_EVENT_AUTHOR,
        "property_agent",
        "property_agent",
    ]
