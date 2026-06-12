"""Unit tests for cost_agent AI path and library fallback (mocked; no Vertex)."""

from __future__ import annotations

import json

import pytest

from property_agent.agents.cost_agent import agent as cost_mod
from property_agent.agents.cost_agent.config import CostEstimationConfig
from property_agent.agents.cost_agent import ai_cost_estimator as ai_cost_mod
from property_agent.agents.cost_agent.ai_cost_estimator import (
    _extract_cost_range_from_text,
    _extract_location_info,
    _extract_repair_details,
    _validate_structured_costs,
    _parse_structured_cost_json,
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


# --- _extract_cost_range_from_text ---


def test_extract_cost_range_inline_hyphen() -> None:
    assert _extract_cost_range_from_text("Cost range: $50-300 for materials", "$0-0") == "$50-300"


def test_extract_cost_range_inline_endash() -> None:
    assert _extract_cost_range_from_text("Estimate: $200–800 labor", "$0-0") == "$200-800"


def test_extract_cost_range_auto_corrects_inverted() -> None:
    # Model returned $300-50 — should be corrected to $50-300
    assert _extract_cost_range_from_text("Range: $300-50", "$0-0") == "$50-300"


def test_extract_cost_range_two_separate_dollar_amounts() -> None:
    # No inline range; picks up $50 and $300 separately
    assert _extract_cost_range_from_text("Spend $50 on materials. Professional: $300.", "$0-0") == "$50-300"


def test_extract_cost_range_uses_fallback_when_empty() -> None:
    assert _extract_cost_range_from_text("", "$50-300") == "$50-300"


def test_extract_cost_range_uses_fallback_single_dollar_amount() -> None:
    assert _extract_cost_range_from_text("About $100 total.", "$50-300") == "$50-300"


# --- _extract_repair_details ---


def test_extract_repair_details_vehicle_paint_transfer_is_automotive() -> None:
    details = _extract_repair_details(
        "Vehicle rear quarter panel and bumper paint transfer and deep scratches"
    )
    assert details["repair_type"] == "Automotive"


def test_extract_repair_details_bumper_is_automotive() -> None:
    details = _extract_repair_details("Rear bumper dent and scratch repair")
    assert details["repair_type"] == "Automotive"


def test_extract_repair_details_drywall_is_drywall() -> None:
    # "crack" contains the substring "ac" which would false-trigger the HVAC
    # branch, so use a diagnosis that doesn't have that substring.
    details = _extract_repair_details("Drywall hole in living room wall needs paint")
    assert details["repair_type"] == "Drywall/Painting"


def test_extract_repair_details_wall_paint_is_drywall_not_automotive() -> None:
    details = _extract_repair_details("Interior wall paint peeling in living room")
    assert details["repair_type"] == "Drywall/Painting"


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
        cost_mod._extract_market_location_from_query(query)
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


def _valid_structured_response() -> dict:
    """Minimal valid structured JSON response from Gemini."""
    return {
        "repair_type": "Plumbing",
        "diy_cost_low": 40,
        "diy_cost_high": 120,
        "diy_includes": ["Cartridge", "Plumber's tape", "Adjustable wrench"],
        "diy_savings": "40-60% vs professional",
        "pro_cost_low": 150,
        "pro_cost_high": 400,
        "pro_includes": ["Labour", "Parts", "Warranty"],
        "comparison_notes": "DIY is feasible for homeowners with basic plumbing knowledge.",
        "recommendation": "DIY if comfortable, otherwise hire a licensed plumber.",
        "next_steps": "Shut off water supply, then replace the cartridge.",
    }


# --- _validate_structured_costs ---


def test_validate_structured_costs_accepts_valid_data() -> None:
    assert _validate_structured_costs(_valid_structured_response()) is None


def test_validate_structured_costs_rejects_inverted_diy() -> None:
    bad = {**_valid_structured_response(), "diy_cost_low": 300, "diy_cost_high": 50}
    err = _validate_structured_costs(bad)
    assert err is not None
    assert "diy" in err


def test_validate_structured_costs_rejects_inverted_pro() -> None:
    bad = {**_valid_structured_response(), "pro_cost_low": 800, "pro_cost_high": 100}
    err = _validate_structured_costs(bad)
    assert err is not None
    assert "pro" in err


def test_validate_structured_costs_rejects_too_low() -> None:
    bad = {**_valid_structured_response(), "diy_cost_low": 1, "diy_cost_high": 3}
    assert _validate_structured_costs(bad) is not None


def test_validate_structured_costs_rejects_non_integer() -> None:
    bad = {**_valid_structured_response(), "diy_cost_low": "not a number"}
    assert _validate_structured_costs(bad) is not None


# --- _parse_structured_cost_json ---


def test_parse_structured_cost_json_builds_cost_estimates() -> None:
    result = _parse_structured_cost_json(_valid_structured_response(), "faucet cartridge")
    assert result["costEstimates"]["DIY"]["cost_range"] == "$40-120"
    assert result["costEstimates"]["Service"]["cost_range"] == "$150-400"
    assert result["costEstimates"]["repair_type"] == "Plumbing"
    assert len(result["costEstimates"]["DIY"]["includes"]) == 3


def test_parse_structured_cost_json_uses_diagnosis_as_fallback_repair_type() -> None:
    data = {**_valid_structured_response()}
    del data["repair_type"]
    result = _parse_structured_cost_json(data, "garage door spring replacement")
    assert "garage door" in result["costEstimates"]["repair_type"]


# --- estimate_costs_with_ai — structured JSON path ---


def test_estimate_costs_with_ai_parses_structured_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Successful structured JSON response → parsed without regex."""

    class _Resp:
        text = json.dumps(_valid_structured_response())

    def _fake_generate(*_args, **_kwargs):
        return _Resp()

    monkeypatch.setattr(ai_cost_mod, "_generate_cost_estimate_content", _fake_generate)
    estimate, confidence = estimate_costs_with_ai(
        diagnosis="Kitchen faucet slow drip at base of spout",
        property_address="Brentwood, CA",
        client=object(),  # unused when generate is mocked
    )
    assert estimate is not None
    assert estimate["costEstimates"]["DIY"]["cost_range"] == "$40-120"
    assert estimate["costEstimates"]["repair_type"] == "Plumbing"
    assert confidence >= 0.8


def test_estimate_costs_with_ai_rejects_invalid_structured_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Structured JSON with invalid costs (low >= high) → returns None."""

    class _Resp:
        text = json.dumps({**_valid_structured_response(), "diy_cost_low": 500, "diy_cost_high": 50})

    monkeypatch.setattr(ai_cost_mod, "_generate_cost_estimate_content", lambda *a, **k: _Resp())
    estimate, confidence = estimate_costs_with_ai(
        diagnosis="Kitchen faucet slow drip at base of spout",
        client=object(),
    )
    assert estimate is None
    assert confidence == 0.0


def test_estimate_costs_with_ai_falls_back_to_prose_on_non_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Non-JSON response triggers prose fallback and still returns an estimate."""

    class _Resp:
        text = "1. **DIY Cost Estimate:**\n   - Cost range: $50-300\n2. **Professional Service Cost Estimate:**\n   - Cost range: $200-800"

    monkeypatch.setattr(ai_cost_mod, "_generate_cost_estimate_content", lambda *a, **k: _Resp())
    estimate, confidence = estimate_costs_with_ai(
        diagnosis="Plumbing pipe leak under sink requires repair",
        client=object(),
    )
    assert estimate is not None
    assert "$" in estimate["costEstimates"]["DIY"]["cost_range"]
    assert confidence > 0


# --- _generate_cost_estimate_content always uses JSON mode ---


def test_generate_cost_estimate_always_uses_json_mode_no_tools() -> None:
    """Grounding tools are never passed; JSON mode is always on."""
    captured: dict = {}

    class _FakeClient:
        class _Models:
            def generate_content(self, **_kwargs):
                captured.update(_kwargs)

                class _Resp:
                    text = json.dumps(_valid_structured_response())

                return _Resp()

        models = _Models()

    ai_cost_mod._generate_cost_estimate_content(_FakeClient(), "prompt")  # type: ignore[arg-type]
    config = captured.get("config")
    assert config is not None
    assert getattr(config, "tools", None) is None
    assert getattr(config, "response_mime_type", None) == "application/json"


def test_generate_cost_estimate_json_mode_with_web_context_no_tools() -> None:
    """Web context path also uses JSON mode (no grounding tools)."""
    captured: dict = {}

    class _FakeClient:
        class _Models:
            def generate_content(self, **_kwargs):
                captured.update(_kwargs)

                class _Resp:
                    text = json.dumps(_valid_structured_response())

                return _Resp()

        models = _Models()

    ai_cost_mod._generate_cost_estimate_content(
        _FakeClient(),  # type: ignore[arg-type]
        "prompt",
        web_context="already fetched web notes",
    )
    config = captured.get("config")
    assert getattr(config, "tools", None) is None
    assert getattr(config, "response_mime_type", None) == "application/json"


def test_extract_grounding_web_summary_from_query() -> None:
    q = json.dumps(
        {
            "diagnosis": "garage door paint",
            "grounding_web_summary": "  shared context  ",
        }
    )
    assert cost_mod._extract_grounding_web_summary_from_query(q) == "shared context"


def test_estimate_costs_with_ai_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    import time

    monkeypatch.setattr(CostEstimationConfig, "AI_ESTIMATION_TIMEOUT", 1)

    def _slow_generate(*_args, **_kwargs):
        time.sleep(2)

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


def test_cost_estimation_sync_returns_json_string(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", False)
    raw = cost_mod._cost_estimation_sync("hvac furnace not heating")
    data = json.loads(raw)
    assert "costEstimates" in data


# --- _fetch_market_pricing_context ---


def test_fetch_market_pricing_context_returns_none_when_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", False)
    monkeypatch.setattr(CostEstimationConfig, "USE_MARKET_PRICING_SEARCH", True)
    result = cost_mod._fetch_market_pricing_context(
        "Kitchen faucet leak at base of faucet", "Austin, TX"
    )
    assert result is None


def test_fetch_market_pricing_context_returns_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "USE_MARKET_PRICING_SEARCH", True)

    class _FakeResponse:
        text = "DIY: $40-80. Professional: $150-350 in Austin TX."

    class _FakeModels:
        def generate_content(self, **_kwargs):
            return _FakeResponse()

    class _FakeClient:
        models = _FakeModels()

    monkeypatch.setattr(
        cost_mod,
        "global_direct_generate_client_and_model",
        lambda: (_FakeClient(), "gemini-3.5-flash"),
    )
    result = cost_mod._fetch_market_pricing_context(
        "Kitchen faucet leak at base of faucet", "Austin, TX"
    )
    assert result == "DIY: $40-80. Professional: $150-350 in Austin TX."


def test_fetch_market_pricing_context_reads_text_from_parts_when_response_text_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "USE_MARKET_PRICING_SEARCH", True)

    class _Part:
        text = "DIY: $40-80. Professional: $150-350."

    class _Content:
        parts = [_Part()]

    class _Candidate:
        content = _Content()

    class _FakeResponse:
        text = None
        candidates = [_Candidate()]

    class _FakeModels:
        def generate_content(self, **_kwargs):
            return _FakeResponse()

    class _FakeClient:
        models = _FakeModels()

    monkeypatch.setattr(
        cost_mod,
        "global_direct_generate_client_and_model",
        lambda: (_FakeClient(), "gemini-3.5-flash"),
    )
    result = cost_mod._fetch_market_pricing_context(
        "Kitchen faucet leak at base of faucet", "Austin, TX"
    )
    assert result == "DIY: $40-80. Professional: $150-350."


def test_fetch_market_pricing_context_retries_when_first_response_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "USE_MARKET_PRICING_SEARCH", True)

    class _Empty:
        text = None
        candidates = []

    class _Ok:
        text = "DIY: $40-80. Professional: $150-350."

    calls: list[int] = []

    class _FakeModels:
        def generate_content(self, **_kwargs):
            calls.append(1)
            return _Empty() if len(calls) == 1 else _Ok()

    class _FakeClient:
        models = _FakeModels()

    monkeypatch.setattr(
        cost_mod,
        "global_direct_generate_client_and_model",
        lambda: (_FakeClient(), "gemini-3.5-flash"),
    )
    result = cost_mod._fetch_market_pricing_context(
        "Kitchen faucet leak at base of faucet", "Austin, TX"
    )
    assert result == "DIY: $40-80. Professional: $150-350."
    assert len(calls) == 2


def test_fetch_market_pricing_context_returns_none_on_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "USE_MARKET_PRICING_SEARCH", True)

    class _BrokenModels:
        def generate_content(self, **_kwargs):
            raise RuntimeError("network error")

    class _BrokenClient:
        models = _BrokenModels()

    monkeypatch.setattr(
        cost_mod,
        "global_direct_generate_client_and_model",
        lambda: (_BrokenClient(), "gemini-3.5-flash"),
    )
    result = cost_mod._fetch_market_pricing_context(
        "Kitchen faucet leak at base of faucet", None
    )
    assert result is None


# --- _estimate_with_ai cascade (market search) ---


def test_estimate_with_ai_fetches_web_context_when_no_provider_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With no provider data and no pre-fetched context, web search should fire."""
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "USE_MARKET_PRICING_SEARCH", True)
    monkeypatch.setattr(CostEstimationConfig, "MIN_AI_CONFIDENCE_THRESHOLD", 0.6)

    fetched: list[str] = []

    def _fake_fetch(diagnosis, location):
        fetched.append(diagnosis)
        return "Pro: $150-350, DIY: $40-80"

    captured: list[dict] = []

    def _fake_ai(**kwargs):
        captured.append(kwargs)
        return _valid_ai_estimate(), 0.85

    monkeypatch.setattr(cost_mod, "_fetch_market_pricing_context", _fake_fetch)
    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _fake_ai)

    cost_mod._estimate_with_ai(
        diagnosis="Kitchen faucet leak requiring cartridge replacement",
        property_address="Austin, TX",
        service_results=None,
    )

    assert len(fetched) == 1, "web search should fire once"
    assert captured[0]["web_context"] == "Pro: $150-350, DIY: $40-80"


def test_estimate_with_ai_skips_search_when_web_context_provided(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pre-fetched web_context should bypass the live search."""
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "USE_MARKET_PRICING_SEARCH", True)
    monkeypatch.setattr(CostEstimationConfig, "MIN_AI_CONFIDENCE_THRESHOLD", 0.6)

    fetched: list[str] = []

    def _fake_fetch(diagnosis, location):
        fetched.append(diagnosis)
        return "should not be called"

    def _fake_ai(**kwargs):
        return _valid_ai_estimate(), 0.85

    monkeypatch.setattr(cost_mod, "_fetch_market_pricing_context", _fake_fetch)
    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _fake_ai)

    cost_mod._estimate_with_ai(
        diagnosis="Kitchen faucet leak requiring cartridge replacement",
        web_context="already have context",
    )

    assert fetched == [], "web search must be skipped when web_context is already set"


def test_estimate_with_ai_skips_search_when_provider_data_is_good(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """High-confidence provider data should bypass the live search."""
    monkeypatch.setattr(CostEstimationConfig, "USE_AI_COST_ESTIMATION", True)
    monkeypatch.setattr(CostEstimationConfig, "USE_MARKET_PRICING_SEARCH", True)
    monkeypatch.setattr(CostEstimationConfig, "MIN_AI_CONFIDENCE_THRESHOLD", 0.6)
    monkeypatch.setattr(CostEstimationConfig, "MIN_PROVIDER_DATA_CONFIDENCE", 0.5)
    monkeypatch.setattr(CostEstimationConfig, "USE_SERVICE_PROVIDER_CALIBRATION", True)

    fetched: list[str] = []

    def _fake_fetch(diagnosis, location):
        fetched.append(diagnosis)
        return "should not be called"

    def _fake_extract(service_results):
        return {"confidence": 0.9, "service_low": 150, "service_high": 400}

    def _fake_ai(**kwargs):
        return _valid_ai_estimate(), 0.85

    monkeypatch.setattr(cost_mod, "_fetch_market_pricing_context", _fake_fetch)
    monkeypatch.setattr(cost_mod, "extract_and_combine_all_pricing", _fake_extract)
    monkeypatch.setattr(cost_mod, "estimate_costs_with_ai", _fake_ai)

    cost_mod._estimate_with_ai(
        diagnosis="Kitchen faucet leak requiring cartridge replacement",
        service_results={"localPros": {}},
    )

    assert fetched == [], "web search must be skipped when provider data is adequate"
