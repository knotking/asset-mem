from __future__ import annotations

from datetime import datetime, timezone

import pytest

from metrics_aggregator import (
    apply_incremental_checkpoint_to_metrics,
    compute_property_metrics_from_checkpoints,
    should_use_full_aggregation,
)


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
    assert metrics["version"] == 2
    assert metrics["status"] == "no_checkpoints"
    assert metrics["window"]["checkpoints_considered"] == 0
    assert metrics["overall"]["headline"] is None
    assert metrics["overall"]["latest_score"] is None
    assert metrics["issues"]["total"] == 0
    assert metrics["deterioration"]["rate_points_per_day"] is None


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
    assert metrics["status"] == "pending_analysis"
    assert metrics["issues"]["total_by_severity"]["critical"] == 2
    assert metrics["issues"]["total"] == 6
    assert len(metrics["issues"]["recent"]) == 0


def test_compute_metrics_builds_headline_and_trend():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    t2 = _FakeTimestamp(datetime(2025, 1, 2, tzinfo=timezone.utc))
    checkpoints = [
        {
            "id": "c2",
            "createdAt": t2,
            "name": "Second",
            "analysisStatus": "completed",
            "aiAnalysis": {"condition_scores": {"overall": 90}},
        },
        {
            "id": "c1",
            "createdAt": t1,
            "name": "First",
            "analysisStatus": "completed",
            "aiAnalysis": {"condition_scores": {"overall": 95}},
        },
    ]
    metrics = compute_property_metrics_from_checkpoints(checkpoints)
    assert metrics["status"] == "ready"
    assert metrics["window"]["checkpoints_with_score"] == 2
    assert metrics["overall"]["headline"]["value"] == 92.5
    assert metrics["overall"]["headline"]["source"] == "weighted_mean"
    assert [p["score"] for p in metrics["overall"]["trend"]] == [95.0, 90.0]
    assert metrics["overall"]["latest_score"] == 90.0


def test_compute_metrics_deterioration_rate_positive_when_score_decreases():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    t2 = _FakeTimestamp(datetime(2025, 1, 3, tzinfo=timezone.utc))
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


def test_issues_recent_from_issues_list():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    checkpoints = [
        {
            "id": "c1",
            "createdAt": t1,
            "name": "Kitchen",
            "analysisStatus": "completed",
            "aiAnalysis": {
                "condition_scores": {"overall": 70},
                "issues": [{"description": "leak", "severity": "major"}],
            },
        }
    ]
    metrics = compute_property_metrics_from_checkpoints(checkpoints)
    assert len(metrics["issues"]["recent"]) == 1
    assert metrics["issues"]["recent"][0]["severity"] == "major"
    assert metrics["issues"]["recent"][0]["checkpointName"] == "Kitchen"


def test_apply_incremental_builds_from_empty_existing():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    checkpoint = {
        "id": "c1",
        "createdAt": t1,
        "name": "Kitchen",
        "analysisStatus": "completed",
        "aiAnalysis": {
            "condition_scores": {"overall": 80},
            "issues": [{"description": "crack", "severity": "minor"}],
        },
    }
    metrics = apply_incremental_checkpoint_to_metrics(None, checkpoint)
    assert metrics["window"]["checkpoints_considered"] == 1
    assert metrics["window"]["checkpoints_with_score"] == 1
    assert metrics["window"]["scored_sum"] == 80
    assert metrics["overall"]["headline"]["value"] == 80


def test_apply_incremental_appends_second_checkpoint():
    t1 = _FakeTimestamp(datetime(2025, 1, 1, tzinfo=timezone.utc))
    t2 = _FakeTimestamp(datetime(2025, 1, 2, tzinfo=timezone.utc))
    first = {
        "id": "c1",
        "createdAt": t1,
        "analysisStatus": "completed",
        "aiAnalysis": {"condition_scores": {"overall": 90}},
    }
    existing = compute_property_metrics_from_checkpoints([first])
    second = {
        "id": "c2",
        "createdAt": t2,
        "analysisStatus": "completed",
        "aiAnalysis": {"condition_scores": {"overall": 70}},
    }
    metrics = apply_incremental_checkpoint_to_metrics(existing, second)
    assert metrics["window"]["checkpoints_considered"] == 2
    assert metrics["overall"]["headline"]["value"] == 80
    assert [p["score"] for p in metrics["overall"]["trend"]] == [90.0, 70.0]


def test_should_use_full_aggregation_when_window_full():
    existing = {
        "version": 2,
        "window": {"checkpoints_considered": 60, "last_applied_checkpoint_id": "c60"},
    }
    assert should_use_full_aggregation(existing, {"id": "c61"}) is True


def test_should_use_full_aggregation_on_reanalysis_same_id():
    existing = {
        "version": 2,
        "window": {"checkpoints_considered": 2, "last_applied_checkpoint_id": "c1"},
    }
    assert should_use_full_aggregation(existing, {"id": "c1"}) is True
