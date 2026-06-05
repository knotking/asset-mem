"""Tests for suggested action chip builder."""

from __future__ import annotations

from property_agent.routing.suggested_actions import (
    build_suggested_actions_for_analysis,
    merge_suggested_actions_into_content_json,
)


def test_suggested_actions_after_cost_and_diy() -> None:
    analysis = {
        "analysisStatus": {"diy": "completed", "cost": "completed"},
        "diyResults": {"diySteps": {"steps": []}},
        "costEstimationResults": {"costEstimates": {"Service": {"cost_range": "$300"}}},
    }
    actions = build_suggested_actions_for_analysis(analysis)
    labels = [a["label"] for a in actions]
    assert "Why is pro so expensive?" in labels


def test_merge_into_content_json() -> None:
    analysis = {
        "analysisStatus": {"service": "completed"},
        "serviceResults": {"localPros": {}},
    }
    out = merge_suggested_actions_into_content_json({"analysis": analysis}, analysis)
    assert "suggestedActions" in out
    assert isinstance(out["suggestedActions"], list)
