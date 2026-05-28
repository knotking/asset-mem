"""Tests for run_orchestrated_branches."""

from __future__ import annotations

import asyncio

import pytest

from agent_framework.execution.parallel_runner import run_orchestrated_branches
from agent_framework.registry.orchestration import BranchToolSpec


def _spec(
    branch_id: str,
    *,
    parallel_group: str = "g1",
    depends_on: tuple[str, ...] = (),
) -> BranchToolSpec:
    return BranchToolSpec(
        branch_id=branch_id,
        writes_branch=f"{branch_id}Result",
        parallel_result_key=f"parallel_{branch_id}",
        parallel_group=parallel_group,
        depends_on=depends_on,
    )


@pytest.mark.asyncio
async def test_run_orchestrated_branches_runs_waves_sequentially() -> None:
    order: list[str] = []

    async def worker(branch_id: str) -> str:
        order.append(f"start:{branch_id}")
        await asyncio.sleep(0.01)
        order.append(f"end:{branch_id}")
        return branch_id

    specs = (
        _spec("fast", parallel_group="wave1"),
        _spec("slow", parallel_group="wave2", depends_on=("fast",)),
    )
    out = await run_orchestrated_branches(specs, ["fast", "slow"], worker)
    assert sorted(out) == ["fast", "slow"]
    assert order.index("end:fast") < order.index("start:slow")
