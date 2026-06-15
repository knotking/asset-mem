"""Tests for checkpoint series helpers."""

from common.checkpoint.series import (
    assert_capture_deletable,
    make_series_id,
    normalize_series_location,
    pick_latest_captures_per_series,
    resolve_series_location_key,
    series_display_name,
    series_key_for_checkpoint,
    should_reassign_series_after_analysis,
    target_series_id_for_location,
    user_provided_series_location,
)


def test_normalize_series_location():
    assert normalize_series_location("Kitchen") == "kitchen"
    assert normalize_series_location("") == "unspecified"
    assert normalize_series_location(None) == "unspecified"


def test_make_series_id_stable():
    assert make_series_id("kitchen") == "series_kitchen"
    assert make_series_id("living room") == "series_living-room"


def test_series_display_name():
    assert series_display_name("Kitchen", None) == "Kitchen"
    assert series_display_name("", "Monthly") == "Monthly"
    assert series_display_name("", "") == "Untitled"


def test_resolve_series_location_key_prefers_location():
    assert resolve_series_location_key(location="Garage", name="Other") == "garage"
    assert resolve_series_location_key(location="", name="Roof") == "roof"
    assert resolve_series_location_key(location="", name="Roof", allow_name_fallback=False) == "unspecified"


def test_should_reassign_series_after_analysis_when_location_inferred():
    cp = {
        "seriesId": "series_checkpoint-jun-15",
        "userProvidedLocation": False,
    }
    assert should_reassign_series_after_analysis(cp, "Vehicle - Exterior") is True
    assert (
        target_series_id_for_location("Vehicle - Exterior")
        == make_series_id("vehicle - exterior")
    )


def test_should_not_reassign_when_user_provided_location():
    cp = {
        "seriesId": "series_kitchen",
        "userProvidedLocation": True,
        "location": "Kitchen",
    }
    assert should_reassign_series_after_analysis(cp, "Kitchen") is False


def test_user_provided_series_location_legacy_infers_from_location_field():
    assert user_provided_series_location({"location": "Garage"}) is True
    assert user_provided_series_location({"userProvidedLocation": False}) is False


def test_assert_capture_deletable_allows_legacy():
    assert_capture_deletable({"id": "c1"})


def test_assert_capture_deletable_allows_latest():
    assert_capture_deletable({"seriesId": "s1", "isLatestInSeries": True})


def test_assert_capture_deletable_blocks_middle_revision():
    import pytest

    with pytest.raises(ValueError, match="non-latest"):
        assert_capture_deletable({"seriesId": "s1", "isLatestInSeries": False})


def test_pick_latest_captures_per_series_keeps_highest_revision():
    checkpoints = [
        {
            "id": "c1",
            "seriesId": "series_kitchen",
            "revisionNumber": 1,
            "isLatestInSeries": False,
            "location": "Kitchen",
        },
        {
            "id": "c2",
            "seriesId": "series_kitchen",
            "revisionNumber": 2,
            "isLatestInSeries": True,
            "location": "Kitchen",
        },
    ]
    latest = pick_latest_captures_per_series(checkpoints)
    assert len(latest) == 1
    assert latest[0]["id"] == "c2"


def test_pick_latest_captures_per_series_groups_legacy_by_location():
    checkpoints = [
        {"id": "a", "location": "Garage", "createdAt": type("T", (), {"seconds": 1})()},
        {"id": "b", "location": "garage", "createdAt": type("T", (), {"seconds": 2})()},
    ]
    latest = pick_latest_captures_per_series(checkpoints)
    assert len(latest) == 1
    assert latest[0]["id"] == "b"


def test_series_key_for_checkpoint_prefers_series_id():
    assert series_key_for_checkpoint({"seriesId": "series_roof"}) == "series_roof"
    assert series_key_for_checkpoint({"location": "Roof"}) == "legacy-loc:roof"
