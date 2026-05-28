"""Tests for branch orchestration plan builder."""

from __future__ import annotations

import pytest

from agent_framework.registry.orchestration import (
    BranchToolSpec,
    OrchestrationCycleError,
    branch_specs_for_ids,
    build_execution_plan,
)


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


def test_build_execution_plan_single_wave_same_group() -> None:
    specs = (
        _spec("coverage"),
        _spec("diy"),
        _spec("service"),
        _spec("cost"),
    )
    waves = build_execution_plan(specs)
    assert len(waves) == 1
    assert set(waves[0].branch_ids) == {"coverage", "diy", "service", "cost"}


def test_build_execution_plan_respects_depends_on() -> None:
    specs = (
        _spec("coverage"),
        _spec("service"),
        _spec("cost", depends_on=("service",)),
    )
    waves = build_execution_plan(specs)
    assert [set(w.branch_ids) for w in waves] == [
        {"coverage", "service"},
        {"cost"},
    ]


def test_build_execution_plan_splits_parallel_groups() -> None:
    specs = (
        _spec("coverage", parallel_group="wave_a"),
        _spec("diy", parallel_group="wave_b"),
    )
    waves = build_execution_plan(specs)
    assert len(waves) == 2
    assert waves[0].branch_ids == ("coverage",)
    assert waves[1].branch_ids == ("diy",)


def test_build_execution_plan_detects_cycle() -> None:
    specs = (
        _spec("a", depends_on=("b",)),
        _spec("b", depends_on=("a",)),
    )
    with pytest.raises(OrchestrationCycleError):
        build_execution_plan(specs)


def test_branch_specs_for_ids_preserves_order() -> None:
    specs = (_spec("a"), _spec("b"), _spec("c"))
    out = branch_specs_for_ids(specs, ["c", "a"])
    assert [s.branch_id for s in out] == ["c", "a"]
