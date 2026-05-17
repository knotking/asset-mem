"""Unit tests for ADK eval config builders (no live Vertex)."""

from __future__ import annotations

from typing import Any

from eval.rubric_criteria import (
    config_checkpoint,
    config_checkpoint_branch,
    config_default,
    config_routing,
)


def _rubric_id(rubric: Any) -> str:
    if hasattr(rubric, "rubric_id"):
        return str(rubric.rubric_id)
    return str(rubric["rubric_id"])


def test_default_config_has_trajectory_and_rouge() -> None:
    cfg = config_default()
    assert "tool_trajectory_avg_score" in cfg.criteria
    assert "response_match_score" in cfg.criteria


def test_routing_config_uses_tool_use_rubrics() -> None:
    cfg = config_routing()
    assert "rubric_based_tool_use_quality_v1" in cfg.criteria
    criterion = cfg.criteria["rubric_based_tool_use_quality_v1"]
    assert len(criterion.rubrics) >= 1
    assert _rubric_id(criterion.rubrics[0]) == "transfer_to_doculink"


def test_checkpoint_config_uses_response_rubrics_and_semantic_match() -> None:
    cfg = config_checkpoint()
    assert "rubric_based_final_response_quality_v1" in cfg.criteria
    assert "final_response_match_v2" in cfg.criteria
    response = cfg.criteria["rubric_based_final_response_quality_v1"]
    assert len(response.rubrics) >= 3
    extra = getattr(response, "evaluate_full_response", None)
    if extra is not None:
        assert extra is True


def test_checkpoint_branch_merges_branch_rubrics() -> None:
    cost_cfg = config_checkpoint_branch("cost")
    diy_cfg = config_checkpoint_branch("diy")
    cost_rubrics = cost_cfg.criteria["rubric_based_final_response_quality_v1"].rubrics
    diy_rubrics = diy_cfg.criteria["rubric_based_final_response_quality_v1"].rubrics
    assert len(cost_rubrics) == len(diy_rubrics)
    cost_ids = {_rubric_id(r) for r in cost_rubrics}
    diy_ids = {_rubric_id(r) for r in diy_rubrics}
    assert "cost_estimates_present" in cost_ids
    assert "diy_guidance_present" in diy_ids
    assert "dual_format_json" in cost_ids
