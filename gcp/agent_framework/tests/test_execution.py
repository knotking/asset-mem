"""Tests for agent_framework.execution.parallel_runner."""

from __future__ import annotations

import asyncio

import pytest

from agent_framework.execution.parallel_runner import (
    run_batches,
    run_parallel,
    run_parallel_progressive,
)


@pytest.mark.asyncio
async def test_run_parallel_returns_all_results() -> None:
    async def worker(n: int) -> int:
        await asyncio.sleep(0.01 * n)
        return n * 2

    out = await run_parallel([3, 1, 2], worker)
    assert sorted(out) == [2, 4, 6]


@pytest.mark.asyncio
async def test_run_parallel_progressive_invokes_on_result_in_completion_order() -> None:
    order: list[int] = []

    async def worker(n: int) -> int:
        await asyncio.sleep(0.02 if n == 1 else 0.001)
        return n

    async def on_result(item: int, result: int) -> None:
        order.append(result)

    results = await run_parallel_progressive([1, 2, 3], worker, on_result=on_result)
    assert sorted(results) == [1, 2, 3]
    assert order[0] in {2, 3}
    assert 1 in order


@pytest.mark.asyncio
async def test_run_batches_delegates_to_progressive() -> None:
    seen: list[str] = []

    async def worker(name: str) -> str:
        return f"{name}-ok"

    async def on_complete(name: str, result: str) -> None:
        seen.append(result)

    out = await run_batches(["a", "b"], worker, on_complete=on_complete)
    assert sorted(out) == ["a-ok", "b-ok"]
    assert sorted(seen) == ["a-ok", "b-ok"]


@pytest.mark.asyncio
async def test_run_parallel_progressive_cancels_inflight_on_cancelled() -> None:
    started = asyncio.Event()
    release = asyncio.Event()

    async def worker(_: int) -> int:
        started.set()
        await release.wait()
        return 1

    async def run() -> None:
        await run_parallel_progressive([0], worker)

    task = asyncio.create_task(run())
    await asyncio.wait_for(started.wait(), timeout=1.0)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    release.set()
