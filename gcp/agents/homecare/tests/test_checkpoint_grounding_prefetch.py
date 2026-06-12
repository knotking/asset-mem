"""Tests for checkpoint shared web grounding prefetch."""

from __future__ import annotations

import json

import pytest

from property_agent.checkpoint import grounding_prefetch as gp


def test_should_prefetch_diy_when_diy_requested() -> None:
    assert gp.should_prefetch_diy_grounding(["diy", "cost"]) is True
    assert gp.should_prefetch_diy_grounding(["diy"]) is True
    assert gp.should_prefetch_diy_grounding(["cost", "service"]) is False


def test_should_prefetch_cost_pricing_when_cost_requested() -> None:
    assert gp.should_prefetch_cost_pricing_grounding(["diy", "cost"]) is True
    assert gp.should_prefetch_cost_pricing_grounding(["cost"]) is True
    assert gp.should_prefetch_cost_pricing_grounding(["diy", "service"]) is False


def test_should_prefetch_disabled_by_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CHECKPOINT_GROUNDING_PREFETCH", "0")
    assert gp.should_prefetch_diy_grounding(["diy", "cost"]) is False
    assert gp.should_prefetch_cost_pricing_grounding(["diy", "cost"]) is False


def test_prefetch_diy_calls_fetch_once(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str]] = []

    def _fake_fetch(web_query: str, market: str) -> str:
        calls.append((web_query, market))
        return "diy web summary"

    monkeypatch.setattr(
        "property_agent.checkpoint.grounding_prefetch.fetch_repair_web_context",
        _fake_fetch,
    )
    payload = {
        "user_query": "analyse checkpoints",
        "checkpoint_results": "Issues: paint chip on garage door",
        "checkpoint_retrieval_search_query": "garage door paint repair",
        "property_address": "1 Main St, Brentwood, CA 94513",
    }
    out = gp.prefetch_checkpoint_web_context(payload)
    assert out == "diy web summary"
    assert len(calls) == 1
    assert "garage door" in calls[0][0].lower()
    assert "Brentwood" in calls[0][1]


def test_prefetch_pricing_uses_cost_diagnosis(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str | None]] = []

    def _fake_pricing(diagnosis: str, location: str | None) -> str:
        calls.append((diagnosis, location))
        return "pricing web summary"

    monkeypatch.setattr(
        "property_agent.agents.cost_agent.agent.fetch_market_pricing_context",
        _fake_pricing,
    )
    payload = {
        "user_query": "analyse checkpoints",
        "checkpoint_results": "Issues: paint chip on garage door",
        "checkpoint_retrieval_search_query": "garage door paint repair",
        "property_address": "1 Main St, Brentwood, CA 94513",
    }
    out = gp.prefetch_checkpoint_pricing_context(payload)
    assert out == "pricing web summary"
    assert calls == [("garage door paint repair", "1 Main St, Brentwood, CA 94513")]


def test_cost_query_uses_pricing_summary_not_diy_summary() -> None:
    from property_agent.checkpoint.analysis import parallel_runner as pr

    payload = {
        "user_query": "q",
        "checkpoint_results": "Issues: leak",
        "checkpoint_retrieval_search_query": "pipe leak repair",
        "property_address": "1 Main St, City, ST",
        "checkpoint_grounding_web_summary": "DIY steps research text",
        "checkpoint_pricing_grounding_web_summary": "Pricing dollar ranges text",
    }
    data = json.loads(pr._build_checkpoint_cost_query(payload))
    assert data["grounding_web_summary"] == "Pricing dollar ranges text"
    assert "DIY steps" not in data["grounding_web_summary"]
