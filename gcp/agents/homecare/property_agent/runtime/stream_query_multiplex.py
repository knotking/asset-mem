"""Multiplex checkpoint progress queues into Reasoning Engine stream APIs."""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator, AsyncIterable
from typing import Any, Dict, Optional

from google.adk.events.event import Event
from vertexai.agent_engines import _utils

from agent_platform.adk.streaming.engine_multiplex import (
    multiplex_engine_stream_and_progress as _multiplex_engine_stream_and_progress,
)
from agent_platform.core.streaming import bind_progress_stream_event_loop

from property_agent.checkpoint.progress_stream import (
    get_any_registered_progress_queue,
    get_progress_queue_for_invocation_id,
    has_registered_progress_queues,
    release_progress_queue_for_invocation_id,
)

logger = logging.getLogger(__name__)

# Re-export for tests and vertex_app.
__all__ = [
    "bind_progress_stream_event_loop",
    "get_any_registered_progress_queue",
    "get_progress_queue_for_invocation_id",
    "has_registered_progress_queues",
    "multiplex_engine_stream_and_progress",
    "release_progress_queue_for_invocation_id",
]


def _invocation_id_from_event_dict(event: Dict[str, Any]) -> Optional[str]:
    inv = event.get("invocation_id")
    return str(inv).strip() if isinstance(inv, str) and inv.strip() else None


def _log_progress_yielded(
    progress_event: Event,
    active_invocation_id: Optional[str],
    progress_queue: Any,
    log_suffix: str,
) -> None:
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


async def multiplex_engine_stream_and_progress(
    engine_stream: AsyncIterable[Dict[str, Any]],
) -> AsyncGenerator[Dict[str, Any], None]:
    """Yield Engine JSON events and queued ``checkpoint_analysis_progress`` while tools run."""
    async for event in _multiplex_engine_stream_and_progress(
        engine_stream,
        serialize_progress=_utils.dump_event_for_json,
        invocation_id_from_engine_event=_invocation_id_from_event_dict,
        log_progress_yielded=_log_progress_yielded,
    ):
        yield event
