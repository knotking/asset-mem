"""Tests for shopping_agent SerpAPI geo params."""

import json

import pytest

from property_agent.sub_agents.shopping_agent.agent import (
    _serp_shopping_price_display,
    _serp_shopping_product_link,
    product_recommendations,
)


def test_product_recommendations_passes_serpapi_location(
    monkeypatch: pytest.MonkeyPatch,
):
    captured: list[dict] = []

    class FakeSearch:
        def __init__(self, params):
            captured.append(params)

        def get_dict(self):
            return {"shopping_results": []}

    monkeypatch.setenv("SERP_API_KEY", "test-key")
    import serpapi as serpapi_mod

    monkeypatch.setattr(serpapi_mod, "GoogleSearch", FakeSearch)

    canonical = "Brentwood,Contra Costa County,California,United States"
    sl = {
        "source": "device_gps",
        "radius_miles": 5,
        "coordinates": {"lat": 37.9, "lng": -121.7},
        "label": canonical,
    }
    raw = product_recommendations("garage door paint", "DIY", search_location=sl)
    data = json.loads(raw)
    assert "recommendedProducts" in data
    assert len(captured) == 1
    assert captured[0]["engine"] == "google_shopping"
    assert captured[0]["location"] == canonical


def test_product_recommendations_street_property_address_uses_city_region(
    monkeypatch: pytest.MonkeyPatch,
):
    captured: list[dict] = []

    class FakeSearch:
        def __init__(self, params):
            captured.append(params)

        def get_dict(self):
            return {"shopping_results": []}

    monkeypatch.setenv("SERP_API_KEY", "test-key")
    import serpapi as serpapi_mod

    monkeypatch.setattr(serpapi_mod, "GoogleSearch", FakeSearch)

    import property_agent.serpapi_geo as sg

    sg._serpapi_locations_cache.clear()

    class FakeLocResp:
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

    monkeypatch.setattr(sg.requests, "get", lambda *a, **k: FakeLocResp())

    sl = {
        "source": "device_gps",
        "radius_miles": 5,
        "coordinates": {"lat": 37.9, "lng": -121.7},
    }
    product_recommendations(
        "garage door paint",
        "DIY",
        search_location=sl,
        property_address="1982 Helena Way, Brentwood, CA 94513",
    )
    assert len(captured) == 1
    assert (
        captured[0]["location"]
        == "Brentwood,Contra Costa County,California,United States"
    )


def test_serp_shopping_product_link_prefers_product_link() -> None:
    assert (
        _serp_shopping_product_link(
            {"product_link": "https://google.com/shopping/product/1", "link": ""}
        )
        == "https://google.com/shopping/product/1"
    )
    assert _serp_shopping_product_link({"link": "https://legacy.example/p"}) == (
        "https://legacy.example/p"
    )


def test_serp_shopping_price_display() -> None:
    assert _serp_shopping_price_display({"price": "$12.99"}) == "$12.99"
    assert _serp_shopping_price_display({"extracted_price": 9.5}) == "$9.50"
    assert _serp_shopping_price_display({"price": "Price not available"}) is None
    assert _serp_shopping_price_display({}) is None


def test_product_recommendations_maps_price_and_product_link(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeSearch:
        def __init__(self, params):
            pass

        def get_dict(self):
            return {
                "shopping_results": [
                    {
                        "title": "Test Paint",
                        "product_link": "https://www.google.com/shopping/product/123",
                        "source": "Home Depot",
                        "reviews": 42,
                        "thumbnail": "https://example.com/thumb.jpg",
                        "price": "$19.97",
                        "extracted_price": 19.97,
                    },
                ]
            }

    monkeypatch.setenv("SERP_API_KEY", "test-key")
    import serpapi as serpapi_mod

    monkeypatch.setattr(serpapi_mod, "GoogleSearch", FakeSearch)

    raw = product_recommendations("exterior paint", "DIY")
    products = json.loads(raw)["recommendedProducts"]["DIY"]["products"]
    assert len(products) == 1
    p = products[0]
    assert p["item_name"] == "Test Paint"
    assert p["item_price"] == "$19.97"
    assert p["price"] == "$19.97"
    assert p["store_url"] == "https://www.google.com/shopping/product/123"
