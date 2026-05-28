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
    get_checkpoint_progress_queue,
    init_checkpoint_progress_queue,
    release_checkpoint_progress_queue,
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
        if not checkpoint_progress_streaming_enabled():
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
                    yield event
            return

        progress_queue = init_checkpoint_progress_queue(invocation_context)
        logger.info(
            "checkpoint progress streaming enabled invocation_id=%s",
            getattr(invocation_context, "invocation_id", "") or "",
        )

        try:
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
                    yield event
        finally:
            release_checkpoint_progress_queue(invocation_context)


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
