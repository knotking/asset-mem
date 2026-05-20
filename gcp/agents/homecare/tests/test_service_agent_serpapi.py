"""Tests for service pipeline SerpAPI Google Maps integration (orchestrator)."""

import json

import pytest

from property_agent.sub_agents.service_agent.orchestrator import run_service_pipeline_sync


def test_serpapi_maps_search_uses_structured_geo(monkeypatch: pytest.MonkeyPatch):
    captured: list[dict] = []

    class FakeSearch:
        def __init__(self, params):
            captured.append(params)

        def get_dict(self):
            return {
                "local_results": [
                    {"title": "Local Pro", "address": "123 St", "rating": 4.8}
                ]
            }

    monkeypatch.setenv("SERP_API_KEY", "test-key")
    import serpapi as serpapi_mod

    monkeypatch.setattr(serpapi_mod, "GoogleSearch", FakeSearch)

    sl = {
        "source": "device_gps",
        "radius_miles": 5,
        "coordinates": {"lat": 37.9, "lng": -121.7},
    }
    out = run_service_pipeline_sync(
        "plumber near 37.9,-121.7 within 5 miles",
        property_address="1982 Helena Way, Brentwood, CA 94513",
        search_location=sl,
    )
    assert len(captured) == 1
    params = captured[0]
    assert params["engine"] == "google_maps"
    assert params["type"] == "search"
    assert params["lat"] == 37.9
    assert params["lon"] == -121.7
    assert params["nearby"] is True
    assert "37.9" not in params["q"]
    body = json.loads(out)
    names = [
        p["name"]
        for p in body["serviceResults"]["localPros"]["serpAPIResults"]
        if isinstance(p, dict)
    ]
    assert "Local Pro" in names


def test_serpapi_maps_search_partial_llm_payload_without_source(
    monkeypatch: pytest.MonkeyPatch,
):
    """Reproduce ADK web: LLM passes coordinates + radius but omits source."""
    captured: list[dict] = []

    class FakeSearch:
        def __init__(self, params):
            captured.append(params)

        def get_dict(self):
            return {"local_results": [{"title": "Bay Area Door", "address": "CA"}]}

    monkeypatch.setenv("SERP_API_KEY", "test-key")
    import serpapi as serpapi_mod

    monkeypatch.setattr(serpapi_mod, "GoogleSearch", FakeSearch)

    partial = {
        "coordinates": {"lng": -121.7, "lat": 37.9},
        "radius_miles": 5,
    }
    out = run_service_pipeline_sync(
        "residential garage door paint repair professionals",
        property_address="1982 Helena Way, Brentwood, CA 94513",
        search_location=partial,
    )
    assert captured[0]["lat"] == 37.9
    assert captured[0]["lon"] == -121.7
    body = json.loads(out)
    names = [
        p["name"]
        for p in body["serviceResults"]["localPros"]["serpAPIResults"]
        if isinstance(p, dict)
    ]
    assert "Bay Area Door" in names
