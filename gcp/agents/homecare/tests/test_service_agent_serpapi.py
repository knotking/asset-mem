"""Tests for service_agent SerpAPI Google Maps integration."""

from types import SimpleNamespace

import pytest

from property_agent.agents.service_agent import agent as service_mod


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
    out = service_mod._run_serpapi_maps_search(
        "plumber near 37.9,-121.7 within 5 miles",
        sl,
        property_address="1982 Helena Way, Brentwood, CA 94513",
    )
    assert len(captured) == 1
    params = captured[0]
    assert params["engine"] == "google_maps"
    assert params["type"] == "search"
    assert params["lat"] == 37.9
    assert params["lon"] == -121.7
    assert params["nearby"] is True
    assert "37.9" not in params["q"]
    assert "Local Pro" in out


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
    out = service_mod._run_serpapi_maps_search(
        "residential garage door paint repair professionals",
        partial,
        property_address="1982 Helena Way, Brentwood, CA 94513",
    )
    assert captured[0]["lat"] == 37.9
    assert captured[0]["lon"] == -121.7
    assert "Bay Area Door" in out


def test_append_serpapi_fallback_hint_includes_retrieval_stem() -> None:
    state = {
        "checkpoint_retrieval_search_query": (
            "residential garage door paint chipping scratches repair"
        )
    }
    tool_context = SimpleNamespace(state=state)
    raw = "SerpAPI Maps error: Your account has run out of searches."
    out = service_mod._append_serpapi_fallback_hint(
        raw,
        query="home maintenance and inspection services",
        tool_context=tool_context,
    )
    assert "SERPAPI_FALLBACK_HINT" in out
    assert "residential garage door paint chipping" in out
    assert "home inspection" in out.lower()


@pytest.mark.asyncio
async def test_serpapi_search_appends_hint_on_maps_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fail_maps(query, resolved, property_address=None):
        return "SerpAPI Maps error: quota exceeded"

    monkeypatch.setattr(service_mod, "_run_serpapi_maps_search", _fail_maps)
    state = {"checkpoint_retrieval_search_query": "garage door paint repair"}
    tool_context = SimpleNamespace(state=state)
    sl = {
        "source": "property_address",
        "radius_miles": 5,
        "coordinates": {"lat": 37.9, "lng": -121.7},
    }
    out = await service_mod.serpapi_search(
        "generic inspection services",
        search_location=sl,
        tool_context=tool_context,
    )
@pytest.mark.asyncio
async def test_serpapi_search_resolves_property_address_when_coords_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[dict] = []

    class FakeSearch:
        def __init__(self, params):
            captured.append(params)

        def get_dict(self):
            return {
                "local_results": [
                    {"title": "Brentwood Pro", "address": "Brentwood, CA", "rating": 4.9}
                ]
            }

    def _fake_resolve(property_address: str, state_sl):
        from property_agent.shared.inputs import SearchLocation, SearchLocationCoordinates

        return SearchLocation(
            source="property_address",
            radius_miles=5,
            coordinates=SearchLocationCoordinates(lat=37.931868, lng=-121.6957863),
            label="Brentwood, CA",
        )

    monkeypatch.setenv("SERP_API_KEY", "test-key")
    import serpapi as serpapi_mod

    monkeypatch.setattr(serpapi_mod, "GoogleSearch", FakeSearch)
    monkeypatch.setattr(
        service_mod,
        "_resolve_search_location_from_property_address",
        _fake_resolve,
    )

    tool_context = SimpleNamespace(
        state={"property_address": "1982 Helena Way, Brentwood, CA 94513"}
    )
    out = await service_mod.serpapi_search(
        "garage door repair",
        search_location=None,
        tool_context=tool_context,
    )
    assert captured
    assert captured[0]["lat"] == pytest.approx(37.931868)
    assert captured[0]["lon"] == pytest.approx(-121.6957863)
    assert "Brentwood Pro" in out

