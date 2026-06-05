# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Vertex AI ``AdkApp`` with ADK ``App``-level session compaction on Agent Engine."""

from __future__ import annotations

import asyncio
import logging
import queue as thread_queue
import threading
from typing import Any, AsyncIterable, Dict, Generator, List, Optional, Union

from vertexai.agent_engines import AdkApp

from property_agent.runtime.app_config import property_app
from property_agent.checkpoint.progress_stream import (
    checkpoint_progress_streaming_enabled,
)
from property_agent.runtime.homecare_runner import HomecareRunner, create_homecare_runner
from property_agent.runtime.stream_query_multiplex import (
    multiplex_engine_stream_and_progress,
)
from property_agent.observability.lifecycle_events import (
    PHASE_ENGINE_TURN_STARTED,
    build_lifecycle_engine_dict,
    context_fields_from_stream_message,
    log_lifecycle_payload,
)
from property_agent.observability.turn_request_timing import (
    begin_turn_for_engine_stream,
    emit_summary,
    increment_event_count,
    mark,
    maybe_mark_first_stream_event,
)

logger = logging.getLogger(__name__)

# Visible in Cloud Logging even when INFO is filtered for some loggers.
_ENTRYPOINT_LOG = logging.getLogger("property_agent.engine_entrypoint")


def _log_entrypoint(message: str, *args: object) -> None:
    formatted = message % args if args else message
    logger.info(formatted)
    _ENTRYPOINT_LOG.warning("HOMEAPP_ENGINE_ENTRYPOINT %s", formatted)


_log_entrypoint(
    "property_agent.vertex_app loaded HomecareAdkApp base=%s",
    AdkApp.__module__,
)


class HomecareAdkApp(AdkApp):
    """``AdkApp`` that wires ``Runner(app=property_app)`` so compaction runs post-invocation."""

    def __setstate__(self, state: object) -> None:
        """Drop pickled stock ``Runner`` so ``set_up`` wires ``HomecareRunner`` on Engine."""
        self.__dict__.update(state)  # type: ignore[arg-type,call-overload]
        runner = self._tmpl_attrs.get("runner")
        in_mem = self._tmpl_attrs.get("in_memory_runner")
        if (runner is not None and not isinstance(runner, HomecareRunner)) or (
            in_mem is not None and not isinstance(in_mem, HomecareRunner)
        ):
            _log_entrypoint(
                "unpickle clearing stock runners runner=%s in_memory_runner=%s",
                type(runner).__name__ if runner is not None else "none",
                type(in_mem).__name__ if in_mem is not None else "none",
            )
            self._tmpl_attrs.pop("runner", None)
            self._tmpl_attrs.pop("in_memory_runner", None)

    def set_up(self) -> None:
        _log_entrypoint("set_up start type=%s", type(self).__name__)
        mark("set_up_start")
        super().set_up()
        self._wire_runners_with_property_app()
        mark("set_up_done")
        runner = self._tmpl_attrs.get("runner")
        _log_entrypoint(
            "set_up done runner=%s progress_streaming=%s",
            type(runner).__name__ if runner is not None else "none",
            checkpoint_progress_streaming_enabled(),
        )

    def _ensure_homecare_runner(self) -> None:
        """Agent Engine may leave a stock ADK ``Runner`` after ``super().set_up()``."""
        runner = self._tmpl_attrs.get("runner")
        if isinstance(runner, HomecareRunner):
            mark("ensure_runner_done")
            return
        if not self._tmpl_attrs.get("runner") or not self._tmpl_attrs.get(
            "session_service"
        ):
            self.set_up()
            mark("ensure_runner_done")
            return
        _log_entrypoint(
            "replacing stock runner (was %s) with HomecareRunner",
            type(runner).__name__,
        )
        self._wire_runners_with_property_app()
        mark("ensure_runner_done")

    async def async_stream_query(
        self,
        *,
        message: Union[str, Dict[str, Any]],
        user_id: str,
        session_id: Optional[str] = None,
        session_events: Optional[List[Dict[str, Any]]] = None,
        run_config: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> AsyncIterable[Dict[str, Any]]:
        """Wire ``HomecareRunner`` and multiplex progress at the stream boundary (Plan B)."""
        begin_turn_for_engine_stream(session_id=session_id, user_id=user_id)
        event_count = 0
        ctx_fields = context_fields_from_stream_message(message)
        turn_started = build_lifecycle_engine_dict(
            phase=PHASE_ENGINE_TURN_STARTED,
            session_id=session_id,
            correlation_id=ctx_fields.get("correlation_id"),
            primary_agent=ctx_fields.get("primary_agent"),
            checkpoint_ids=ctx_fields.get("checkpoint_ids"),
            checkpoint_optional_agents=ctx_fields.get("checkpoint_optional_agents"),
            context_doc_uris=ctx_fields.get("context_doc_uris"),
        )
        started_payload = turn_started.get("actions", {}).get("state_delta", {}).get(
            "homeappLifecycle"
        )
        if isinstance(started_payload, dict):
            log_lifecycle_payload(started_payload)
        yield turn_started
        event_count += 1
        try:
            self._ensure_homecare_runner()
            runner = self._tmpl_attrs.get("runner")
            streaming = checkpoint_progress_streaming_enabled()
            _log_entrypoint(
                "async_stream_query runner=%s progress_streaming=%s stream_multiplex=%s",
                type(runner).__name__ if runner is not None else "none",
                streaming,
                streaming,
            )
            mark("adk_stream_start")
            engine_stream = super().async_stream_query(
                message=message,
                user_id=user_id,
                session_id=session_id,
                session_events=session_events,
                run_config=run_config,
                **kwargs,
            )
            if not streaming:
                async for event in engine_stream:
                    maybe_mark_first_stream_event(event)
                    increment_event_count()
                    event_count += 1
                    yield event
                return

            async for event in multiplex_engine_stream_and_progress(engine_stream):
                maybe_mark_first_stream_event(event)
                increment_event_count()
                event_count += 1
                yield event
        finally:
            emit_summary(
                "stream_complete",
                event_count=event_count,
                entrypoint="async_stream_query",
            )

    def stream_query(
        self,
        *,
        message: Union[str, Dict[str, Any]],
        user_id: str,
        session_id: Optional[str] = None,
        run_config: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Generator[Dict[str, Any], None, None]:
        """Reasoning Engine / proxy ``stream_query`` entry — routes through async multiplex."""
        self._ensure_homecare_runner()
        streaming = checkpoint_progress_streaming_enabled()
        _log_entrypoint(
            "stream_query runner=%s progress_streaming=%s stream_multiplex=%s",
            type(self._tmpl_attrs.get("runner")).__name__
            if self._tmpl_attrs.get("runner")
            else "none",
            streaming,
            streaming,
        )

        out_queue: thread_queue.Queue = thread_queue.Queue()
        errors: list[BaseException] = []

        async def _run_async_stream() -> None:
            try:
                async for event in self.async_stream_query(
                    message=message,
                    user_id=user_id,
                    session_id=session_id,
                    run_config=run_config,
                    **kwargs,
                ):
                    out_queue.put(event)
            except BaseException as exc:
                errors.append(exc)
            finally:
                out_queue.put(None)

        def _thread_main() -> None:
            asyncio.run(_run_async_stream())

        thread = threading.Thread(target=_thread_main, daemon=True)
        thread.start()
        try:
            while True:
                item = out_queue.get()
                if item is None:
                    break
                yield item
        finally:
            thread.join(timeout=600)
        if errors:
            raise errors[0]

    def _wire_runners_with_property_app(self) -> None:
        credential_service = self._tmpl_attrs.get("credential_service")

        self._tmpl_attrs["app"] = property_app
        self._tmpl_attrs["runner"] = create_homecare_runner(
            app=property_app,
            session_service=self._tmpl_attrs.get("session_service"),
            artifact_service=self._tmpl_attrs.get("artifact_service"),
            memory_service=self._tmpl_attrs.get("memory_service"),
            credential_service=credential_service,
        )
        self._tmpl_attrs["in_memory_runner"] = create_homecare_runner(
            app=property_app,
            session_service=self._tmpl_attrs.get("in_memory_session_service"),
            artifact_service=self._tmpl_attrs.get("in_memory_artifact_service"),
            memory_service=self._tmpl_attrs.get("in_memory_memory_service"),
            credential_service=credential_service,
        )
        compaction = property_app.events_compaction_config
        if compaction:
            logger.info(
                "HomecareAdkApp runners use events_compaction_config "
                "token_threshold=%s event_retention_size=%s",
                compaction.token_threshold,
                compaction.event_retention_size,
            )
        else:
            logger.info("HomecareAdkApp runners use property_app without compaction")
        logger.info(
            "HomecareAdkApp checkpoint progress streaming enabled=%s",
            checkpoint_progress_streaming_enabled(),
        )
        mark("wire_runner_done")
