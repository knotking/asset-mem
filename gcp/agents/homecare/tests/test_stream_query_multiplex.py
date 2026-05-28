"""Tests for Plan B async_stream_query progress multiplex."""

from __future__ import annotations

import asyncio

import pytest
from property_agent.checkpoint.progress_events import build_checkpoint_progress_event
from property_agent.checkpoint.progress_stream import (
    clear_checkpoint_progress_queue_registry,
    init_checkpoint_progress_queue,
    release_progress_queue_for_invocation_id,
)
from property_agent.runtime.stream_query_multiplex import (
    multiplex_engine_stream_and_progress,
)


class _FakeInvocation:
    def __init__(self, invocation_id: str) -> None:
        self.invocation_id = invocation_id


@pytest.fixture(autouse=True)
def _clear_registry() -> None:
    clear_checkpoint_progress_queue_registry()
    yield
    clear_checkpoint_progress_queue_registry()


async def _engine_events(*events: dict) -> object:
    async def _gen():
        for event in events:
            yield event

    return _gen()


@pytest.mark.asyncio
async def test_multiplex_yields_progress_while_engine_blocked():
    inv_id = "e-stream-multiplex-test"
    queue = init_checkpoint_progress_queue(_FakeInvocation(inv_id))

    async def engine():
        yield {"invocation_id": inv_id, "author": "property_agent", "content": {}}
        await asyncio.sleep(0.05)
        yield {"invocation_id": inv_id, "author": "property_agent", "content": {}}

    progress = build_checkpoint_progress_event(
        invocation_id=inv_id,
        session_event_text="_Progress 1/4 — running: coverage._",
        state_delta={"contentMarkdown": "partial"},
    )
    await queue.put(progress)

    out: list[dict] = []
    async for event in multiplex_engine_stream_and_progress(engine()):
        out.append(event)

    authors = [e.get("author") for e in out]
    assert "checkpoint_analysis_progress" in authors
    assert authors.count("checkpoint_analysis_progress") >= 1
    release_progress_queue_for_invocation_id(inv_id)


@pytest.mark.asyncio
async def test_multiplex_yields_after_queue_registers_mid_tool():
    """Progress queue may appear only after the agent stream blocks in a tool."""
    inv_id = "e-late-queue"
    queue = init_checkpoint_progress_queue(_FakeInvocation(inv_id))

    async def engine():
        yield {"invocation_id": inv_id, "author": "property_agent", "content": {}}
        await asyncio.sleep(0.2)
        yield {"invocation_id": inv_id, "author": "property_agent", "content": {}}

    async def enqueue_late():
        await asyncio.sleep(0.05)
        await queue.put(
            build_checkpoint_progress_event(
                invocation_id=inv_id,
                session_event_text="_Progress 0/4 — running: coverage._",
                state_delta={"contentMarkdown": "partial"},
            )
        )

    producer = asyncio.create_task(enqueue_late())
    out: list[dict] = []
    async for event in multiplex_engine_stream_and_progress(engine()):
        out.append(event)
    await producer

    assert any(
        e.get("author") == "checkpoint_analysis_progress" for e in out
    )
    release_progress_queue_for_invocation_id(inv_id)


@pytest.mark.asyncio
async def test_multiplex_flushes_remaining_queue_on_completion():
    inv_id = "e-stream-flush"
    queue = init_checkpoint_progress_queue(_FakeInvocation(inv_id))

    async def engine():
        yield {"invocation_id": inv_id, "author": "property_agent"}

    for i in range(2):
        await queue.put(
            build_checkpoint_progress_event(
                invocation_id=inv_id,
                session_event_text=f"progress-{i}",
                state_delta={},
            )
        )

    out: list[dict] = []
    async for event in multiplex_engine_stream_and_progress(engine()):
        out.append(event)

    progress_events = [
        e for e in out if e.get("author") == "checkpoint_analysis_progress"
    ]
    assert len(progress_events) >= 2
