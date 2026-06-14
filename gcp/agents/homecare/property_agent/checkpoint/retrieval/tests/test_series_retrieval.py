"""Tests for series-aware checkpoint retrieval."""

from property_agent.checkpoint.retrieval.series_retrieval import (
    maybe_collapse_to_latest_per_series,
    query_requests_series_history,
)


def test_query_requests_series_history_detects_change_over_time():
    assert query_requests_series_history("How has the kitchen changed over time?")
    assert query_requests_series_history("Show me the timeline for the roof")
    assert not query_requests_series_history("What is wrong with the kitchen?")


def test_maybe_collapse_to_latest_per_series_default():
    checkpoints = [
        {"id": "c1", "seriesId": "series_kitchen", "revisionNumber": 1, "isLatestInSeries": False},
        {"id": "c2", "seriesId": "series_kitchen", "revisionNumber": 2, "isLatestInSeries": True},
    ]
    collapsed = maybe_collapse_to_latest_per_series(checkpoints, "kitchen condition", mode="default")
    assert len(collapsed) == 1
    assert collapsed[0]["id"] == "c2"


def test_maybe_collapse_skips_when_history_requested():
    checkpoints = [
        {"id": "c1", "seriesId": "series_kitchen", "revisionNumber": 1},
        {"id": "c2", "seriesId": "series_kitchen", "revisionNumber": 2},
    ]
    result = maybe_collapse_to_latest_per_series(
        checkpoints, "show all captures for kitchen history", mode="default"
    )
    assert len(result) == 2


def test_maybe_collapse_skips_for_by_id_mode():
    checkpoints = [
        {"id": "c1", "seriesId": "series_kitchen", "revisionNumber": 1},
        {"id": "c2", "seriesId": "series_kitchen", "revisionNumber": 2},
    ]
    result = maybe_collapse_to_latest_per_series(checkpoints, "kitchen", mode="by_id")
    assert len(result) == 2
