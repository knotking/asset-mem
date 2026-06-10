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


def test_every_chip_carries_structured_action() -> None:
    analysis = {
        "analysisStatus": {"diy": "completed", "cost": "completed"},
        "diyResults": {"diySteps": {"steps": []}},
        "costEstimationResults": {"costEstimates": {"Service": {"cost_range": "$300"}}},
    }
    actions = build_suggested_actions_for_analysis(analysis)
    assert actions
    for chip in actions:
        action = chip.get("action")
        assert isinstance(action, dict), chip["label"]
        assert action.get("type") in ("run_branch", "discuss", "replay_report")
        if action["type"] == "run_branch":
            assert action.get("branch") in ("coverage", "diy", "service", "cost")


def test_discuss_chip_topic_matches_completed_branch() -> None:
    analysis = {
        "analysisStatus": {"diy": "completed"},
        "diyResults": {"diySteps": {"steps": []}},
    }
    actions = build_suggested_actions_for_analysis(analysis)
    discuss = [a for a in actions if a["action"]["type"] == "discuss"]
    assert discuss and discuss[0]["action"]["topic"] == "diy"
