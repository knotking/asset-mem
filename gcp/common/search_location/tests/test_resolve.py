import pytest

from common.search_location.models import SearchLocationCoordinates, SearchLocationInput
from common.search_location.resolve import resolve_search_location


@pytest.mark.asyncio
async def test_device_gps_from_input():
    inp = SearchLocationInput(
        source="device_gps",
        radius_miles=10,
        coordinates=SearchLocationCoordinates(lat=37.9, lng=-121.7),
    )
    loc = await resolve_search_location(
        property_address="123 Main St",
        search_location_input=inp,
    )
    assert loc is not None
    assert loc.source == "device_gps"
    assert loc.radius_miles == 10
    assert loc.coordinates.lat == 37.9
    assert loc.label is None


@pytest.mark.asyncio
async def test_legacy_device_gps():
    loc = await resolve_search_location(
        property_address="123 Main St",
        location_type="location",
        location_coordinates={"lat": 37.5, "lng": -122.0},
        location_radius=8,
    )
    assert loc is not None
    assert loc.source == "device_gps"
    assert loc.radius_miles == 8


@pytest.mark.asyncio
async def test_device_gps_ignores_property_address_for_market():
    """GPS mode must not use property address as coordinates source."""
    inp = SearchLocationInput(
        source="device_gps",
        coordinates=SearchLocationCoordinates(lat=40.0, lng=-74.0),
    )
    loc = await resolve_search_location(
        property_address="1982 Helena Way, Brentwood, CA",
        search_location_input=inp,
    )
    assert loc.coordinates.lat == 40.0
    assert loc.coordinates.lng == -74.0
