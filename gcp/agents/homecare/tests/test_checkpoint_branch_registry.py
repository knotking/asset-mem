"""Tests that checkpoint parallel execution uses registry orchestration metadata."""

from __future__ import annotations

from agent_framework.registry.orchestration import build_execution_plan

from property_agent.checkpoint.branch_registry import CHECKPOINT_OPTIONAL_BRANCH_SPECS
from property_agent.checkpoint.analysis.parallel_runner import (
    checkpoint_optional_execution_waves,
)
from property_agent.registry import _base_tool_specs


def test_analyze_checkpoints_tool_spec_declares_branch_metadata() -> None:
    specs = _base_tool_specs()
    analyze = next(s for s in specs if s.id == "analyze_checkpoints")
    assert len(analyze.branches) == 4
    assert {b.branch_id for b in analyze.branches} == {
        "coverage",
        "diy",
        "service",
        "cost",
    }


def test_registry_exposes_list_and_analyze_checkpoint_tools() -> None:
    ids = {s.id for s in _base_tool_specs()}
    assert "list_checkpoints" in ids
    assert "analyze_checkpoints" in ids
    assert "run_checkpoint_pipeline" not in ids


def test_branch_writes_keys_match_assembler_schema() -> None:
    writes = {spec.branch_id: spec.writes_branch for spec in CHECKPOINT_OPTIONAL_BRANCH_SPECS}
    assert writes == {
        "coverage": "coverageResult",
        "diy": "diyResults",
        "service": "serviceResults",
        "cost": "costEstimationResults",
    }


def test_all_optional_branches_share_one_parallel_wave() -> None:
    waves = build_execution_plan(CHECKPOINT_OPTIONAL_BRANCH_SPECS)
    assert len(waves) == 1
    assert set(waves[0].branch_ids) == {"coverage", "diy", "service", "cost"}


def test_execution_waves_helper_filters_requested() -> None:
    waves = checkpoint_optional_execution_waves(["coverage", "cost"])
    assert waves == (("cost", "coverage"),)
