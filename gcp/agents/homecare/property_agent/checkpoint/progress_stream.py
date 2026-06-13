"""Queue-backed progress events during ``run_checkpoint_pipeline`` (tool path)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from google.adk.events.event import Event

from agent_platform.core.streaming import (
    bind_progress_stream_event_loop,
    clear_progress_queue_registry,
    enqueue_progress_item,
    get_any_registered_progress_queue,
    get_progress_queue,
    get_progress_queue_for_invocation_id,
    has_registered_progress_queues,
    init_progress_queue,
    progress_streaming_enabled,
    release_progress_queue,
    release_progress_queue_for_invocation_id,
    set_progress_queue_context_attr,
)

from property_agent.checkpoint.analysis.assembler import (
    apply_tool_context_state_delta,
    bump_checkpoint_progress_emit_seq,
)
from property_agent.checkpoint.constants import CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY
from property_agent.checkpoint.progress_events import build_checkpoint_progress_event

logger = logging.getLogger(__name__)

set_progress_queue_context_attr("_checkpoint_progress_queue")

_PROGRESS_RUNNER_ENV = "HOMEAPP_CHECKPOINT_PROGRESS_RUNNER"


def clear_checkpoint_progress_queue_registry() -> None:
    clear_progress_queue_registry()


def checkpoint_progress_streaming_enabled() -> bool:
    return progress_streaming_enabled(env_var=_PROGRESS_RUNNER_ENV, default=True)


def init_checkpoint_progress_queue(invocation_context: Any) -> asyncio.Queue[Event]:
    return init_progress_queue(invocation_context)  # type: ignore[return-value]


def get_checkpoint_progress_queue(invocation_context: Any) -> Optional[asyncio.Queue[Event]]:
    return get_progress_queue(invocation_context)  # type: ignore[return-value]


def release_checkpoint_progress_queue(invocation_context: Any) -> None:
    release_progress_queue(invocation_context)


async def enqueue_checkpoint_progress_event(
    queue: asyncio.Queue[Event],
    event: Event,
) -> None:
    await enqueue_progress_item(queue, event)


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
