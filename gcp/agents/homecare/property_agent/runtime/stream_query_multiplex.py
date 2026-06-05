"""Multiplex checkpoint progress queues into Reasoning Engine stream APIs."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator, AsyncIterable
from typing import Any, Dict, Optional

from google.adk.events.event import Event
from vertexai.agent_engines import _utils

from property_agent.checkpoint.progress_stream import (
    bind_progress_stream_event_loop,
    get_any_registered_progress_queue,
    get_progress_queue_for_invocation_id,
    has_registered_progress_queues,
    release_progress_queue_for_invocation_id,
)

logger = logging.getLogger(__name__)

_POLL_SENTINEL = object()
_PROGRESS_POLL_INTERVAL_S = 0.1


def _resolve_progress_queue(active_invocation_id: Optional[str]) -> Optional[asyncio.Queue[Event]]:
    if active_invocation_id:
        queue = get_progress_queue_for_invocation_id(active_invocation_id)
        if queue is not None:
            return queue
    return get_any_registered_progress_queue()


async def _wait_for_next_progress_event(
    active_invocation_id: Optional[str],
) -> Event | object:
    """Block on the next progress event, or return ``_POLL_SENTINEL`` while waiting for a queue."""
    queue = _resolve_progress_queue(active_invocation_id)
    if queue is not None:
        return await queue.get()

    deadline = asyncio.get_running_loop().time() + _PROGRESS_POLL_INTERVAL_S
    while asyncio.get_running_loop().time() < deadline:
        if has_registered_progress_queues():
            queue = _resolve_progress_queue(active_invocation_id)
            if queue is not None:
                try:
                    return queue.get_nowait()
                except asyncio.QueueEmpty:
                    return await queue.get()
        await asyncio.sleep(0.02)
    return _POLL_SENTINEL


def _invocation_id_from_event_dict(event: Dict[str, Any]) -> Optional[str]:
    inv = event.get("invocation_id")
    return str(inv).strip() if isinstance(inv, str) and inv.strip() else None


def _yield_progress_event(
    progress_event: Event,
    *,
    active_invocation_id: Optional[str],
    progress_queue: Optional[asyncio.Queue[Event]],
    log_suffix: str,
) -> Dict[str, Any]:
    text = ""
    if progress_event.content and progress_event.content.parts:
        text = progress_event.content.parts[0].text or ""
    logger.info(
        "checkpoint progress yielded (stream_query%s) author=%s "
        "invocation_id=%s text_len=%d queue_size=%d",
        log_suffix,
        getattr(progress_event, "author", "") or "",
        active_invocation_id or "",
        len(text),
        progress_queue.qsize() if progress_queue is not None else 0,
    )
    return _utils.dump_event_for_json(progress_event)


async def multiplex_engine_stream_and_progress(
    engine_stream: AsyncIterable[Dict[str, Any]],
) -> AsyncGenerator[Dict[str, Any], None]:
    """Yield Engine JSON events and queued ``checkpoint_analysis_progress`` while tools run."""
    bind_progress_stream_event_loop()
    active_invocation_id: Optional[str] = None
    engine_agen = engine_stream.__aiter__()

    async def _next_engine_event() -> Dict[str, Any]:
        return await engine_agen.__anext__()
    agent_task: asyncio.Task[Dict[str, Any]] | None = asyncio.create_task(
        _next_engine_event()
    )
    progress_task: asyncio.Task | None = None

    try:
        while agent_task is not None:
            progress_task = asyncio.create_task(
                _wait_for_next_progress_event(active_invocation_id)
            )
            done, pending = await asyncio.wait(
                {agent_task, progress_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            if progress_task in done:
                try:
                    progress_result = progress_task.result()
                except Exception:
                    logger.exception("checkpoint progress stream_query wait failed")
                    progress_result = _POLL_SENTINEL
                if progress_result is not _POLL_SENTINEL:
                    assert isinstance(progress_result, Event)
                    progress_queue = _resolve_progress_queue(active_invocation_id)
                    yield _yield_progress_event(
                        progress_result,
                        active_invocation_id=active_invocation_id,
                        progress_queue=progress_queue,
                        log_suffix="",
                    )

            if agent_task in done:
                if progress_task in pending:
                    progress_task.cancel()
                    try:
                        await progress_task
                    except asyncio.CancelledError:
                        pass
                try:
                    event_dict = agent_task.result()
                except StopAsyncIteration:
                    agent_task = None
                    break
                inv = _invocation_id_from_event_dict(event_dict)
                if inv:
                    active_invocation_id = inv
                yield event_dict
                agent_task = asyncio.create_task(_next_engine_event())
    finally:
        if progress_task is not None and not progress_task.done():
            progress_task.cancel()
            try:
                await progress_task
            except asyncio.CancelledError:
                pass

        progress_queue = _resolve_progress_queue(active_invocation_id)
        if progress_queue is not None:
            while not progress_queue.empty():
                try:
                    progress_event = progress_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
                yield _yield_progress_event(
                    progress_event,
                    active_invocation_id=active_invocation_id,
                    progress_queue=progress_queue,
                    log_suffix=" flush",
                )

        if agent_task is not None and not agent_task.done():
            agent_task.cancel()
            try:
                await agent_task
            except (asyncio.CancelledError, StopAsyncIteration):
                pass
        aclose = getattr(engine_agen, "aclose", None)
        if aclose is not None:
            await aclose()

        if active_invocation_id:
            release_progress_queue_for_invocation_id(active_invocation_id)
