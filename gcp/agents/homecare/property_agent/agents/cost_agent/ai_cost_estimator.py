"""
AI-powered cost estimation using Gemini with structured JSON output.

This module provides dynamic, location-aware cost estimation. Gemini is asked
to return a structured JSON object with integer cost fields so no regex parsing
of prose is needed and validation is trivial numeric comparison.
"""

import datetime
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any, Dict, Optional, Tuple
from google import genai
from google.genai import types

from agent_framework.execution.thread_context import executor_submit
from ...model_config import LEGACY_API_GEMINI
from .config import CostEstimationConfig

logger = logging.getLogger(__name__)


_COORD_PAIR_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$")

# Kept for backward-compat and the regex-prose fallback path only.
_INLINE_RANGE_RE = re.compile(r"\$(\d+)\s*[-–—]\s*(\d+)")
_DOLLAR_AMOUNT_RE = re.compile(r"\$(\d+)")


def _extract_location_info(
    property_address: Optional[str],
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extract city, state, and full location string from property address.

    Returns:
        Tuple of (city, state, location_string)
    """
    if not property_address:
        return None, None, None

    coord_match = _COORD_PAIR_RE.match(property_address.strip())
    if coord_match:
        lat = float(coord_match.group(1))
        lng = float(coord_match.group(2))
        location_string = f"{lat:.4f},{lng:.4f}"
        return None, None, location_string

    parts = [p.strip() for p in property_address.split(",")]
    city = None
    state = None

    if len(parts) >= 3:
        city = parts[-2].strip()
        state_part = parts[-1].strip()
        state_match = re.match(r"^([A-Z]{2})", state_part)
        if state_match:
            state = state_match.group(1)
    elif len(parts) == 2:
        city = parts[-1].strip()

    location_string = (
        f"{city}, {state}" if city and state else city if city else property_address
    )

    return city, state, location_string


def _extract_repair_details(diagnosis: str) -> Dict[str, Any]:
    """
    Keyword-based repair categorisation — kept for backward-compat and
    logging only.  The main estimation path no longer uses this for prompt
    injection; Gemini classifies the repair type itself from the full
    diagnosis text.
    """
    diagnosis_lower = diagnosis.lower()

    repair_type = "General repair"
    if any(word in diagnosis_lower for word in ["plumb", "leak", "pipe", "drain", "faucet", "toilet"]):
        repair_type = "Plumbing"
    elif any(word in diagnosis_lower for word in ["electric", "outlet", "switch", "wiring", "circuit"]):
        repair_type = "Electrical"
    elif any(word in diagnosis_lower for word in ["hvac", "ac", "air condition", "furnace", "heat"]):
        repair_type = "HVAC"
    elif any(word in diagnosis_lower for word in ["roof", "shingle", "gutter"]):
        repair_type = "Roofing"
    elif any(
        word in diagnosis_lower
        for word in ["car", "vehicle", "automotive", "dent", "scratch",
                     "bumper", "quarter panel", "fender", "hood", "paint transfer"]
    ):
        # Automotive checked before drywall/painting to prevent "paint transfer"
        # matching the "paint" keyword in the drywall branch.
        repair_type = "Automotive"
    elif any(word in diagnosis_lower for word in ["drywall", "wall", "ceiling", "paint"]):
        repair_type = "Drywall/Painting"
    elif any(word in diagnosis_lower for word in ["appliance", "washer", "dryer", "refrigerator", "dishwasher"]):
        repair_type = "Appliance"
    elif any(word in diagnosis_lower for word in ["pest", "termite", "rodent", "insect", "bug"]):
        repair_type = "Pest Control"

    severity = "moderate"
    if any(word in diagnosis_lower for word in ["emergency", "urgent", "severe", "major", "extensive"]):
        severity = "high"
    elif any(word in diagnosis_lower for word in ["minor", "small", "simple", "easy"]):
        severity = "low"

    complexity_factors = []
    if any(word in diagnosis_lower for word in ["difficult access", "hard to reach", "confined space"]):
        complexity_factors.append("difficult access")
    if any(word in diagnosis_lower for word in ["permit", "code", "inspection"]):
        complexity_factors.append("permits required")
    if any(word in diagnosis_lower for word in ["safety", "hazard", "dangerous"]):
        complexity_factors.append("safety concerns")
    if any(word in diagnosis_lower for word in ["structural", "foundation", "load-bearing"]):
        complexity_factors.append("structural work")

    return {
        "repair_type": repair_type,
        "severity": severity,
        "complexity_factors": complexity_factors,
        "original_diagnosis": diagnosis,
    }


def _build_cost_estimation_prompt(
    diagnosis: str,
    location: Optional[str],
    *,
    web_context: Optional[str] = None,
) -> str:
    """
    Build a prompt that requests a structured JSON cost estimate.

    The prompt no longer injects heuristic repair_type / severity labels.
    Gemini classifies the repair from the full diagnosis text, which is more
    accurate than substring keyword matching.
    """
    location_context = f" in {location}" if location else ""
    web_block = ""
    if web_context and web_context.strip():
        web_block = (
            "\n**Web research (pre-fetched; do not request another search):**\n"
            f"{web_context.strip()[:6000]}\n"
        )

    current_year = datetime.date.today().year
    return f"""You are a repair and home-care cost estimation expert. Provide accurate, current ({current_year}) cost estimates for the repair described below{location_context}.

**Repair Diagnosis:** {diagnosis}{web_block}

Respond with ONLY a valid JSON object — no prose, no markdown fences. Use these exact fields:

{{
  "repair_type": "<short category, e.g. Automotive / Plumbing / Drywall>",
  "diy_cost_low": <integer USD — materials-only lower bound>,
  "diy_cost_high": <integer USD — materials-only upper bound>,
  "diy_includes": ["<item>", "<item>", "<item>"],
  "diy_savings": "<% savings vs professional, one phrase>",
  "pro_cost_low": <integer USD — labor+materials{location_context} lower bound>,
  "pro_cost_high": <integer USD — labor+materials{location_context} upper bound>,
  "pro_includes": ["<item>", "<item>", "<item>"],
  "comparison_notes": "<one sentence comparing DIY vs professional>",
  "recommendation": "<one sentence: when to choose DIY vs professional>",
  "next_steps": "<one sentence of practical next steps for the homeowner>"
}}

Rules:
- Use realistic {current_year} pricing{location_context if location else ""}.
- diy_cost_low MUST be strictly less than diy_cost_high.
- pro_cost_low MUST be strictly less than pro_cost_high.
- All cost values are plain integers (no $ signs, no commas).
- Provide 3–5 items in diy_includes and pro_includes."""


def _validate_structured_costs(data: Dict[str, Any]) -> Optional[str]:
    """
    Validate the integer cost fields from a structured Gemini response.

    Returns:
        None if valid, or an error description string.
    """
    try:
        diy_low = int(data.get("diy_cost_low", 0))
        diy_high = int(data.get("diy_cost_high", 0))
        pro_low = int(data.get("pro_cost_low", 0))
        pro_high = int(data.get("pro_cost_high", 0))
    except (TypeError, ValueError) as exc:
        return f"cost fields are not integers: {exc}"

    if diy_low >= diy_high:
        return f"diy_cost_low ({diy_low}) >= diy_cost_high ({diy_high})"
    if pro_low >= pro_high:
        return f"pro_cost_low ({pro_low}) >= pro_cost_high ({pro_high})"
    if diy_low < 5 or pro_low < 5:
        return f"cost unrealistically low (diy_low={diy_low}, pro_low={pro_low})"
    if diy_high > 50_000 or pro_high > 50_000:
        return f"cost unrealistically high (diy_high={diy_high}, pro_high={pro_high})"
    return None


def _parse_structured_cost_json(data: Dict[str, Any], diagnosis: str) -> Dict[str, Any]:
    """
    Convert a validated structured JSON dict from Gemini into the
    costEstimates format consumed by the rest of the cost pipeline.
    """
    diy_low = int(data["diy_cost_low"])
    diy_high = int(data["diy_cost_high"])
    pro_low = int(data["pro_cost_low"])
    pro_high = int(data["pro_cost_high"])

    diy_includes = (data.get("diy_includes") or [])[:5]
    pro_includes = (data.get("pro_includes") or [])[:5]
    if not diy_includes:
        diy_includes = ["Materials and supplies", "Basic tools", "2-6 hours of work"]
    if not pro_includes:
        pro_includes = ["Professional labor", "Materials", "Warranty coverage"]

    repair_type = str(data.get("repair_type") or diagnosis[:80])

    return {
        "costEstimates": {
            "repair_type": repair_type,
            "DIY": {
                "cost_range": f"${diy_low}-{diy_high}",
                "includes": diy_includes,
                "savings": str(data.get("diy_savings") or "Typically 40-70% vs. professional service")[:200],
                "complexity": "Assess your skill level and safety risks before proceeding",
            },
            "Service": {
                "cost_range": f"${pro_low}-{pro_high}",
                "includes": pro_includes,
                "benefits": "Licensed expertise, warranty coverage, code compliance",
                "complexity": "Professional service recommended for safety and quality assurance",
            },
            "comparison": {
                "diy_savings": str(data.get("comparison_notes") or "Savings primarily from avoided labor costs")[:200],
                "professional_benefits": "Peace of mind, accountability, faster completion, warranty protection",
                "considerations": "Factor in tool costs, time investment, skill requirements, and safety concerns",
            },
            "recommendation": {
                "notes": str(data.get("recommendation") or "Consider your skill level, available time, and safety requirements.")[:300],
                "next_steps": str(data.get("next_steps") or "Obtain multiple local quotes for professional service.")[:300],
            },
        }
    }


def _extract_cost_range_from_text(text: str, fallback: str) -> str:
    """
    Extract the first plausible cost range from a prose text block.

    Used only by the legacy regex-prose fallback path in
    _parse_ai_response_to_json.  The structured JSON path never calls this.
    """
    for m in _INLINE_RANGE_RE.finditer(text):
        a, b = int(m.group(1)), int(m.group(2))
        if a > 0 and b > 0 and a != b:
            return f"${min(a, b)}-{max(a, b)}"

    amounts = sorted(
        {int(m.group(1)) for m in _DOLLAR_AMOUNT_RE.finditer(text) if 5 <= int(m.group(1)) <= 50000}
    )
    if len(amounts) >= 2:
        return f"${amounts[0]}-{amounts[-1]}"

    return fallback


def _parse_ai_response_to_json(
    ai_response: str, diagnosis: str, repair_details: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Legacy prose-to-dict parser — only used when the structured JSON path
    fails (e.g. model returned text despite JSON mode being requested).
    """
    diy_section = ""
    pro_section = ""
    comparison_section = ""
    recommendations_section = ""

    sections = re.split(r"\n\s*\d+\.\s*\*\*", ai_response)
    for section in sections:
        if "DIY" in section[:50]:
            diy_section = section
        elif "Professional" in section[:50]:
            pro_section = section
        elif "Comparison" in section[:50] or "Cost Comparison" in section[:50]:
            comparison_section = section
        elif "Recommendation" in section[:50]:
            recommendations_section = section

    diy_cost_range = _extract_cost_range_from_text(diy_section or ai_response[:500], "$50-300")
    pro_cost_range = _extract_cost_range_from_text(pro_section or ai_response, "$200-800")

    diy_includes: list = []
    diy_includes_match = re.search(
        r"What.*?included[:\s]+(.*?)(?:\n\s*[-•]|\n\n|Time estimate)",
        diy_section, re.IGNORECASE | re.DOTALL,
    )
    if diy_includes_match:
        diy_includes = [
            item.strip("- •\n\r")
            for item in re.findall(r"[-•]\s*([^\n]+)", diy_includes_match.group(1))
        ]
    if not diy_includes:
        diy_includes = ["Materials and supplies", "Basic tools", "2-6 hours of work"]

    service_includes: list = []
    service_includes_match = re.search(
        r"What.*?included[:\s]+(.*?)(?:\n\s*[-•]|\n\n|Typical duration)",
        pro_section, re.IGNORECASE | re.DOTALL,
    )
    if service_includes_match:
        service_includes = [
            item.strip("- •\n\r")
            for item in re.findall(r"[-•]\s*([^\n]+)", service_includes_match.group(1))
        ]
    if not service_includes:
        service_includes = ["Professional labor", "Materials", "Warranty coverage"]

    savings_match = re.search(r"savings[:\s]+([^.\n]+)", comparison_section, re.IGNORECASE)
    savings = savings_match.group(1).strip() if savings_match else "Typically 40-70% vs. professional service"

    complexity_diy = "Assess your skill level and safety risks before proceeding"
    if repair_details.get("complexity_factors"):
        complexity_diy = f"Moderate to high complexity due to: {', '.join(repair_details['complexity_factors'])}"
    elif repair_details.get("severity") == "low":
        complexity_diy = "Low to moderate complexity for DIY with basic skills"

    complexity_pro = "Professional service recommended for safety and quality assurance"
    if repair_details.get("complexity_factors"):
        complexity_pro = f"Professional expertise required due to: {', '.join(repair_details['complexity_factors'])}"

    notes_match = re.search(
        r"When DIY is appropriate[:\s]+(.*?)(?:\n\s*[-•]|When professional)",
        recommendations_section, re.IGNORECASE | re.DOTALL,
    )
    notes = (
        notes_match.group(1).strip() if notes_match
        else "Consider your skill level, available time, and safety requirements when deciding."
    )

    return {
        "costEstimates": {
            "repair_type": diagnosis[:100],
            "DIY": {
                "cost_range": diy_cost_range,
                "includes": diy_includes[:5],
                "savings": savings[:200],
                "complexity": complexity_diy[:200],
            },
            "Service": {
                "cost_range": pro_cost_range,
                "includes": service_includes[:5],
                "benefits": "Licensed expertise, warranty coverage, code compliance",
                "complexity": complexity_pro[:200],
            },
            "comparison": {
                "diy_savings": "Savings primarily from avoided labor costs",
                "professional_benefits": "Peace of mind, accountability, faster completion, warranty protection",
                "considerations": "Factor in tool costs, time investment, skill requirements, and safety concerns",
            },
            "recommendation": {
                "notes": notes[:300],
                "next_steps": "Obtain multiple local quotes for professional service.",
            },
        }
    }


def _generate_cost_estimate_content(
    client: genai.Client,
    prompt: str,
    *,
    web_context: Optional[str] = None,
):
    """
    Sync Vertex generate_content call (run in a thread for timeout).

    JSON mode (response_mime_type="application/json") is always used so the
    response can be parsed with json.loads rather than regex.  Google Search
    grounding is intentionally not used here: it is incompatible with JSON
    mode, and the model's built-in knowledge is sufficient for cost estimation.
    If live market data is needed, pass it pre-fetched via `web_context`.
    """
    ai_cfg = CostEstimationConfig.get_ai_config()
    return client.models.generate_content(
        model=ai_cfg["model"],
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=ai_cfg["temperature"],
            top_p=0.8,
            top_k=40,
            max_output_tokens=ai_cfg["max_output_tokens"],
            response_mime_type="application/json",
        ),
    )


def estimate_costs_with_ai(
    diagnosis: str,
    property_address: Optional[str] = None,
    service_provider_data: Optional[Dict[str, Any]] = None,
    client: Optional[genai.Client] = None,
    *,
    web_context: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], float]:
    """
    Estimate repair costs using AI with structured JSON output.

    Returns:
        Tuple of (cost_estimate_dict, confidence_score).
        Returns (None, 0.0) if estimation fails.
    """
    try:
        city, state, location_string = _extract_location_info(property_address)

        logger.info(
            "AI cost estimation for: %s in %s",
            diagnosis[:80],
            location_string or "unspecified location",
        )

        prompt = _build_cost_estimation_prompt(
            diagnosis,
            location_string,
            web_context=web_context,
        )

        if client is None:
            client = LEGACY_API_GEMINI.api_client

        timeout_s = CostEstimationConfig.AI_ESTIMATION_TIMEOUT
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = executor_submit(
                pool,
                _generate_cost_estimate_content,
                client,
                prompt,
                web_context=web_context,
            )
            try:
                response = future.result(timeout=timeout_s)
            except FuturesTimeoutError:
                logger.warning("AI cost estimation timed out after %ss", timeout_s)
                return None, 0.0

        if not response or not response.text:
            logger.warning("AI cost estimation returned empty response")
            return None, 0.0

        response_text = response.text.strip()
        logger.debug("AI raw response: %s…", response_text[:300])

        # --- Primary path: parse structured JSON ---
        try:
            data = json.loads(response_text)
        except json.JSONDecodeError as exc:
            logger.warning("AI response is not valid JSON (%s) — falling back to prose parser", exc)
            # Fall back to legacy regex parser so a non-JSON response doesn't
            # hard-fail; _extract_repair_details provides legacy context.
            repair_details = _extract_repair_details(diagnosis)
            cost_estimate = _parse_ai_response_to_json(response_text, diagnosis, repair_details)
            confidence = 0.7 + (0.1 if location_string else 0.0) + (0.1 if service_provider_data else 0.0)
            logger.info("AI cost estimation completed via prose fallback, confidence: %.2f", confidence)
            return cost_estimate, min(confidence, 1.0)

        # Validate numeric fields before building the output dict
        validation_error = _validate_structured_costs(data)
        if validation_error:
            logger.warning("AI structured cost response invalid: %s", validation_error)
            return None, 0.0

        cost_estimate = _parse_structured_cost_json(data, diagnosis)

        # Confidence: base + bonuses for location and provider data
        confidence = 0.8  # Higher base — structured output is more reliable
        if location_string:
            confidence += 0.1
        if service_provider_data:
            confidence += 0.1
        confidence = min(confidence, 1.0)

        logger.info(
            "AI cost estimation completed (structured JSON) repair_type=%r confidence=%.2f",
            data.get("repair_type", "?"),
            confidence,
        )
        return cost_estimate, confidence

    except Exception as exc:
        logger.error("AI cost estimation failed: %s", exc, exc_info=True)
        return None, 0.0


def validate_cost_ranges(cost_estimate: Dict[str, Any]) -> bool:
    """
    Validate that the costEstimates dict has sensible $LOW-HIGH string ranges.

    Used as a final safety net after estimate_costs_with_ai returns.
    """
    try:
        cost_estimates = cost_estimate.get("costEstimates", {})
        diy_range = cost_estimates.get("DIY", {}).get("cost_range", "")
        service_range = cost_estimates.get("Service", {}).get("cost_range", "")

        if not re.match(r"\$\d+[-–]\d+", diy_range) or not re.match(
            r"\$\d+[-–]\d+", service_range
        ):
            logger.warning("Cost ranges not in expected format (diy=%r, service=%r)", diy_range, service_range)
            return False

        diy_match = re.search(r"\$(\d+)[-–](\d+)", diy_range)
        service_match = re.search(r"\$(\d+)[-–](\d+)", service_range)
        if not diy_match or not service_match:
            return False

        diy_low, diy_high = int(diy_match.group(1)), int(diy_match.group(2))
        service_low, service_high = int(service_match.group(1)), int(service_match.group(2))

        if diy_low >= diy_high or service_low >= service_high:
            logger.warning(
                "Invalid cost range: low >= high (diy=%s, service=%s)",
                diy_range,
                service_range,
            )
            return False

        if diy_high > service_high:
            logger.warning("DIY cost higher than professional - unusual but not invalid")

        if diy_high > 50_000 or service_high > 50_000:
            logger.warning("Cost estimate exceeds $50,000 - may be unrealistic")
            return False

        if diy_low < 5 or service_low < 5:
            logger.warning("Cost estimate below $5 - may be unrealistic")
            return False

        return True

    except Exception as exc:
        logger.exception("Cost validation failed: %s", exc)
        return False


__all__ = [
    "estimate_costs_with_ai",
    "validate_cost_ranges",
    "_extract_cost_range_from_text",
    "_extract_repair_details",
    "_validate_structured_costs",
    "_parse_structured_cost_json",
]
