"""Queue-backed progress events during ``run_checkpoint_pipeline`` (tool path)."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, Optional

from google.adk.events.event import Event

from property_agent.checkpoint.analysis.assembler import (
    apply_tool_context_state_delta,
    bump_checkpoint_progress_emit_seq,
)
from property_agent.checkpoint.constants import CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY
from property_agent.checkpoint.progress_events import build_checkpoint_progress_event

logger = logging.getLogger(__name__)

_PROGRESS_QUEUE_ATTR = "_checkpoint_progress_queue"
# Agent Engine may pass distinct InvocationContext objects for the runner vs tools;
# key by invocation_id so enqueue and multiplex share one queue.
_progress_queues_by_invocation_id: dict[str, asyncio.Queue[Event]] = {}
# Event loop driving ``async_stream_query`` / ``stream_query`` multiplex (Agent Engine).
_bound_stream_loop: Optional[asyncio.AbstractEventLoop] = None


def _invocation_key(invocation_context: Any) -> str:
    return str(getattr(invocation_context, "invocation_id", "") or "").strip()


def _attach_queue_to_context(
    invocation_context: Any, queue: asyncio.Queue[Event]
) -> asyncio.Queue[Event]:
    setattr(invocation_context, _PROGRESS_QUEUE_ATTR, queue)
    key = _invocation_key(invocation_context)
    if key:
        _progress_queues_by_invocation_id[key] = queue
    return queue


def clear_checkpoint_progress_queue_registry() -> None:
    """Drop registry entries (tests only)."""
    _progress_queues_by_invocation_id.clear()
    global _bound_stream_loop
    _bound_stream_loop = None


def bind_progress_stream_event_loop(
    loop: Optional[asyncio.AbstractEventLoop] = None,
) -> None:
    """Record the loop that multiplexes ``async_stream_query`` (for cross-thread enqueue)."""
    global _bound_stream_loop
    _bound_stream_loop = loop or asyncio.get_running_loop()


def has_registered_progress_queues() -> bool:
    return bool(_progress_queues_by_invocation_id)


def checkpoint_progress_streaming_enabled() -> bool:
    """When true, branch updates are enqueued for ``HomecareRunner`` to stream."""
    raw = (os.getenv("HOMEAPP_CHECKPOINT_PROGRESS_RUNNER") or "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def init_checkpoint_progress_queue(invocation_context: Any) -> asyncio.Queue[Event]:
    """Register a per-invocation queue (``HomecareRunner`` multiplexes it).

    Idempotent: ``run_checkpoint_pipeline`` must not replace a queue that
    ``HomecareRunner`` is already draining (that silences incremental SSE).

    When runner and tool see different ``InvocationContext`` instances (common
    on Agent Engine), reuse the queue registered for ``invocation_id``.
    """
    existing = get_checkpoint_progress_queue(invocation_context)
    if existing is not None:
        key = _invocation_key(invocation_context)
        if key:
            _progress_queues_by_invocation_id.setdefault(key, existing)
        return existing

    key = _invocation_key(invocation_context)
    if key and key in _progress_queues_by_invocation_id:
        queue = _progress_queues_by_invocation_id[key]
        setattr(invocation_context, _PROGRESS_QUEUE_ATTR, queue)
        return queue

    return _attach_queue_to_context(invocation_context, asyncio.Queue())


def get_any_registered_progress_queue() -> Optional[asyncio.Queue[Event]]:
    """Return the sole registry queue when exactly one invocation is active."""
    if len(_progress_queues_by_invocation_id) == 1:
        return next(iter(_progress_queues_by_invocation_id.values()))
    return None


def get_progress_queue_for_invocation_id(
    invocation_id: str,
) -> Optional[asyncio.Queue[Event]]:
    """Registry lookup for Plan B ``async_stream_query`` multiplex (no context object)."""
    key = str(invocation_id or "").strip()
    if not key:
        return None
    queue = _progress_queues_by_invocation_id.get(key)
    if isinstance(queue, asyncio.Queue):
        return queue
    return None


def release_progress_queue_for_invocation_id(invocation_id: str) -> None:
    """Drop registry entry after ``async_stream_query`` completes."""
    key = str(invocation_id or "").strip()
    if key:
        _progress_queues_by_invocation_id.pop(key, None)


def get_checkpoint_progress_queue(invocation_context: Any) -> Optional[asyncio.Queue[Event]]:
    queue = getattr(invocation_context, _PROGRESS_QUEUE_ATTR, None)
    if isinstance(queue, asyncio.Queue):
        return queue
    key = _invocation_key(invocation_context)
    if key and key in _progress_queues_by_invocation_id:
        queue = _progress_queues_by_invocation_id[key]
        setattr(invocation_context, _PROGRESS_QUEUE_ATTR, queue)
        return queue
    return None


def release_checkpoint_progress_queue(invocation_context: Any) -> None:
    """Remove registry entry after invocation completes."""
    key = _invocation_key(invocation_context)
    if key:
        release_progress_queue_for_invocation_id(key)
    if getattr(invocation_context, _PROGRESS_QUEUE_ATTR, None) is not None:
        delattr(invocation_context, _PROGRESS_QUEUE_ATTR)


async def emit_checkpoint_progress_event(
    tool_context: Any,
    *,
    session_event_text: str,
    state_delta: Dict[str, Any],
    branch: Optional[str] = None,
) -> None:
    """Apply production ``state_delta`` and optionally enqueue a chat-visible event."""
    if not state_delta or tool_context is None:
        return

    progress_text = session_event_text or str(
        state_delta.get(CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY) or ""
    )
    patch = dict(state_delta)
    if progress_text:
        patch[CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY] = progress_text

    apply_tool_context_state_delta(tool_context, patch)
    state = getattr(tool_context, "state", None)
    if state is not None:
        bump_checkpoint_progress_emit_seq(state)

    inv = getattr(tool_context, "_invocation_context", None)
    if inv is None or not checkpoint_progress_streaming_enabled():
        return

    queue = get_checkpoint_progress_queue(inv)
    if queue is None:
        queue = init_checkpoint_progress_queue(inv)
    if queue is None:
        return

    event = build_checkpoint_progress_event(
        invocation_id=str(getattr(inv, "invocation_id", "") or ""),
        session_event_text=progress_text,
        state_delta=patch,
        branch=getattr(inv, "branch", None) if branch is None else branch,
    )
    await enqueue_checkpoint_progress_event(queue, event)
    logger.info(
        "checkpoint progress queued invocation_id=%s branch=%s text_len=%d queue_size=%d",
        getattr(inv, "invocation_id", "") or "",
        branch or "",
        len(progress_text),
        queue.qsize(),
    )


async def enqueue_checkpoint_progress_event(
    queue: asyncio.Queue[Event],
    event: Event,
) -> None:
    """Put on the multiplex loop (safe when tools run on another thread)."""
    try:
        running = asyncio.get_running_loop()
    except RuntimeError:
        running = None
    bound = _bound_stream_loop
    if bound is not None and running is not bound:
        await asyncio.wrap_future(asyncio.run_coroutine_threadsafe(queue.put(event), bound))
        return
    await queue.put(event)
