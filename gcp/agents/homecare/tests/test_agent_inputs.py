"""Validation tests for agent input schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from property_agent.agent_inputs import SearchLocation, SearchLocationCoordinates


def test_search_location_radius_accepts_valid_range() -> None:
    sl = SearchLocation(
        source="device_gps",
        radius_miles=50,
        coordinates=SearchLocationCoordinates(lat=37.9, lng=-121.7),
    )
    assert sl.radius_miles == 50


def test_search_location_radius_rejects_below_minimum() -> None:
    with pytest.raises(ValidationError):
        SearchLocation(
            source="device_gps",
            radius_miles=4,
            coordinates=SearchLocationCoordinates(lat=37.9, lng=-121.7),
        )


def test_search_location_radius_rejects_above_maximum() -> None:
    with pytest.raises(ValidationError):
        SearchLocation(
            source="device_gps",
            radius_miles=101,
            coordinates=SearchLocationCoordinates(lat=37.9, lng=-121.7),
        )
