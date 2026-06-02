import pytest

from common.search_location.models import SearchLocationCoordinates, SearchLocationInput
from common.search_location.resolve import resolve_search_location
from common.search_location.serpapi_coords import (
    parse_serpapi_location_coords,
    resolve_property_address_via_serpapi,
)
from common.search_location.us_address import city_state_from_us_address


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
    assert loc.label == "123 Main St"


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


def test_city_state_from_us_address():
    assert city_state_from_us_address("1982 Helena Way, Brentwood, CA 94513") == (
        "Brentwood",
        "CA",
    )


def test_parse_serpapi_location_coords_prefers_state():
    candidates = [
        {
            "canonical_name": "Brentwood,Tennessee,United States",
            "country_code": "US",
            "gps": [-86.78, 36.03],
        },
        {
            "canonical_name": "Brentwood,Contra Costa County,California,United States",
            "country_code": "US",
            "gps": [-121.6957863, 37.931868],
        },
    ]
    resolved = parse_serpapi_location_coords(
        "1982 Helena Way, Brentwood, CA 94513",
        candidates=candidates,
    )
    assert resolved is not None
    assert resolved.lat == pytest.approx(37.931868)
    assert resolved.lng == pytest.approx(-121.6957863)
    assert "California" in resolved.label


@pytest.mark.asyncio
async def test_defaults_to_property_address_when_input_omitted(
    monkeypatch: pytest.MonkeyPatch,
):
    async def _no_geocode(_address: str):
        return None

    class FakeResponse:
        status = 200

        async def json(self):
            return [
                {
                    "canonical_name": "Brentwood,Contra Costa County,California,United States",
                    "country_code": "US",
                    "gps": [-121.6957863, 37.931868],
                }
            ]

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    class FakeSession:
        def get(self, *_args, **_kwargs):
            return FakeResponse()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    monkeypatch.setattr(
        "common.search_location.resolve._geocode_address",
        _no_geocode,
    )
    monkeypatch.setattr("aiohttp.ClientSession", lambda: FakeSession())

    loc = await resolve_search_location(
        property_address="1982 Helena Way, Brentwood, CA 94513",
    )
    assert loc is not None
    assert loc.source == "property_address"
    assert loc.coordinates.lat == pytest.approx(37.931868)


@pytest.mark.asyncio
async def test_property_address_falls_back_to_serpapi_when_geocode_unconfigured(
    monkeypatch: pytest.MonkeyPatch,
):
    async def _no_geocode(_address: str):
        return None

    class FakeResponse:
        status = 200

        async def json(self):
            return [
                {
                    "canonical_name": "Brentwood,Contra Costa County,California,United States",
                    "country_code": "US",
                    "gps": [-121.6957863, 37.931868],
                }
            ]

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    class FakeSession:
        def get(self, *_args, **_kwargs):
            return FakeResponse()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    monkeypatch.setattr(
        "common.search_location.resolve._geocode_address",
        _no_geocode,
    )
    monkeypatch.setattr("aiohttp.ClientSession", lambda: FakeSession())

    inp = SearchLocationInput(source="property_address", radius_miles=5)
    loc = await resolve_search_location(
        property_address="1982 Helena Way, Brentwood, CA 94513",
        search_location_input=inp,
    )
    assert loc is not None
    assert loc.source == "property_address"
    assert loc.coordinates.lat == pytest.approx(37.931868)
    assert loc.coordinates.lng == pytest.approx(-121.6957863)


@pytest.mark.asyncio
async def test_resolve_property_address_via_serpapi(monkeypatch: pytest.MonkeyPatch):
    class FakeResponse:
        status = 200

        async def json(self):
            return [
                {
                    "canonical_name": "Brentwood,Contra Costa County,California,United States",
                    "country_code": "US",
                    "gps": [-121.6957863, 37.931868],
                }
            ]

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    class FakeSession:
        def get(self, *_args, **_kwargs):
            return FakeResponse()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    monkeypatch.setattr("aiohttp.ClientSession", lambda: FakeSession())

    resolved = await resolve_property_address_via_serpapi(
        "1982 Helena Way, Brentwood, CA 94513"
    )
    assert resolved is not None
    assert resolved.lat == pytest.approx(37.931868)
