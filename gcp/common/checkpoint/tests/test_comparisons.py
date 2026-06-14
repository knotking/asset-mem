"""Tests for checkpoint comparison history helpers."""

from common.checkpoint.comparisons import (
    build_visual_diff_from_result,
    comparison_record_from_visual_diff,
)


def test_build_visual_diff_from_result_includes_match_metadata():
    result = {
        "summary": "New stain",
        "semanticChanges": ["water stain"],
        "regions": [],
        "similarityScore": 0.82,
    }
    visual_diff = build_visual_diff_from_result(
        comparison_result=result,
        compared_with_checkpoint_id="prev-id",
        match_reason="series_previous",
        compared_with_revision_number=2,
        diff_id="diff_test",
    )
    assert visual_diff["id"] == "diff_test"
    assert visual_diff["comparedWithCheckpointId"] == "prev-id"
    assert visual_diff["matchReason"] == "series_previous"
    assert visual_diff["comparedWithRevisionNumber"] == 2
    assert visual_diff["summary"] == "New stain"


def test_comparison_record_from_visual_diff_adds_source():
    record = comparison_record_from_visual_diff(
        {"id": "diff_1", "status": "completed", "similarityScore": 0.9},
        source="legacy",
    )
    assert record["id"] == "diff_1"
    assert record["source"] == "legacy"
