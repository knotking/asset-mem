"""Tests for session optional-branch completion detection."""

from __future__ import annotations

from property_agent.routing.query_mode.branch_analysis import (
    session_optional_branches_completed,
)


def test_session_optional_branches_completed_uses_pipeline_marker() -> None:
    completed = session_optional_branches_completed(
        {"_checkpoint_pipeline_completed": ["coverage", "diy", "service"]}
    )
    assert completed == frozenset({"coverage", "diy", "service"})


def test_session_optional_branches_completed_uses_analysis_status() -> None:
    completed = session_optional_branches_completed(
        {
            "checkpoint_analysis": {
                "analysis": {
                    "analysisStatus": {
                        "cost": "completed",
                        "diy": "pending",
                    }
                }
            }
        }
    )
    assert completed == frozenset({"cost"})
