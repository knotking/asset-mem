"""Runner that multiplexes checkpoint progress events during tool execution."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator, Callable
from typing import TYPE_CHECKING

from google.adk.events.event import Event
from google.adk.runners import Runner
from google.adk.utils.context_utils import Aclosing

from property_agent.checkpoint.progress_stream import (
    checkpoint_progress_streaming_enabled,
    init_checkpoint_progress_queue,
    release_checkpoint_progress_queue,
)
from property_agent.observability.lifecycle_events import (
    PHASE_ENGINE_RUNNER_EXEC,
    build_lifecycle_adk_event,
    enqueue_lifecycle_event,
    lifecycle_context_from_invocation,
    log_lifecycle_payload,
)
from property_agent.observability.turn_request_timing import (
    begin_turn_for_adk_web,
    current_turn_timing,
    emit_summary,
    increment_event_count,
    mark,
    maybe_mark_first_stream_event,
)

if TYPE_CHECKING:
    from google.adk.agents.invocation_context import InvocationContext
    from google.adk.sessions.session import Session

logger = logging.getLogger(__name__)


async def multiplex_agent_and_progress_queue(
    agent_agen: AsyncGenerator[Event, None],
    progress_queue: asyncio.Queue[Event],
) -> AsyncGenerator[Event, None]:
    """Yield agent events and queued checkpoint progress without cancelling the agent.

    When progress arrives while the agent is blocked inside a tool, only the
    progress ``queue.get()`` wait is cancelled — never the pending
    ``agent_agen.__anext__()`` (cancelling that propagates into the tool and
    kills ``run_checkpoint_pipeline`` / parallel branches).
    """
    agent_task: asyncio.Task | None = asyncio.create_task(agent_agen.__anext__())
    progress_task: asyncio.Task | None = None

    try:
        while agent_task is not None:
            progress_task = asyncio.create_task(progress_queue.get())
            done, pending = await asyncio.wait(
                {agent_task, progress_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            if progress_task in done:
                try:
                    progress_event = progress_task.result()
                    text = ""
                    if progress_event.content and progress_event.content.parts:
                        text = progress_event.content.parts[0].text or ""
                    logger.info(
                        "checkpoint progress yielded author=%s text_len=%d queue_size=%d",
                        getattr(progress_event, "author", "") or "",
                        len(text),
                        progress_queue.qsize(),
                    )
                    yield progress_event
                except Exception:
                    logger.exception("checkpoint progress queue get failed")

            if agent_task in done:
                if progress_task in pending:
                    progress_task.cancel()
                    try:
                        await progress_task
                    except asyncio.CancelledError:
                        pass
                try:
                    yield agent_task.result()
                except StopAsyncIteration:
                    agent_task = None
                    break
                agent_task = asyncio.create_task(agent_agen.__anext__())
    finally:
        if progress_task is not None and not progress_task.done():
            progress_task.cancel()
            try:
                await progress_task
            except asyncio.CancelledError:
                pass
        while not progress_queue.empty():
            try:
                yield progress_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        if agent_task is not None and not agent_task.done():
            agent_task.cancel()
            try:
                await agent_task
            except (asyncio.CancelledError, StopAsyncIteration):
                pass
        await agent_agen.aclose()


class HomecareRunner(Runner):
    """Yields ``checkpoint_analysis_progress`` events while tools are running."""

    async def _exec_with_plugin(
        self,
        invocation_context: InvocationContext,
        session: Session,
        execute_fn: Callable[[InvocationContext], AsyncGenerator[Event, None]],
        is_live_call: bool = False,
    ) -> AsyncGenerator[Event, None]:
        if current_turn_timing() is None:
            begin_turn_for_adk_web(
                session_id=getattr(session, "id", None),
                user_id=getattr(session, "user_id", None),
                invocation_id=getattr(invocation_context, "invocation_id", None),
            )
        mark("runner_exec_start")
        first_event = True
        event_count = 0
        progress_enabled = checkpoint_progress_streaming_enabled()
        inv_id = str(getattr(invocation_context, "invocation_id", "") or "")
        ctx = lifecycle_context_from_invocation(invocation_context)
        if progress_enabled:
            enqueue_lifecycle_event(
                invocation_context,
                phase=PHASE_ENGINE_RUNNER_EXEC,
                **ctx,
            )
        else:
            runner_lifecycle = build_lifecycle_adk_event(
                phase=PHASE_ENGINE_RUNNER_EXEC,
                invocation_id=inv_id,
                branch=getattr(invocation_context, "branch", None),
                **ctx,
            )
            delta = getattr(getattr(runner_lifecycle, "actions", None), "state_delta", None) or {}
            payload = delta.get("homeappLifecycle") if isinstance(delta, dict) else None
            if isinstance(payload, dict):
                log_lifecycle_payload(payload)
            yield runner_lifecycle
            event_count += 1

        def _record_event(event: Event) -> Event:
            nonlocal first_event, event_count
            if first_event:
                mark("runner_first_event")
                first_event = False
            maybe_mark_first_stream_event(event)
            increment_event_count()
            event_count += 1
            return event

        try:
            if not progress_enabled:
                logger.info(
                    "checkpoint progress streaming disabled (HOMEAPP_CHECKPOINT_PROGRESS_RUNNER); "
                    "using stock ADK runner"
                )
                async with Aclosing(
                    super()._exec_with_plugin(
                        invocation_context,
                        session,
                        execute_fn,
                        is_live_call=is_live_call,
                    )
                ) as agen:
                    async for event in agen:
                        yield _record_event(event)
                return

            progress_queue = init_checkpoint_progress_queue(invocation_context)
            logger.info(
                "checkpoint progress streaming enabled invocation_id=%s",
                getattr(invocation_context, "invocation_id", "") or "",
            )

            async def multiplex_execute(
                ctx: InvocationContext,
            ) -> AsyncGenerator[Event, None]:
                agent_agen = execute_fn(ctx)
                async for event in multiplex_agent_and_progress_queue(
                    agent_agen, progress_queue
                ):
                    yield event

            async with Aclosing(
                super()._exec_with_plugin(
                    invocation_context,
                    session,
                    multiplex_execute,
                    is_live_call=is_live_call,
                )
            ) as agen:
                async for event in agen:
                    yield _record_event(event)
        finally:
            if progress_enabled:
                release_checkpoint_progress_queue(invocation_context)
            emit_summary(
                "adk_web_complete",
                event_count=event_count,
                entrypoint="adk_web",
            )


def create_homecare_runner(
    *,
    app,
    artifact_service=None,
    session_service=None,
    memory_service=None,
    credential_service=None,
    auto_create_session: bool = True,
) -> HomecareRunner:
    """Construct ``HomecareRunner`` with the same services as stock ADK ``Runner``."""
    return HomecareRunner(
        app=app,
        artifact_service=artifact_service,
        session_service=session_service,
        memory_service=memory_service,
        credential_service=credential_service,
        auto_create_session=auto_create_session,
    )
