"""Unit tests for scoped report metrics rollup."""

from __future__ import annotations

from property_metrics import rollup_metrics_from_checkpoints


def test_rollup_metrics_counts_issues_from_checkpoints():
    metrics = rollup_metrics_from_checkpoints(
        [
            {
                "aiAnalysis": {
                    "issues": [
                        {"severity": "major", "description": "Crack"},
                        {"severity": "minor", "description": "Scuff"},
                    ]
                }
            },
            {
                "aiAnalysis": {
                    "issues_by_severity": {"critical": 1, "minor": 2},
                }
            },
        ],
        property_metrics={
            "overall": {"headline": {"value": 82, "source": "weighted_mean"}},
            "deterioration": {"trend": "stable"},
        },
    )

    assert metrics["checkpointsIncluded"] == 2
    assert metrics["issues"]["total"] == 5
    assert metrics["issues"]["total_by_severity"]["major"] == 1
    assert metrics["issues"]["total_by_severity"]["critical"] == 1
    assert metrics["overall"]["headline"]["value"] == 82
    assert metrics["deterioration"]["trend"] == "stable"
