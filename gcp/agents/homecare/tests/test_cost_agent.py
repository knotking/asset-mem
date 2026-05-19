"""Unit tests for cost_agent AI path and library fallback (mocked; no Vertex)."""

from __future__ import annotations

import json

import pytest

from property_agent.sub_agents.cost_agent import agent as cost_mod
from property_agent.sub_agents.cost_agent.config import CostEstimationConfig
from property_agent.sub_agents.cost_agent import ai_cost_estimator as ai_cost_mod
from property_agent.sub_agents.cost_agent.ai_cost_estimator import (
    _extract_location_info,
    estimate_costs_with_ai,
    validate_cost_ranges,
)


def _valid_ai_estimate() -> dict:
    return {
        "costEstimates": {
            "repair_type": "Kitchen faucet leak repair",
            "DIY": {
                "cost_range": "$40-120",
                "includes": ["Parts"],
                "savings": "Labor",
                "complexity": "Moderate",
            },
            "Service": {
                "cost_range": "$150-400",
                "includes": ["Labor"],
                "benefits": "Warranty",
                "complexity": "Standard",
            },
            "comparison": {
                "diy_savings": "40-60%",
                "professional_benefits": "Guarantee",
                "considerations": "Shut off water first",
            },
        }
    }


# --- ai_cost_estimator helpers ---


def test_validate_cost_ranges_accepts_well_formed_estimate() -> None:
    assert validate_cost_ranges(_valid_ai_estimate()) is True


def test_validate_cost_ranges_rejects_missing_dollar_ranges() -> None:
    bad = _valid_ai_estimate()
    bad["costEstimates"]["DIY"]["cost_range"] = "forty dollars"
    assert validate_cost_ranges(bad) is False


def test_validate_cost_ranges_rejects_inverted_range() -> None:
    bad = _valid_ai_estimate()
    bad["costEstimates"]["Service"]["cost_range"] = "$500-100"
    assert validate_cost_ranges(bad) is False


def test_extract_location_info_parses_city_state() -> None:
    city, state, loc = _extract_location_info("1982 Helena Way, Brentwood, CA 94513")
    assert city == "Brentwood"
    assert state == "CA"
    assert "Brentwood" in (loc or "")


def test_extract_location_info_parses_coordinate_pair() -> None:
    city, state, loc = _extract_location_info("37.9000,-121.7000")
    assert city is None
    assert state is None
    assert loc == "37.9000,-121.7000"


# --- query parsing ---


def test_extract_diagnosis_from_json_payload() -> None:
    query = json.dumps(
        {
            "diagnosis": "Slow drip under kitchen faucet cartridge",
            "property_address": "1 Main St",
        }
    )
    assert (
        cost_mod._extract_diagnosis_from_query(query)
        == "Slow drip under kitchen faucet cartridge"
    )


def test_extract_property_address_from_json_payload() -> None:
    query = json.dumps({"property_address": "1982 Helena Way, Brentwood, CA 94513"})
    assert (
        cost_mod._extract_property_address_from_query(query)
        == "1982 Helena Way, Brentwood, CA 94513"
    )


def test_extract_market_location_prefers_explicit_market_location() -> None:
    query = json.dumps(
        {
            "diagnosis": "garage door paint repair",
            "market_location": "1982 Helena Way, Brentwood, CA 94513",
            "search_location": {
                "source": "device_gps",
                "radius_miles": 5,
                "coordinates": {"lat": 37.9, "lng": -121.7},
            },
        }
    )
    assert (
        cost_mod._extract_market_location_from_query(query)
        == "1982 Helena Way, Brentwood, CA 94513"
    )


def test_extract_market_location_uses_property_address_over_coords() -> None:
    query = json.dumps(
        {
            "diagnosis": "garage door paint repair",
            "property_address": "1982 Helena Way, Brentwood, CA 94513",
            "search_location": {
                "source": "device_gps",
                "radius_miles": 5,
                "coordinates": {"lat": 37.9, "lng": -121.7},
            },
        }
    )
    assert (
        cost_mod._extract_market_location_from_query(query)
        == "1982 Helena Way, Brentwood, CA 94513"
    )


def test_estimate_costs_with_ai_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    import time

    monkeypatch.setattr(CostEstimationConfig, "AI_ESTIMATION_TIMEOUT", 1)

    def _slow_generate(*_args, **_kwargs):
        time.sleep(2)
        return None

    monkeypatch.setattr(ai_cost_mod, "_generate_cost_estimate_content", _slow_generate)
    estimate, confidence = estimate_costs_with_ai(
        diagnosis="Kitchen faucet leak requiring cartridge replacement",
        property_address="Brentwood, CA",
        client=object(),  # unused when generate is mocked
    )
    assert estimate is None
    assert confidence == 0.0


# --- _estimate_with_ai ---


def test_estimate_with_ai_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", False)

    def _should_not_call(**_kwargs):
        raise AssertionError("estimate_costs_with_ai must not run when AI is disabled")

    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _should_not_call)
    estimate, confidence, source = cost_mod._estimate_with_ai(
        diagnosis="Kitchen faucet leak at base of spout",
    )
    assert estimate is None
    assert confidence == 0.0
    assert source == "disabled"


def test_estimate_with_ai_rejects_short_diagnosis() -> None:
    estimate, confidence, source = cost_mod._estimate_with_ai(diagnosis="leak")
    assert estimate is None
    assert source == "invalid_input"


def test_estimate_with_ai_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "MIN_AI_CONFIDENCE_THRESHOLD", 0.6)

    def _fake_ai(**_kwargs):
        return _valid_ai_estimate(), 0.85

    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _fake_ai)
    estimate, confidence, source = cost_mod._estimate_with_ai(
        diagnosis="Kitchen faucet leak requiring cartridge replacement",
        property_address="Brentwood, CA",
    )
    assert estimate is not None
    assert confidence >= 0.6
    assert source in ("ai", "ai_calibrated")


def test_estimate_with_ai_validation_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)

    def _bad_ai(**_kwargs):
        bad = _valid_ai_estimate()
        bad["costEstimates"]["DIY"]["cost_range"] = "not-a-range"
        return bad, 0.9

    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _bad_ai)
    estimate, _confidence, source = cost_mod._estimate_with_ai(
        diagnosis="Kitchen faucet leak requiring cartridge replacement",
    )
    assert estimate is None
    assert source == "validation_failed"


def test_estimate_with_ai_low_confidence(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "MIN_AI_CONFIDENCE_THRESHOLD", 0.8)

    def _low_conf(**_kwargs):
        return _valid_ai_estimate(), 0.5

    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _low_conf)
    estimate, _confidence, source = cost_mod._estimate_with_ai(
        diagnosis="Kitchen faucet leak requiring cartridge replacement",
    )
    assert estimate is None
    assert source == "low_confidence"


def test_estimate_with_ai_handles_exception(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)

    def _boom(**_kwargs):
        raise RuntimeError("genai unavailable")

    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _boom)
    estimate, confidence, source = cost_mod._estimate_with_ai(
        diagnosis="Kitchen faucet leak requiring cartridge replacement",
    )
    assert estimate is None
    assert confidence == 0.0
    assert source == "error"


# --- _compute_full_cost_estimate ---


def test_compute_full_cost_estimate_uses_ai_when_confident(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "MIN_AI_CONFIDENCE_THRESHOLD", 0.6)

    def _fake_ai(**_kwargs):
        return _valid_ai_estimate(), 0.9

    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _fake_ai)
    result = cost_mod._compute_full_cost_estimate(
        json.dumps(
            {
                "diagnosis": "Kitchen faucet leak at base",
                "property_address": "Brentwood, CA",
            }
        )
    )
    assert result["costEstimates"]["repair_type"] == "Kitchen faucet leak repair"
    assert result["costEstimates"]["DIY"]["cost_range"] == "$40-120"


def test_compute_full_cost_estimate_falls_back_to_library(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", False)
    result = cost_mod._compute_full_cost_estimate("kitchen faucet leak repair")
    assert "costEstimates" in result
    assert "DIY" in result["costEstimates"]
    assert "Service" in result["costEstimates"]
    assert "$" in result["costEstimates"]["DIY"]["cost_range"]


def test_compute_full_cost_estimate_falls_back_when_ai_returns_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)

    def _no_result(**_kwargs):
        return None, 0.0

    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _no_result)
    result = cost_mod._compute_full_cost_estimate("plumbing pipe leak under sink")
    assert "costEstimates" in result
    repair = (result["costEstimates"].get("repair_type") or "").lower()
    assert "plumb" in repair or "leak" in repair or "pipe" in repair


def test_cost_estimation_sync_returns_json_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", False)
    raw = cost_mod._cost_estimation_sync("hvac furnace not heating")
    data = json.loads(raw)
    assert "costEstimates" in data
