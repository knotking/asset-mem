"""Propagate OpenTelemetry and contextvars into worker threads safely.

``asyncio.to_thread`` and ``ThreadPoolExecutor`` do not copy OpenTelemetry
context by default. SDK attach/detach then runs in the wrong execution context
and logs ``Failed to detach context`` / ``Token was created in a different Context``.
"""

from __future__ import annotations

import asyncio
import contextvars
from collections.abc import Callable
from concurrent.futures import Executor
from dataclasses import dataclass
from typing import Any, ParamSpec, TypeVar

P = ParamSpec("P")
T = TypeVar("T")


@dataclass(frozen=True)
class ThreadContextSnapshot:
    otel_context: Any | None
    contextvars_context: contextvars.Context


def _get_otel_context() -> Any | None:
    try:
        from opentelemetry import context as otel_context
    except ImportError:
        return None
    return otel_context.get_current()


def capture_thread_context() -> ThreadContextSnapshot:
    """Capture caller OTel + contextvars state for use in a worker thread."""
    return ThreadContextSnapshot(
        otel_context=_get_otel_context(),
        contextvars_context=contextvars.copy_context(),
    )


def run_with_propagated_context(
    snapshot: ThreadContextSnapshot,
    func: Callable[P, T],
    /,
    *args: P.args,
    **kwargs: P.kwargs,
) -> T:
    """Run ``func`` in the current thread with ``snapshot`` context attached."""

    def _invoke() -> T:
        otel_token = None
        if snapshot.otel_context is not None:
            from opentelemetry import context as otel_context

            otel_token = otel_context.attach(snapshot.otel_context)
        try:
            return snapshot.contextvars_context.run(func, *args, **kwargs)
        finally:
            if otel_token is not None:
                from opentelemetry import context as otel_context

                otel_context.detach(otel_token)

    return _invoke()


async def to_thread(
    func: Callable[P, T],
    /,
    *args: P.args,
    **kwargs: P.kwargs,
) -> T:
    """``asyncio.to_thread`` with OTel + contextvars propagation."""
    snapshot = capture_thread_context()
    return await asyncio.to_thread(
        run_with_propagated_context,
        snapshot,
        func,
        *args,
        **kwargs,
    )


def executor_submit(
    executor: Executor,
    func: Callable[P, T],
    /,
    *args: P.args,
    **kwargs: P.kwargs,
):
    """``executor.submit`` with OTel + contextvars propagation."""
    snapshot = capture_thread_context()
    return executor.submit(
        run_with_propagated_context,
        snapshot,
        func,
        *args,
        **kwargs,
    )
