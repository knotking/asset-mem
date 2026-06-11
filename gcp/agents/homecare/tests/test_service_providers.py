"""Tests for checkpoint service provider prefetch and geo filtering."""

import json

from property_agent.checkpoint.analysis.service_providers import (
    apply_prefetched_serp_to_branch_result,
    filter_providers_by_property_market,
    local_google_search_query,
    local_google_search_query_from_payload,
    local_google_search_query_from_tool_state,
    provider_matches_property_market,
    seed_service_branch_tool_state,
    service_maps_search_query,
)


def test_service_maps_search_query_prefers_trade_query() -> None:
    payload = {
        "checkpoint_service_trade_query": "auto body paint repair shop",
        "checkpoint_retrieval_search_query": "vehicle rear quarter panel scratches",
        "user_query": "Give me a complete analysis",
    }
    assert service_maps_search_query(payload) == "auto body paint repair shop"


def test_local_google_search_query_includes_city_region() -> None:
    addr = "1982 Helena Way, Brentwood, CA 94513"
    q = local_google_search_query(
        trade_query="auto body paint repair shop",
        property_address=addr,
    )
    assert q == "auto body paint repair shop near Brentwood, CA 94513"


def test_local_google_search_query_from_payload() -> None:
    payload = {
        "checkpoint_service_trade_query": "auto body paint repair shop",
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
    }
    assert (
        local_google_search_query_from_payload(payload)
        == "auto body paint repair shop near Brentwood, CA 94513"
    )


def test_local_google_search_query_from_tool_state_uses_cached() -> None:
    state = {
        "checkpoint_google_search_query": "cached query near Oakland, CA",
        "checkpoint_service_trade_query": "ignored",
    }
    assert (
        local_google_search_query_from_tool_state(state)
        == "cached query near Oakland, CA"
    )


def test_seed_service_branch_tool_state_sets_google_query() -> None:
    class _State(dict):
        pass

    state = _State()
    tool_context = type("Ctx", (), {"state": state})()
    payload = {
        "checkpoint_service_trade_query": "auto body paint repair shop",
        "property_address": "1982 Helena Way, Brentwood, CA 94513",
    }
    seed_service_branch_tool_state(tool_context, payload)
    assert state["checkpoint_google_search_query"] == (
        "auto body paint repair shop near Brentwood, CA 94513"
    )


def test_provider_matches_property_market_rejects_other_states() -> None:
    addr = "1982 Helena Way, Brentwood, CA 94513"
    assert not provider_matches_property_market(
        {"name": "Charlotte Auto Body", "location": "Charlotte, NC"},
        addr,
    )
    assert provider_matches_property_market(
        {"name": "Brentwood Auto Body", "location": "Brentwood, CA"},
        addr,
    )
    assert provider_matches_property_market(
        {"name": "Local Pro", "location": "Antioch, CA", "distance_miles": 4.2},
        addr,
    )


def test_filter_providers_by_property_market() -> None:
    rows = [
        {"name": "Nationwide Chain", "location": "Nationwide"},
        {"name": "Local Shop", "location": "Brentwood, CA"},
    ]
    out = filter_providers_by_property_market(
        rows, "1982 Helena Way, Brentwood, CA 94513"
    )
    assert [r["name"] for r in out] == ["Local Shop"]


def test_apply_prefetched_serp_replaces_llm_hallucinations() -> None:
    prefetched = [
        {
            "name": "Brentwood Auto Body",
            "location": "Brentwood, CA",
            "distance_miles": 2.1,
            "rating": 4.8,
        }
    ]
    raw = json.dumps(
        {
            "serviceResults": {
                "localPros": {
                    "serpAPIResults": "SerpAPI Maps error: quota",
                    "googleSearchResults": [
                        {"name": "Charlotte Auto Body", "location": "Charlotte, NC"}
                    ],
                },
                "searchStatus": "failed",
                "searchError": "bad",
            }
        }
    )
    out = apply_prefetched_serp_to_branch_result(raw, prefetched)
    parsed = json.loads(out)
    local = parsed["serviceResults"]["localPros"]
    assert local["serpAPIResults"] == prefetched
    assert local["googleSearchResults"] == []
    assert "searchStatus" not in parsed["serviceResults"]
