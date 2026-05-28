"""Tests for checkpoint progress streaming (ADK web / proxy)."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from property_agent.checkpoint.constants import CHECKPOINT_PROGRESS_EVENT_AUTHOR
from property_agent.checkpoint.progress_events import build_checkpoint_progress_event
from property_agent.checkpoint.progress_stream import (
    clear_checkpoint_progress_queue_registry,
    emit_checkpoint_progress_event,
    get_checkpoint_progress_queue,
    init_checkpoint_progress_queue,
    release_checkpoint_progress_queue,
)


@pytest.fixture(autouse=True)
def _clear_progress_queue_registry():
    clear_checkpoint_progress_queue_registry()
    yield
    clear_checkpoint_progress_queue_registry()


def test_build_checkpoint_progress_event_author_and_text():
    ev = build_checkpoint_progress_event(
        invocation_id="inv-1",
        session_event_text="# Checkpoint analysis\n\n_Progress 1/4 — running: coverage._\n",
        state_delta={
            "contentMarkdown": "# Checkpoint analysis",
            "contentJson": {"analysis": {"title": "T"}},
        },
        branch="branch-1",
    )
    assert ev.author == CHECKPOINT_PROGRESS_EVENT_AUTHOR
    assert ev.content.parts[0].text.startswith("# Checkpoint analysis")
    assert ev.actions.state_delta.get("contentJson") is not None
    assert "checkpoint_analysis_progress" in ev.actions.state_delta


@pytest.mark.asyncio
async def test_emit_checkpoint_progress_event_enqueues(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("HOMEAPP_CHECKPOINT_PROGRESS_RUNNER", "1")

    state: dict = {}
    inv = SimpleNamespace(invocation_id="inv-2", branch=None, session=SimpleNamespace(state=state))
    queue = init_checkpoint_progress_queue(inv)
    tool_context = SimpleNamespace(_invocation_context=inv, state=state, actions=SimpleNamespace())

    from property_agent.checkpoint import progress_stream as ps

    monkeypatch.setattr(ps, "apply_tool_context_state_delta", lambda _tc, delta: state.update(delta))

    await emit_checkpoint_progress_event(
        tool_context,
        session_event_text="_Progress 0/2 — running: diy._\n",
        state_delta={
            "contentMarkdown": "# Checkpoint analysis",
            "contentJson": {"analysis": {"title": "T", "analysisStatus": {"diy": "running"}}},
            "analysisRunId": "run-1",
        },
        branch="diy",
    )

    assert get_checkpoint_progress_queue(inv) is queue
    assert not queue.empty()
    event = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert event.author == CHECKPOINT_PROGRESS_EVENT_AUTHOR
    assert "diy" in (event.content.parts[0].text or "")


def test_init_checkpoint_progress_queue_is_idempotent():
    """Pipeline must not replace the queue HomecareRunner is draining."""
    inv = SimpleNamespace(invocation_id="inv-3")
    runner_queue = init_checkpoint_progress_queue(inv)
    pipeline_queue = init_checkpoint_progress_queue(inv)
    assert runner_queue is pipeline_queue
    assert get_checkpoint_progress_queue(inv) is runner_queue


def test_init_shares_queue_across_distinct_invocation_contexts():
    """Runner and tool may receive different InvocationContext objects (Agent Engine)."""
    runner_ctx = SimpleNamespace(invocation_id="inv-shared")
    tool_ctx = SimpleNamespace(invocation_id="inv-shared")
    runner_queue = init_checkpoint_progress_queue(runner_ctx)
    tool_queue = init_checkpoint_progress_queue(tool_ctx)
    assert runner_queue is tool_queue
    assert get_checkpoint_progress_queue(tool_ctx) is runner_queue


def test_release_checkpoint_progress_queue_clears_registry():
    inv = SimpleNamespace(invocation_id="inv-release")
    queue = init_checkpoint_progress_queue(inv)
    assert get_checkpoint_progress_queue(inv) is queue
    release_checkpoint_progress_queue(inv)
    assert get_checkpoint_progress_queue(inv) is None
    fresh = SimpleNamespace(invocation_id="inv-release")
    assert init_checkpoint_progress_queue(fresh) is not queue
