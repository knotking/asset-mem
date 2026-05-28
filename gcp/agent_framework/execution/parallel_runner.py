"""Generic async parallel execution helpers."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Iterable, Sequence
from typing import TypeVar

from agent_framework.registry.orchestration import (
    BranchToolSpec,
    build_execution_plan,
)

T = TypeVar("T")
R = TypeVar("R")


async def run_parallel(
    items: Iterable[T],
    worker: Callable[[T], Awaitable[R]],
) -> list[R]:
    """Run a worker for each item concurrently and return results in completion order."""

    tasks = [asyncio.create_task(worker(item)) for item in items]
    return await asyncio.gather(*tasks)


async def run_parallel_progressive(
    items: Iterable[T],
    worker: Callable[[T], Awaitable[R]],
    on_result: Callable[[T, R], Awaitable[None]] | None = None,
) -> list[R]:
    """Run workers concurrently and optionally emit progressive callbacks.

    On ``asyncio.CancelledError``, cancels any in-flight tasks before re-raising.
    """

    async def _run_for_item(item: T) -> tuple[T, R]:
        return item, await worker(item)

    tasks = [asyncio.create_task(_run_for_item(item)) for item in items]
    results: list[R] = []
    try:
        for task in asyncio.as_completed(tasks):
            item, result = await task
            results.append(result)
            if on_result is not None:
                await on_result(item, result)
        return results
    except asyncio.CancelledError:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        raise


async def run_batches(
    plan: Iterable[T],
    run_tool: Callable[[T], Awaitable[R]],
    on_complete: Callable[[T, R], Awaitable[None]] | None = None,
) -> list[R]:
    """Execute a batch plan concurrently; invoke ``on_complete`` as each item finishes."""

    return await run_parallel_progressive(plan, run_tool, on_result=on_complete)


async def run_orchestrated_branches(
    branch_specs: Sequence[BranchToolSpec],
    requested: Iterable[str],
    worker: Callable[[str], Awaitable[R]],
    on_result: Callable[[str, R], Awaitable[None]] | None = None,
) -> list[R]:
    """Run ``requested`` branches wave-by-wave per ``build_execution_plan``."""

    requested_set = set(requested)
    filtered = [spec for spec in branch_specs if spec.branch_id in requested_set]
    if not filtered:
        return []

    results: list[R] = []
    for wave in build_execution_plan(filtered):
        wave_ids = [bid for bid in wave.branch_ids if bid in requested_set]
        if not wave_ids:
            continue
        wave_results = await run_parallel_progressive(
            wave_ids,
            worker,
            on_result=on_result,
        )
        results.extend(wave_results)
    return results
