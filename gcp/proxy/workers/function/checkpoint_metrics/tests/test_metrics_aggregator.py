from __future__ import annotations

from datetime import datetime, timezone

import pytest

from metrics_aggregator import compute_property_metrics_from_checkpoints


class _FakeTimestamp:
    def __init__(self, dt: datetime):
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=timezone.utc)
        self._dt = dt
        self.seconds = int(dt.timestamp())

    def to_datetime(self) -> datetime:
        return self._dt


def test_compute_metrics_handles_empty():
    metrics = compute_property_metrics_from_checkpoints([])
    assert metrics["window"]["checkpoints_considered"] == 0
    assert metrics["overall"]["latest_score"] is None
    assert metrics["issues"]["total"] == 0
    assert metrics["deterioration"]["rate_points_per_day"] is None
    assert metrics["deterioration"]["trend"] == "unknown"


def test_compute_metrics_uses_issues_by_severity_when_present():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    checkpoints = [
        {
            "id": "c1",
            "createdAt": t1,
            "analysisStatus": "completed",
            "aiAnalysis": {"issues_by_severity": {"critical": 2, "major": 1, "moderate": 0, "minor": 3}},
        }
    ]
    metrics = compute_property_metrics_from_checkpoints(checkpoints)
    assert metrics["issues"]["total_by_severity"]["critical"] == 2
    assert metrics["issues"]["total_by_severity"]["major"] == 1
    assert metrics["issues"]["total_by_severity"]["minor"] == 3
    assert metrics["issues"]["total"] == 6


def test_compute_metrics_falls_back_to_issues_list_and_defaults_unknown_to_minor():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    checkpoints = [
        {
            "id": "c1",
            "createdAt": t1,
            "analysisStatus": "completed",
            "aiAnalysis": {
                "issues": [
                    {"description": "leak", "severity": "critical"},
                    {"description": "rust", "severity": "weird"},
                    "legacy-string-issue",
                ]
            },
        }
    ]
    metrics = compute_property_metrics_from_checkpoints(checkpoints)
    assert metrics["issues"]["total_by_severity"]["critical"] == 1
    # unknown severity should count as minor
    assert metrics["issues"]["total_by_severity"]["minor"] == 2
    assert metrics["issues"]["total"] == 3


def test_compute_metrics_builds_trend_and_latest_score_from_overall_condition():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    t2 = _FakeTimestamp(datetime(2025, 1, 2, tzinfo=timezone.utc))
    checkpoints = [
        {
            "id": "c2",
            "createdAt": t2,
            "analysisStatus": "completed",
            "aiAnalysis": {"condition_scores": {"overall": 90}},
        },
        {
            "id": "c1",
            "createdAt": t1,
            "analysisStatus": "completed",
            "aiAnalysis": {"condition_scores": {"overall": 95}},
        },
    ]
    metrics = compute_property_metrics_from_checkpoints(checkpoints, trend_points=12)
    assert metrics["window"]["checkpoints_considered"] == 2
    assert [p["score"] for p in metrics["overall"]["trend"]] == [95.0, 90.0]
    assert metrics["overall"]["latest_score"] == 90.0


def test_compute_metrics_deterioration_rate_positive_when_score_decreases():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    t2 = _FakeTimestamp(datetime(2025, 1, 3, tzinfo=timezone.utc))  # 2 days later
    checkpoints = [
        {
            "id": "c1",
            "createdAt": t1,
            "analysisStatus": "completed",
            "aiAnalysis": {"condition_scores": {"overall": 100}},
        },
        {
            "id": "c2",
            "createdAt": t2,
            "analysisStatus": "completed",
            "aiAnalysis": {"condition_scores": {"overall": 90}},
        },
    ]
    metrics = compute_property_metrics_from_checkpoints(checkpoints)
    assert pytest.approx(metrics["deterioration"]["rate_points_per_day"], rel=1e-6) == 5.0
    assert metrics["deterioration"]["trend"] == "deteriorating"


def test_compute_metrics_deterioration_rate_negative_when_score_improves():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    t2 = _FakeTimestamp(datetime(2025, 1, 3, tzinfo=timezone.utc))  # 2 days later
    checkpoints = [
        {
            "id": "c1",
            "createdAt": t1,
            "analysisStatus": "completed",
            "aiAnalysis": {"condition_scores": {"overall": 80}},
        },
        {
            "id": "c2",
            "createdAt": t2,
            "analysisStatus": "completed",
            "aiAnalysis": {"condition_scores": {"overall": 90}},
        },
    ]
    metrics = compute_property_metrics_from_checkpoints(checkpoints)
    assert pytest.approx(metrics["deterioration"]["rate_points_per_day"], rel=1e-6) == -5.0
    assert metrics["deterioration"]["trend"] == "improving"


