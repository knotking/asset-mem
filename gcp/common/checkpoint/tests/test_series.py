"""Tests for checkpoint series helpers."""

from common.checkpoint.series import (
    assert_capture_deletable,
    make_series_id,
    normalize_series_location,
    resolve_series_location_key,
    series_display_name,
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


def test_assert_capture_deletable_allows_legacy():
    assert_capture_deletable({"id": "c1"})


def test_assert_capture_deletable_allows_latest():
    assert_capture_deletable({"seriesId": "s1", "isLatestInSeries": True})


def test_assert_capture_deletable_blocks_middle_revision():
    import pytest

    with pytest.raises(ValueError, match="non-latest"):
        assert_capture_deletable({"seriesId": "s1", "isLatestInSeries": False})
