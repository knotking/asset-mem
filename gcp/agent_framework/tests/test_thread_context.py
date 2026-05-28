"""Tests for thread-context propagation helpers."""

from __future__ import annotations

import asyncio
import contextvars
import logging
from concurrent.futures import ThreadPoolExecutor

import pytest

from agent_framework.execution.thread_context import (
    capture_thread_context,
    executor_submit,
    run_with_propagated_context,
    to_thread,
)

_test_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "thread_context_test_var", default="unset"
)


def test_run_with_propagated_context_preserves_contextvars() -> None:
    token = _test_var.set("parent")
    try:
        snapshot = capture_thread_context()

        def read_var() -> str:
            return _test_var.get()

        assert run_with_propagated_context(snapshot, read_var) == "parent"
    finally:
        _test_var.reset(token)


@pytest.mark.asyncio
async def test_to_thread_preserves_contextvars() -> None:
    token = _test_var.set("async-parent")
    try:

        def read_var() -> str:
            return _test_var.get()

        assert await to_thread(read_var) == "async-parent"
    finally:
        _test_var.reset(token)


def test_executor_submit_preserves_contextvars() -> None:
    token = _test_var.set("pool-parent")
    try:

        def read_var() -> str:
            return _test_var.get()

        with ThreadPoolExecutor(max_workers=1) as pool:
            fut = executor_submit(pool, read_var)
            assert fut.result(timeout=5) == "pool-parent"
    finally:
        _test_var.reset(token)


@pytest.mark.asyncio
async def test_to_thread_returns_func_result() -> None:
    assert await to_thread(lambda x, y: x + y, 2, 3) == 5


@pytest.mark.asyncio
async def test_to_thread_propagates_opentelemetry_context_without_detach_error(
    caplog: pytest.LogCaptureFixture,
) -> None:
    pytest.importorskip("opentelemetry")
    from opentelemetry import context as otel_context
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider

    # Default NoOp tracer does not fork context on child spans; SDK provider required.
    trace.set_tracer_provider(TracerProvider())
    tracer = trace.get_tracer(__name__)

    with caplog.at_level(logging.ERROR, logger="opentelemetry.context"):
        with tracer.start_as_current_span("parent-span"):
            parent_ctx = otel_context.get_current()

            def read_ctx_in_thread() -> bool:
                with tracer.start_as_current_span("child-span"):
                    return otel_context.get_current() is not parent_ctx

            assert await to_thread(read_ctx_in_thread) is True

    detach_errors = [
        r
        for r in caplog.records
        if "Failed to detach context" in r.getMessage()
        or "Token was created in a different Context" in r.getMessage()
    ]
    assert not detach_errors
