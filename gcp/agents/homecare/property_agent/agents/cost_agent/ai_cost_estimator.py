"""
AI-powered cost estimation using Gemini with Google Search grounding.

This module provides dynamic, location-aware cost estimation that replaces
hardcoded values with real-time market data and AI-driven complexity analysis.
"""

import logging
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import Any, Dict, Optional, Tuple
from google import genai
from google.genai import types

from agent_framework.execution.thread_context import executor_submit
from ...model_config import LEGACY_API_GEMINI
from property_agent.shared.google_search_grounding import google_search_grounding_tool
from .config import CostEstimationConfig

logger = logging.getLogger(__name__)


_COORD_PAIR_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$")


def _extract_location_info(
    property_address: Optional[str],
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extract city, state, and full location string from property address.

    Args:
        property_address: Full property address string

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

    # Try to parse common address formats
    # Format: "123 Main St, San Francisco, CA 94102"
    # Format: "123 Main St, City, State"
    parts = [p.strip() for p in property_address.split(",")]

    city = None
    state = None

    if len(parts) >= 3:
        city = parts[-2].strip()
        # Extract state (first 2 letters before zip if present)
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
    Extract key repair details from diagnosis text.

    Args:
        diagnosis: Triage diagnosis text

    Returns:
        Dictionary with repair_type, severity, materials, and complexity indicators
    """
    diagnosis_lower = diagnosis.lower()

    # Identify repair category
    repair_type = "General repair"
    if any(
        word in diagnosis_lower
        for word in ["plumb", "leak", "pipe", "drain", "faucet", "toilet"]
    ):
        repair_type = "Plumbing"
    elif any(
        word in diagnosis_lower
        for word in ["electric", "outlet", "switch", "wiring", "circuit"]
    ):
        repair_type = "Electrical"
    elif any(
        word in diagnosis_lower
        for word in ["hvac", "ac", "air condition", "furnace", "heat"]
    ):
        repair_type = "HVAC"
    elif any(word in diagnosis_lower for word in ["roof", "shingle", "gutter"]):
        repair_type = "Roofing"
    elif any(
        word in diagnosis_lower for word in ["drywall", "wall", "ceiling", "paint"]
    ):
        repair_type = "Drywall/Painting"
    elif any(
        word in diagnosis_lower
        for word in ["appliance", "washer", "dryer", "refrigerator", "dishwasher"]
    ):
        repair_type = "Appliance"
    elif any(
        word in diagnosis_lower
        for word in ["pest", "termite", "rodent", "insect", "bug"]
    ):
        repair_type = "Pest Control"
    elif any(
        word in diagnosis_lower
        for word in ["car", "vehicle", "automotive", "dent", "scratch"]
    ):
        repair_type = "Automotive"

    # Assess severity
    severity = "moderate"
    if any(
        word in diagnosis_lower
        for word in ["emergency", "urgent", "severe", "major", "extensive"]
    ):
        severity = "high"
    elif any(word in diagnosis_lower for word in ["minor", "small", "simple", "easy"]):
        severity = "low"

    # Identify complexity factors
    complexity_factors = []
    if any(
        word in diagnosis_lower
        for word in ["difficult access", "hard to reach", "confined space"]
    ):
        complexity_factors.append("difficult access")
    if any(word in diagnosis_lower for word in ["permit", "code", "inspection"]):
        complexity_factors.append("permits required")
    if any(word in diagnosis_lower for word in ["safety", "hazard", "dangerous"]):
        complexity_factors.append("safety concerns")
    if any(
        word in diagnosis_lower for word in ["structural", "foundation", "load-bearing"]
    ):
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
    repair_details: Dict[str, Any],
    *,
    web_context: Optional[str] = None,
) -> str:
    """
    Build a structured prompt for AI cost estimation.

    Args:
        diagnosis: Triage diagnosis
        location: Location string (city, state)
        repair_details: Extracted repair details

    Returns:
        Formatted prompt string
    """
    location_context = f" in {location}" if location else ""
    web_block = ""
    if (web_context or "").strip():
        web_block = (
            "\n**Web research (already retrieved; do not request another search):**\n"
            f"{web_context.strip()[:6000]}\n"
        )

    prompt = f"""You are a home repair cost estimation expert. Provide accurate, current cost estimates for the following repair{location_context}.

**Repair Diagnosis:** {diagnosis}
{web_block}

**Repair Type:** {repair_details['repair_type']}
**Severity:** {repair_details['severity']}
**Complexity Factors:** {', '.join(repair_details['complexity_factors']) if repair_details['complexity_factors'] else 'Standard'}

Please provide cost estimates in the following format:

1. **DIY Cost Estimate:**
   - Cost range (materials only, in 2026 dollars)
   - What's included (specific materials, tools needed)
   - Time estimate
   - Skill level required
   - Potential savings vs professional

2. **Professional Service Cost Estimate:**
   - Cost range (labor + materials{location_context}, in 2026 dollars)
   - What's included (labor, materials, warranty, permits if needed)
   - Typical duration
   - Benefits of professional service

3. **Cost Comparison:**
   - DIY savings percentage
   - Professional benefits (safety, warranty, expertise)
   - Important considerations (complexity, safety, code compliance)

4. **Recommendations:**
   - When DIY is appropriate
   - When professional service is recommended
   - Next steps for the homeowner

**Important:** 
- Use current 2026 pricing
- Consider regional cost variations{location_context if location else ""}
- Be specific about materials and labor
- Account for complexity factors: {', '.join(repair_details['complexity_factors']) if repair_details['complexity_factors'] else 'none'}
- Provide realistic ranges, not single point estimates

Return your response in a structured format that can be parsed into JSON."""

    return prompt


def _parse_ai_response_to_json(
    ai_response: str, diagnosis: str, repair_details: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Parse AI response text into structured JSON format.

    Args:
        ai_response: Raw AI response text
        diagnosis: Original diagnosis
        repair_details: Extracted repair details

    Returns:
        Structured cost estimate dictionary
    """
    # Extract cost ranges using regex
    diy_cost_match = re.search(
        r"DIY.*?[\$](\d+)[^\d]*[\$](\d+)", ai_response, re.IGNORECASE | re.DOTALL
    )
    pro_cost_match = re.search(
        r"Professional.*?[\$](\d+)[^\d]*[\$](\d+)",
        ai_response,
        re.IGNORECASE | re.DOTALL,
    )

    diy_cost_range = (
        f"${diy_cost_match.group(1)}-{diy_cost_match.group(2)}"
        if diy_cost_match
        else "$50-300"
    )
    pro_cost_range = (
        f"${pro_cost_match.group(1)}-{pro_cost_match.group(2)}"
        if pro_cost_match
        else "$200-800"
    )

    # Extract key sections
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

    # Extract DIY includes
    diy_includes = []
    diy_includes_match = re.search(
        r"What.*?included[:\s]+(.*?)(?:\n\s*[-•]|\n\n|Time estimate)",
        diy_section,
        re.IGNORECASE | re.DOTALL,
    )
    if diy_includes_match:
        includes_text = diy_includes_match.group(1)
        diy_includes = [
            item.strip("- •\n\r")
            for item in re.findall(r"[-•]\s*([^\n]+)", includes_text)
        ]

    if not diy_includes:
        diy_includes = ["Materials and supplies", "Basic tools", "2-6 hours of work"]

    # Extract professional includes
    service_includes = []
    service_includes_match = re.search(
        r"What.*?included[:\s]+(.*?)(?:\n\s*[-•]|\n\n|Typical duration)",
        pro_section,
        re.IGNORECASE | re.DOTALL,
    )
    if service_includes_match:
        includes_text = service_includes_match.group(1)
        service_includes = [
            item.strip("- •\n\r")
            for item in re.findall(r"[-•]\s*([^\n]+)", includes_text)
        ]

    if not service_includes:
        service_includes = ["Professional labor", "Materials", "Warranty coverage"]

    # Extract savings info
    savings_match = re.search(
        r"savings[:\s]+([^.\n]+)", comparison_section, re.IGNORECASE
    )
    savings = (
        savings_match.group(1).strip()
        if savings_match
        else "Typically 40-70% vs. professional service"
    )

    # Extract complexity assessment
    complexity_diy = "Assess your skill level and safety risks before proceeding"
    if repair_details["complexity_factors"]:
        complexity_diy = f"Moderate to high complexity due to: {', '.join(repair_details['complexity_factors'])}"
    elif repair_details["severity"] == "low":
        complexity_diy = "Low to moderate complexity for DIY with basic skills"

    complexity_pro = "Professional service recommended for safety and quality assurance"
    if repair_details["complexity_factors"]:
        complexity_pro = f"Professional expertise required due to: {', '.join(repair_details['complexity_factors'])}"

    # Extract recommendations
    notes_match = re.search(
        r"When DIY is appropriate[:\s]+(.*?)(?:\n\s*[-•]|When professional)",
        recommendations_section,
        re.IGNORECASE | re.DOTALL,
    )
    notes = (
        notes_match.group(1).strip()
        if notes_match
        else "Consider your skill level, available time, and safety requirements when deciding between DIY and professional service."
    )

    # Build structured response
    response = {
        "costEstimates": {
            "repair_type": diagnosis[:100],  # Use diagnosis as repair type
            "DIY": {
                "cost_range": diy_cost_range,
                "includes": diy_includes[:5],  # Limit to 5 items
                "savings": savings[:200],  # Limit length
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
                "next_steps": "Obtain multiple local quotes for professional service. For DIY, research thoroughly and ensure you have necessary skills and tools.",
            },
        }
    }

    return response


def _generate_cost_estimate_content(
    client: genai.Client,
    prompt: str,
    *,
    web_context: Optional[str] = None,
):
    """Sync Vertex generate_content call (run in a thread for timeout)."""
    ai_cfg = CostEstimationConfig.get_ai_config()
    use_grounding = not (web_context or "").strip()
    tools = [google_search_grounding_tool()] if use_grounding else None
    return client.models.generate_content(
        model=ai_cfg["model"],
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=ai_cfg["temperature"],
            top_p=0.8,
            top_k=40,
            max_output_tokens=ai_cfg["max_output_tokens"],
            response_modalities=["TEXT"],
            tools=tools,
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
    Estimate repair costs using AI with Google Search grounding.

    Args:
        diagnosis: Triage diagnosis text
        property_address: Property address for location-aware pricing
        service_provider_data: Optional pricing data from service providers
        client: Optional genai.Client instance (will create if not provided)

    Returns:
        Tuple of (cost_estimate_dict, confidence_score)
        Returns (None, 0.0) if estimation fails
    """
    try:
        # Extract location information
        city, state, location_string = _extract_location_info(property_address)

        # Extract repair details
        repair_details = _extract_repair_details(diagnosis)

        logger.info(
            f"AI cost estimation for: {repair_details['repair_type']} in {location_string or 'unspecified location'}"
        )

        # Build prompt
        prompt = _build_cost_estimation_prompt(
            diagnosis,
            location_string,
            repair_details,
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

        # Extract response text
        if not response or not response.text:
            logger.warning("AI cost estimation returned empty response")
            return None, 0.0

        ai_response_text = response.text
        logger.debug(f"AI response: {ai_response_text[:500]}...")

        # Parse response into structured JSON
        cost_estimate = _parse_ai_response_to_json(
            ai_response_text, diagnosis, repair_details
        )

        # Calculate confidence score based on response quality
        confidence = 0.7  # Base confidence

        # Increase confidence if location was provided
        if location_string:
            confidence += 0.1

        # Increase confidence if service provider data is available
        if service_provider_data:
            confidence += 0.1

        # Increase confidence if cost ranges were successfully extracted
        if (
            "$" in cost_estimate["costEstimates"]["DIY"]["cost_range"]
            and "$" in cost_estimate["costEstimates"]["Service"]["cost_range"]
        ):
            confidence += 0.1

        confidence = min(confidence, 1.0)  # Cap at 1.0

        logger.info(f"AI cost estimation completed with confidence: {confidence}")

        return cost_estimate, confidence

    except Exception as e:
        logger.error(f"AI cost estimation failed: {str(e)}", exc_info=True)
        return None, 0.0


def validate_cost_ranges(cost_estimate: Dict[str, Any]) -> bool:
    """
    Validate that cost ranges are reasonable and properly formatted.

    Args:
        cost_estimate: Cost estimate dictionary

    Returns:
        True if valid, False otherwise
    """
    try:
        cost_estimates = cost_estimate.get("costEstimates", {})

        # Extract DIY and Service cost ranges
        diy_range = cost_estimates.get("DIY", {}).get("cost_range", "")
        service_range = cost_estimates.get("Service", {}).get("cost_range", "")

        # Check format: $XX-YY
        if not re.match(r"\$\d+[-–]\d+", diy_range) or not re.match(
            r"\$\d+[-–]\d+", service_range
        ):
            logger.warning("Cost ranges not in expected format")
            return False

        # Extract numeric values
        diy_match = re.search(r"\$(\d+)[-–](\d+)", diy_range)
        service_match = re.search(r"\$(\d+)[-–](\d+)", service_range)

        if not diy_match or not service_match:
            return False

        diy_low, diy_high = int(diy_match.group(1)), int(diy_match.group(2))
        service_low, service_high = (
            int(service_match.group(1)),
            int(service_match.group(2)),
        )

        # Validate ranges are sensible
        if diy_low >= diy_high or service_low >= service_high:
            logger.warning("Invalid cost range: low >= high")
            return False

        # DIY should generally be cheaper than professional
        if diy_high > service_high:
            logger.warning(
                "DIY cost higher than professional - unusual but not invalid"
            )

        # Check for unreasonably high costs (> $50,000)
        if diy_high > 50000 or service_high > 50000:
            logger.warning("Cost estimate exceeds $50,000 - may be unrealistic")
            return False

        # Check for unreasonably low costs (< $5)
        if diy_low < 5 or service_low < 5:
            logger.warning("Cost estimate below $5 - may be unrealistic")
            return False

        return True

    except Exception as e:
        logger.exception("Cost validation failed: %s", e)
        return False


__all__ = [
    "estimate_costs_with_ai",
    "validate_cost_ranges",
]
