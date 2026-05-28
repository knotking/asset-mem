"""Unit tests for SerpAPI / YouTube geo helpers."""

from property_agent.shared.inputs import SearchLocation, SearchLocationCoordinates
from property_agent.geo.address_parse import (
    _reverse_geocode_sync,
    city_region_from_us_address,
    looks_like_coordinate_pair,
    merge_search_location_sources,
    normalize_serpapi_shopping_location,
    parse_search_location_arg,
    resolve_market_label,
    strip_embedded_geo_from_query,
)
from property_agent.geo.cache import (
    _TtlCache,
    _serpapi_locations_cache,
    clear_geo_caches,
)
from property_agent.geo.http import requests
from property_agent.geo.maps_results import (
    format_google_maps_results,
    maps_lat_lon_params,
    maps_ll_from_coordinates,
    rank_maps_local_results,
)
from property_agent.geo.serpapi_locations import (
    lookup_serpapi_canonical_location,
    resolve_serpapi_location_name,
)
from property_agent.geo.youtube_geo import youtube_geo_params, youtube_location_radius_km


def _sl(
    lat: float = 37.9, lng: float = -121.7, label: str | None = "Brentwood, CA"
) -> SearchLocation:
    return SearchLocation(
        source="device_gps",
        radius_miles=5,
        coordinates=SearchLocationCoordinates(lat=lat, lng=lng),
        label=label,
    )


def test_maps_ll_format():
    ll = maps_ll_from_coordinates(37.9, -121.7, 5)
    assert ll.startswith("@37.9")
    assert ll.endswith("14z")


def test_maps_lat_lon_params():
    params = maps_lat_lon_params(_sl())
    assert params["lat"] == 37.9
    assert params["lon"] == -121.7
    assert params["z"] == 14
    assert params["nearby"] is True


def test_strip_embedded_geo_from_query():
    q = "garage door repair professionals near 37.9,-121.7 within 5 miles"
    assert strip_embedded_geo_from_query(q) == "garage door repair professionals"


def test_resolve_market_label_prefers_property_address_over_coords():
    partial = SearchLocation(
        source="device_gps",
        radius_miles=5,
        coordinates=SearchLocationCoordinates(lat=37.9, lng=-121.7),
    )
    label = resolve_market_label(
        partial, property_address="1982 Helena Way, Brentwood, CA 94513"
    )
    assert label == "1982 Helena Way, Brentwood, CA 94513"


def test_rank_maps_sorts_by_distance_without_trade_keyword_filter():
    items = [
        {
            "title": "Caliber Collision",
            "address": "Brentwood, CA",
            "gps_coordinates": {"latitude": 37.93, "longitude": -121.69},
        },
        {
            "title": "Up Right Garage Door Repair Brentwood",
            "address": "8375 Brentwood Blvd, Brentwood, CA 94513",
            "gps_coordinates": {"latitude": 37.92, "longitude": -121.70},
            "rating": 4.9,
        },
        {
            "title": "The Painted Finish",
            "address": "Oakley, CA 94561",
            "gps_coordinates": {"latitude": 37.75, "longitude": -121.71},
            "type": "Painter",
        },
    ]
    ranked = rank_maps_local_results(
        items,
        anchor_lat=37.9,
        anchor_lng=-121.7,
        property_address="1982 Helena Way, Brentwood, CA 94513",
        max_results=5,
    )
    titles = [(r.get("title") or "") for r in ranked]
    assert len(titles) == 3
    assert "Caliber Collision" in titles
    assert titles[-1] == "The Painted Finish"
    distances = [r["_distance_miles"] for r in ranked]
    assert distances == sorted(distances)


def test_rank_maps_demotes_retail_place_types():
    items = [
        {
            "title": "Brentwood Ace Hardware",
            "address": "Brentwood, CA",
            "gps_coordinates": {"latitude": 37.931, "longitude": -121.696},
            "type": "Hardware store",
            "rating": 4.7,
        },
        {
            "title": "Up Right Garage Door Repair",
            "address": "Brentwood, CA",
            "gps_coordinates": {"latitude": 37.932, "longitude": -121.697},
            "type": "Garage door supplier",
            "rating": 4.9,
        },
    ]
    ranked = rank_maps_local_results(
        items,
        anchor_lat=37.9319,
        anchor_lng=-121.6958,
        max_results=2,
    )
    assert (ranked[0].get("title") or "") == "Up Right Garage Door Repair"
    params = youtube_geo_params(_sl())
    assert params["location"] == "37.9,-121.7"
    assert params["locationRadius"] == "1000km"


def test_youtube_location_radius_km_clamps_to_api_max():
    assert youtube_location_radius_km() == 1000


def test_resolve_serpapi_location_name_uses_canonical_label():
    canonical = "Brentwood,Contra Costa County,California,United States"
    assert resolve_serpapi_location_name(_sl(label=canonical)) == canonical


def test_lookup_serpapi_canonical_location_picks_nearest(monkeypatch):
    _serpapi_locations_cache.clear()

    class FakeResp:
        ok = True

        @staticmethod
        def json():
            return [
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

    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResp())
    sl = _sl(lat=37.9, lng=-121.7, label=None)
    assert (
        lookup_serpapi_canonical_location(
            sl, property_address="1982 Helena Way, Brentwood, CA 94513"
        )
        == "Brentwood,Contra Costa County,California,United States"
    )


def test_city_region_from_us_address_parses_street():
    assert (
        city_region_from_us_address("1982 Helena Way, Brentwood, CA 94513")
        == "Brentwood, CA 94513"
    )


def test_resolve_serpapi_location_name_from_property_address_only(monkeypatch):
    _serpapi_locations_cache.clear()

    class FakeResp:
        ok = True

        @staticmethod
        def json():
            return [
                {
                    "canonical_name": "Brentwood,Contra Costa County,California,United States",
                    "country_code": "US",
                    "gps": [-121.6957863, 37.931868],
                },
            ]

    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResp())
    assert (
        resolve_serpapi_location_name(
            None, property_address="1982 Helena Way, Brentwood, CA 94513"
        )
        == "Brentwood,Contra Costa County,California,United States"
    )


def test_normalize_serpapi_shopping_location_strips_country_suffix():
    assert (
        normalize_serpapi_shopping_location("Brentwood, CA 94513, USA")
        == "Brentwood, CA 94513"
    )


def test_looks_like_coordinate_pair():
    assert looks_like_coordinate_pair("37.9000,-121.7000")
    assert not looks_like_coordinate_pair("Brentwood, CA")


def test_lookup_serpapi_canonical_location_returns_none_without_city_state():
    assert (
        lookup_serpapi_canonical_location(_sl(label=None), property_address=None)
        is None
    )


def test_parse_search_location_arg_without_source_defaults_device_gps():
    partial = {
        "coordinates": {"lat": 37.9, "lng": -121.7},
        "radius_miles": 5,
    }
    sl = parse_search_location_arg(partial)
    assert sl is not None
    assert sl.source == "device_gps"
    assert sl.coordinates.lat == 37.9
    assert sl.coordinates.lng == -121.7


def test_merge_search_location_fills_source_from_session():
    session = {
        "source": "device_gps",
        "radius_miles": 5,
        "coordinates": {"lat": 37.9, "lng": -121.7},
        "label": "Brentwood, CA",
    }
    tool_arg = {
        "coordinates": {"lat": 37.9, "lng": -121.7},
        "radius_miles": 5,
    }
    sl = merge_search_location_sources(tool_arg, session)
    assert sl is not None
    assert sl.source == "device_gps"
    assert sl.label == "Brentwood, CA"


def test_ttl_cache_expires(monkeypatch):
    import time as time_mod

    clock = {"now": 0.0}
    monkeypatch.setattr(time_mod, "monotonic", lambda: clock["now"])
    cache = _TtlCache(1.0, max_size=4)
    cache.set("key", "value")
    assert cache.get("key") == "value"
    clock["now"] = 2.0
    assert cache.get("key") is None


def test_reverse_geocode_cache_avoids_repeat_requests(monkeypatch):
    clear_geo_caches()
    calls = {"n": 0}

    class FakeResp:
        ok = True

        @staticmethod
        def json():
            return {
                "status": "OK",
                "results": [
                    {
                        "address_components": [
                            {"long_name": "Brentwood", "types": ["locality"]},
                            {"long_name": "94513", "types": ["postal_code"]},
                            {
                                "short_name": "CA",
                                "types": ["administrative_area_level_1"],
                            },
                        ],
                    }
                ],
            }

    def fake_get(*_a, **_k):
        calls["n"] += 1
        return FakeResp()

    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test-key")
    monkeypatch.setattr(requests, "get", fake_get)
    assert _reverse_geocode_sync(37.9319, -121.6958) is not None
    assert _reverse_geocode_sync(37.9319, -121.6958) is not None
    assert calls["n"] == 1


def test_format_google_maps_results():
    text = format_google_maps_results(
        {
            "local_results": [
                {
                    "title": "Joe's Plumbing",
                    "address": "1 Main St",
                    "rating": 4.5,
                    "phone": "555-0100",
                }
            ]
        }
    )
    assert "Joe's Plumbing" in text
    assert "1 Main St" in text
