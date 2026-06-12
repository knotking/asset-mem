import datetime
import json
import logging
import re
from typing import Any, Dict, List, Optional

from google.adk.agents import Agent
from google.genai import types
from pydantic import BaseModel, Field

from agent_framework.execution.thread_context import to_thread

from .config import config
from .ai_cost_estimator import estimate_costs_with_ai, validate_cost_ranges
from .service_pricing_extractor import (
    extract_and_combine_all_pricing,
    calibrate_ai_estimate_with_provider_data,
)
from property_agent.shared.inputs import CheckpointOptionalAgent
from ...model_config import (
    GLOBAL_GEMINI_MODEL,
    direct_gemini_thinking_config,
    global_direct_generate_client_and_model,
)
from ...shared.google_search_grounding import (
    google_search_grounding_tool,
    grounded_prose_with_retry,
)

logger = logging.getLogger(__name__)


class CostAgentInput(BaseModel):
    """Structured input when the cost agent is exposed through AgentTool."""

    user_query: str = Field(description="The original user query or repair question.")
    checkpoint_results: Optional[str] = Field(
        default=None,
        description="Checkpoint retrieval summary containing detected issues and context.",
    )
    checkpoint_optional_agents: Optional[List[CheckpointOptionalAgent]] = Field(
        default=None,
        description="Optional checkpoint analysis agents requested by the caller.",
    )
    context_doc_uris: Optional[List[str]] = Field(
        default=None, description="Context document URIs."
    )
    property_address: Optional[str] = Field(
        default=None, description="Property address for location-aware pricing."
    )
    property_id: Optional[str] = Field(
        default=None, description="Property ID for reference."
    )
    service_results: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional local service provider results for pricing calibration.",
    )


def _extract_diagnosis_from_query(query: str) -> Optional[str]:
    """Attempts to extract the triage diagnosis from the query payload."""
    diagnosis: Optional[str] = None

    # Try direct JSON parsing first
    try:
        parsed = json.loads(query)
        if isinstance(parsed, dict):
            diagnosis = (
                parsed.get("triage_diagnosis")
                or parsed.get("diagnosis")
                or parsed.get("triageResult", {}).get("diagnosis")
                or parsed.get("analysis", {}).get("triageResult", {}).get("diagnosis")
            )
    except (json.JSONDecodeError, TypeError):
        pass

    # If JSON parse failed, try to locate JSON substring within the query
    if diagnosis is None:
        json_match = re.search(r"\{.*\}", query, re.DOTALL)
        if json_match:
            try:
                nested = json.loads(json_match.group(0))
                if isinstance(nested, dict):
                    diagnosis = (
                        nested.get("triage_diagnosis")
                        or nested.get("diagnosis")
                        or nested.get("triageResult", {}).get("diagnosis")
                        or nested.get("analysis", {})
                        .get("triageResult", {})
                        .get("diagnosis")
                    )
            except (json.JSONDecodeError, TypeError):
                pass

    # Fallback: search for "Diagnosis:" lines in the text
    if diagnosis is None:
        diag_match = re.search(r"diagnosis\s*[:\-]\s*(.+)", query, re.IGNORECASE)
        if diag_match:
            diagnosis = diag_match.group(1).splitlines()[0].strip()

    return diagnosis


def _market_location_from_payload(parsed: Dict[str, Any]) -> Optional[str]:
    """Resolve market label from a parsed cost/query JSON object."""
    from property_agent.geo.search_location_utils import market_label, search_location_from_payload
    from property_agent.geo.address_parse import looks_like_coordinate_pair

    pa = (parsed.get("property_address") or parsed.get("address") or "").strip() or None
    explicit = (parsed.get("market_location") or "").strip() or None
    if explicit and not looks_like_coordinate_pair(explicit):
        return explicit
    sl = search_location_from_payload(parsed)
    resolved = market_label(sl, property_address=pa)
    if resolved and not looks_like_coordinate_pair(resolved):
        return resolved
    return explicit or pa or resolved or parsed.get("location")


def _extract_market_location_from_query(query: str) -> Optional[str]:
    """Market/geo label for pricing — prefers explicit market_location, then property_address."""
    market_location: Optional[str] = None

    # Try direct JSON parsing first
    try:
        parsed = json.loads(query)
        if isinstance(parsed, dict):
            market_location = _market_location_from_payload(parsed)
    except (json.JSONDecodeError, TypeError):
        pass

    # If JSON parse failed, try to locate JSON substring within the query
    if market_location is None:
        json_match = re.search(r"\{.*\}", query, re.DOTALL)
        if json_match:
            try:
                nested = json.loads(json_match.group(0))
                if isinstance(nested, dict):
                    market_location = _market_location_from_payload(nested)
            except (json.JSONDecodeError, TypeError):
                pass

    return market_location


def _extract_service_results_from_query(query: str) -> Optional[Dict[str, Any]]:
    """Attempts to extract service provider results from the query payload."""
    service_results: Optional[Dict[str, Any]] = None

    # Try direct JSON parsing first
    try:
        parsed = json.loads(query)
        if isinstance(parsed, dict):
            service_results = parsed.get("serviceResults") or parsed.get(
                "service_results"
            )
    except (json.JSONDecodeError, TypeError):
        pass

    # If JSON parse failed, try to locate JSON substring within the query
    if service_results is None:
        json_match = re.search(r"\{.*\}", query, re.DOTALL)
        if json_match:
            try:
                nested = json.loads(json_match.group(0))
                if isinstance(nested, dict):
                    service_results = nested.get("serviceResults") or nested.get(
                        "service_results"
                    )
            except (json.JSONDecodeError, TypeError):
                pass

    return service_results


def _match_cost_category(context: str) -> Optional[Dict[str, Any]]:
    """Matches the diagnosis context against the cost library to return detailed costs."""
    context_lower = context.lower()

    cost_library: List[Dict[str, Any]] = [
        {
            "keywords": ["paint scratch", "car scratch", "surface scratch"],
            "repair_type": "Automotive paint scratch repair",
            "diy": "$25-70",
            "pro": "$250-600",
            "diy_includes": [
                "Touch-up paint kit",
                "Sandpaper/microfiber cloth",
                "2-4 hours of labor",
            ],
            "service_includes": [
                "Professional paint blending",
                "Clear coat application",
                "Color matching",
            ],
            "notes": "DIY is feasible for shallow scratches. Deep scratches exposing metal typically require professional repainting.",
        },
        {
            "keywords": ["dent repair", "small dent", "car dent"],
            "repair_type": "Minor automotive dent repair",
            "diy": "$40-120",
            "pro": "$180-450",
            "diy_includes": [
                "Paintless dent repair kit",
                "Heat gun or hair dryer",
                "1-2 hours",
            ],
            "service_includes": [
                "Professional paintless dent removal",
                "Panel realignment",
            ],
            "notes": "DIY only advisable for dents without paint damage. Professional repair ensures paint warranty remains intact.",
        },
        {
            "keywords": ["clogged drain", "slow drain", "sink clog"],
            "repair_type": "Clear clogged sink or tub drain",
            "diy": "$15-60",
            "pro": "$150-325",
            "diy_includes": [
                "Drain snake or auger",
                "Enzyme cleaner",
                "30-90 minutes of work",
            ],
            "service_includes": [
                "Professional auger or hydro-jetting",
                "Inspection for pipe damage",
            ],
            "notes": "If multiple fixtures back up simultaneously or there is sewage odor, professional service is recommended immediately.",
        },
        {
            "keywords": ["water leak", "pipe leak", "leaking pipe", "pinhole leak"],
            "repair_type": "Minor interior plumbing leak",
            "diy": "$25-120",
            "pro": "$220-550",
            "diy_includes": [
                "Pipe repair clamp or epoxy",
                "Replacement fittings",
                "Water shutoff and cleanup time",
            ],
            "service_includes": [
                "Pipe section replacement",
                "Soldering/PEX crimping",
                "Moisture remediation guidance",
            ],
            "notes": "DIY temporary fixes buy time, but replacement by a licensed plumber is recommended to prevent hidden water damage.",
        },
        {
            "keywords": ["roof leak", "missing shingle", "roof repair"],
            "repair_type": "Roof shingle patch or minor leak repair",
            "diy": "$80-250",
            "pro": "$350-900",
            "diy_includes": [
                "Replacement shingles",
                "Roof sealant",
                "Safety equipment",
            ],
            "service_includes": [
                "Full leak inspection",
                "Flashing repair",
                "Warranty on workmanship",
            ],
            "notes": "DIY suitable only for single-story, easy-access roofs. Extensive leaks or structural damage require a roofing contractor.",
        },
        {
            "keywords": ["hvac", "furnace", "air conditioner", "ac not cooling"],
            "repair_type": "HVAC diagnostic and tune-up",
            "diy": "$60-180",
            "pro": "$300-850",
            "diy_includes": [
                "Filter replacement",
                "Basic coil cleaning",
                "Thermostat troubleshooting",
            ],
            "service_includes": [
                "Refrigerant check",
                "Electrical diagnostics",
                "Manufacturer-grade parts",
            ],
            "notes": "DIY covers maintenance only. Refrigerant, electrical, or combustion issues must be handled by certified technicians.",
        },
        {
            "keywords": [
                "electrical outlet",
                "outlet replacement",
                "switch replacement",
            ],
            "repair_type": "Replace standard electrical outlet or switch",
            "diy": "$25-75",
            "pro": "$150-300",
            "diy_includes": ["Replacement device", "Voltage tester", "1 hour of labor"],
            "service_includes": [
                "Licensed electrician",
                "Code-compliant installation",
                "Safety testing",
            ],
            "notes": "DIY only if you are confident working with electrical systems and can safely shut off the circuit.",
        },
        {
            "keywords": ["drywall patch", "hole in wall", "drywall repair"],
            "repair_type": "Drywall hole patch and finishing",
            "diy": "$35-120",
            "pro": "$250-600",
            "diy_includes": [
                "Patch kit or drywall sheets",
                "Joint compound and sanding",
                "Paint blending supplies",
            ],
            "service_includes": [
                "Seamless texture matching",
                "Dust containment",
                "Professional painting",
            ],
            "notes": "For holes larger than 6 inches or if texture matching is critical, professional finishing is recommended.",
        },
        {
            "keywords": [
                "appliance repair",
                "washer not",
                "dryer not",
                "refrigerator warm",
            ],
            "repair_type": "Major appliance diagnostic and repair",
            "diy": "$70-190",
            "pro": "$250-650",
            "diy_includes": [
                "Replacement part",
                "Multimeter",
                "Appliance disassembly time",
            ],
            "service_includes": [
                "Manufacturer-trained technician",
                "Diagnostics fee",
                "Labor and warranty",
            ],
            "notes": "DIY depends on part availability and comfort with electrical components. Professional service recommended for sealed systems or gas appliances.",
        },
    ]

    for entry in cost_library:
        if any(keyword in context_lower for keyword in entry["keywords"]):
            return entry

    return None


def _extract_grounding_web_summary_from_query(query: str) -> Optional[str]:
    """Checkpoint-shared web summary (skips a second Google Search grounding call)."""
    try:
        parsed = json.loads(query)
        if isinstance(parsed, dict):
            raw = parsed.get("grounding_web_summary")
            if isinstance(raw, str) and raw.strip():
                return raw.strip()
    except (json.JSONDecodeError, TypeError):
        pass
    return None


def _fetch_market_pricing_context(
    diagnosis: str,
    location: Optional[str],
) -> Optional[str]:
    """
    Pre-fetch live market pricing via a Google Search grounding call.

    Same pattern as DIY ``_diy_web_search_grounded``: direct ``generate_content``
    on ``global_direct_generate_client_and_model()`` (``gemini-3.5-flash`` global).
    Grounding tools are incompatible with JSON mode, so this prose summary becomes
    ``web_context`` for the structured cost call.

    Runs in the calling thread (already a worker thread inside ``to_thread``).
    Returns None gracefully on failure.
    """
    if not config.should_use_market_pricing_search():
        return None

    location_ctx = f" in {location}" if location else " not provided"
    year = datetime.date.today().year
    prompt = (
        f"Repair issue:\n{diagnosis[:4000]}\n\n"
        f"Market location:{location_ctx}\n\n"
        f"What are current {year} repair costs for this issue? "
        "Summarize typical DIY material costs and professional service rates with dollar ranges. "
        "Be concise (under 500 words)."
    )

    try:
        client, model = global_direct_generate_client_and_model()

        def _generate() -> Any:
            return client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    top_p=0.9,
                    max_output_tokens=500,
                    response_modalities=["TEXT"],
                    tools=[google_search_grounding_tool()],
                    thinking_config=direct_gemini_thinking_config(
                        "COST_MARKET_THINKING",
                        default="low",
                    ),
                ),
            )

        text = grounded_prose_with_retry(
            _generate,
            logger=logger,
            label="cost market pricing",
        )
        if text:
            logger.info("Market pricing context fetched len=%d", len(text))
            return text
        return None
    except Exception as exc:
        logger.warning("Market pricing web search failed (non-fatal): %s", exc)
        return None


def _estimate_with_ai(
    diagnosis: str,
    property_address: Optional[str] = None,
    service_results: Optional[Dict[str, Any]] = None,
    *,
    web_context: Optional[str] = None,
) -> tuple[Optional[Dict[str, Any]], float, str]:
    """
    Estimate costs using AI with Google Search grounding.

    Args:
        diagnosis: Triage diagnosis text
        property_address: Property address for location-aware pricing
        service_results: Optional service provider results for calibration

    Returns:
        Tuple of (cost_estimate, confidence, source)
        source is "ai", "ai_calibrated", or "fallback"
    """
    if not config.should_use_ai_estimation():
        logger.info("AI cost estimation disabled by config")
        return None, 0.0, "disabled"

    if not diagnosis or len(diagnosis.strip()) < 10:
        logger.warning("Diagnosis too short for AI estimation")
        return None, 0.0, "invalid_input"

    try:
        # --- Step 1: extract provider pricing and check quality ---
        provider_pricing = None
        has_good_provider_data = False
        if service_results and config.should_calibrate_with_provider_data():
            provider_pricing = extract_and_combine_all_pricing(service_results)
            has_good_provider_data = (
                provider_pricing is not None
                and provider_pricing.get("confidence", 0) >= config.MIN_PROVIDER_DATA_CONFIDENCE
            )

        # --- Step 2: cascade to live web search when no adequate provider data ---
        # If a pre-fetched web_context was already passed in (e.g. from the
        # checkpoint pipeline), skip the search to avoid a redundant call.
        if not has_good_provider_data and not (web_context or "").strip():
            logger.info(
                "No adequate provider pricing data; fetching live market pricing context"
            )
            web_context = _fetch_market_pricing_context(diagnosis, property_address)

        # --- Step 3: call AI cost estimator ---
        from agent_framework.observability.log_redaction import safe_text_preview

        logger.info(
            "Calling AI cost estimator diagnosis_len=%d preview=%r "
            "shared_web_context=%s has_good_provider_data=%s",
            len(diagnosis or ""),
            safe_text_preview(diagnosis, max_len=80),
            bool((web_context or "").strip()),
            has_good_provider_data,
        )
        ai_estimate, confidence = estimate_costs_with_ai(
            diagnosis=diagnosis,
            property_address=property_address,
            service_provider_data=provider_pricing,
            web_context=web_context,
        )

        if not ai_estimate:
            logger.warning("AI cost estimation returned no result")
            return None, 0.0, "ai_failed"

        # Validate the estimate
        if not validate_cost_ranges(ai_estimate):
            logger.warning("AI cost estimate failed validation")
            return None, 0.0, "validation_failed"

        # Check confidence threshold
        if confidence < config.MIN_AI_CONFIDENCE_THRESHOLD:
            logger.warning(
                f"AI confidence {confidence:.2f} below threshold {config.MIN_AI_CONFIDENCE_THRESHOLD}"
            )
            return None, confidence, "low_confidence"

        # Calibrate with provider data if available and confidence is sufficient
        source = "ai"
        if has_good_provider_data and provider_pricing:
            logger.info("Calibrating AI estimate with provider pricing data")
            ai_estimate = calibrate_ai_estimate_with_provider_data(
                ai_estimate,
                provider_pricing,
                calibration_weight=config.PROVIDER_DATA_WEIGHT,
            )
            source = "ai_calibrated"
            confidence = min(confidence + 0.1, 1.0)  # Boost confidence slightly

        logger.info(
            f"AI cost estimation successful: source={source}, confidence={confidence:.2f}"
        )
        return ai_estimate, confidence, source

    except Exception as e:
        logger.error(f"AI cost estimation error: {str(e)}", exc_info=True)
        return None, 0.0, "error"


def _build_cost_response(
    category: Optional[Dict[str, Any]],
    diagnosis: Optional[str],
    fallback_query: str,
) -> Dict[str, Any]:
    if category:
        repair_type = category["repair_type"]
        diy_cost = category["diy"]
        pro_cost = category["pro"]
        diy_includes = category.get(
            "diy_includes", ["Material costs", "Basic tools", "Time investment"]
        )
        service_includes = category.get(
            "service_includes", ["Labor", "Professional expertise", "Warranty coverage"]
        )
        notes = category.get("notes")
    else:
        repair_type = diagnosis or fallback_query
        diy_cost = "$60-250"
        pro_cost = "$250-900"
        diy_includes = [
            "Material/product costs vary by repair type",
            "Basic tools may be required",
            "2-6 hours of focused work",
        ]
        service_includes = [
            "Labor reflective of local rates",
            "Professional diagnostics and guarantees",
            "Permitting/inspection when applicable",
        ]
        notes = "Estimates are benchmarks. Obtain multiple quotes for accuracy, especially when safety or code compliance is involved."

    response: Dict[str, Any] = {
        "costEstimates": {
            "repair_type": repair_type,
            "DIY": {
                "cost_range": diy_cost,
                "includes": diy_includes,
                "savings": "Typically 40-75% vs. labor-inclusive quotes",
                "complexity": "Assess your skill level and safety risks before proceeding",
            },
            "Service": {
                "cost_range": pro_cost,
                "includes": service_includes,
                "benefits": "Licensed expertise, warranty, correct permitting",
                "complexity": "Professional service recommended when safety or warranty is a concern",
            },
            "comparison": {
                "diy_savings": "Savings depend on labor avoided and tool ownership",
                "professional_benefits": "Peace of mind, accountability, faster turnaround",
                "considerations": "Factor in diagnostic fees, emergency surcharges, and parts availability",
            },
        }
    }

    if notes:
        response["costEstimates"]["recommendation"] = {
            "notes": notes,
            "next_steps": "If unsure, capture photos/receipts and request at least two local quotes based on the triage diagnosis.",
        }

    return response


def _default_diy_block() -> Dict[str, Any]:
    return {
        "cost_range": "$50-300",
        "includes": [
            "Material/product costs vary by repair type",
            "Basic tools may be required",
            "Time investment needed",
        ],
        "savings": "60-80% on labor costs",
        "complexity": "Simple repairs may be cost-effective",
    }


def _diy_only_error_response(query: str) -> Dict[str, Any]:
    return {
        "diyCostEstimates": {
            "repair_type": query,
            "DIY": _default_diy_block(),
        }
    }


def _build_diy_only_response(
    full_estimate: Dict[str, Any], query: str
) -> Dict[str, Any]:
    """Slice a full costEstimates payload into diyCostEstimates JSON shape."""
    ce = (
        full_estimate.get("costEstimates", {})
        if isinstance(full_estimate, dict)
        else {}
    )
    if not isinstance(ce, dict):
        ce = {}
    diy = ce.get("DIY")
    repair_type = ce.get("repair_type") or query
    use_diy = isinstance(diy, dict) and bool(diy)
    return {
        "diyCostEstimates": {
            "repair_type": repair_type,
            "DIY": diy if use_diy else _default_diy_block(),
        }
    }


def _compute_full_cost_estimate(query: str) -> Dict[str, Any]:
    """
    Single internal path for full DIY + Service estimates (AI or library fallback).

    Used by cost_estimation and cost_estimation_diy so a DIY-only tool call does not
    repeat grounded model work.
    """
    diagnosis = _extract_diagnosis_from_query(query)
    market_location = _extract_market_location_from_query(query)
    service_results = _extract_service_results_from_query(query)

    if not diagnosis:
        diagnosis = query

    logger.info(
        f"Cost estimation request - diagnosis: {diagnosis[:100]}, market_location: {market_location or 'not provided'}"
    )

    web_context = _extract_grounding_web_summary_from_query(query)

    if config.should_use_ai_estimation():
        ai_estimate, confidence, source = _estimate_with_ai(
            diagnosis=diagnosis,
            property_address=market_location,
            service_results=service_results,
            web_context=web_context,
        )

        if ai_estimate and confidence >= config.MIN_AI_CONFIDENCE_THRESHOLD:
            logger.info(
                f"Using AI cost estimate (source: {source}, confidence: {confidence:.2f})"
            )
            if config.LOG_AI_RESPONSES:
                logger.debug(f"AI estimate: {json.dumps(ai_estimate)}")
            return ai_estimate

        fallback_reason = f"AI estimation failed or low confidence (source: {source}, confidence: {confidence:.2f})"
        if config.LOG_FALLBACK_USAGE:
            logger.warning(fallback_reason)
            fallback_log = config.get_fallback_reason_log(fallback_reason, diagnosis)
            logger.info(f"Fallback event: {json.dumps(fallback_log)}")

    logger.info("Using hardcoded cost library (fallback)")
    context_source = diagnosis or query
    matched = _match_cost_category(context_source)
    return _build_cost_response(matched, diagnosis, fallback_query=query)


def _cost_estimation_sync(query: str) -> str:
    """Sync body for cost_estimation (runs in a worker thread when invoked as a tool)."""
    return json.dumps(_compute_full_cost_estimate(query))


async def cost_estimation(query: str) -> str:
    """
    Provides cost estimates grounded in the triage diagnosis.

    Uses AI-powered estimation with Google Search grounding when enabled,
    falls back to hardcoded cost library when AI fails or confidence is low.

    Async so long-running Gemini + Search work does not block sibling optional agents
    on the same asyncio event loop.
    """
    return await to_thread(_cost_estimation_sync, query)


def _cost_estimation_diy_sync(query: str) -> str:
    """Sync body for cost_estimation_diy."""
    try:
        full = _compute_full_cost_estimate(query)
        return json.dumps(_build_diy_only_response(full, query))
    except Exception:
        return json.dumps(_diy_only_error_response(query))


async def cost_estimation_diy(query: str) -> str:
    """DIY-only cost estimate for the given repair query (worker thread; see cost_estimation)."""
    return await to_thread(_cost_estimation_diy_sync, query)


def cost_estimation_diy_from_library(query: str) -> str:
    """DIY-only cost estimate using the hardcoded library only (no AI / Google Search)."""
    try:
        diagnosis = _extract_diagnosis_from_query(query)
        if not diagnosis:
            diagnosis = query
        context_source = diagnosis or query
        matched = _match_cost_category(context_source)
        response_data = _build_cost_response(matched, diagnosis, fallback_query=query)
        return json.dumps(_build_diy_only_response(response_data, query))
    except Exception:
        logger.exception(
            "cost_estimation_diy_from_library failed for query=%s", query[:200]
        )
        return json.dumps(_diy_only_error_response(query))


_CURRENT_YEAR = datetime.date.today().year

cost_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="cost_agent",
    description="Provides AI-powered, location-aware DIY vs Service cost estimations and DIY-only estimates.",
    instruction=(
        "You are an AI-powered cost estimation agent that provides accurate, location-aware repair cost estimates. "
        "\n\n"
        "Your cost estimation uses:\n"
        "1. AI with Google Search grounding for real-time, location-specific pricing\n"
        "2. Service provider pricing data calibration when available\n"
        "3. Hardcoded cost library as fallback for reliability\n"
        "\n"
        "When calling tools:\n"
        "- Ground every cost estimate in the triage diagnosis, checkpoint_results, or user_query provided in the input payload\n"
        "- Extract diagnosis, checkpoint_results, property_address, and service_results from the input when available\n"
        "- The tools will automatically use AI estimation when enabled and fall back to hardcoded values if needed\n"
        "- Call cost_estimation once per request for DIY vs professional breakdown; do not also call cost_estimation_diy in the same turn (DIY is already included)\n"
        "- Use cost_estimation_diy only when the user explicitly wants DIY-only output shape (no professional line items in the tool JSON); never call both tools for the same diagnosis in one turn\n"
        "- Always return structured JSON exactly as produced by the tools\n"
        "\n"
        "The cost estimates consider:\n"
        "- Regional labor rates and cost-of-living adjustments\n"
        f"- Current {_CURRENT_YEAR} material and service costs from real-time data\n"
        "- Repair complexity and safety factors\n"
        "- Local service provider pricing when available\n"
        "\n"
        "Always provide comprehensive cost breakdowns with DIY and professional service options."
    ),
    input_schema=CostAgentInput,
    tools=[
        cost_estimation,
        cost_estimation_diy,
    ],
)

# ADK AgentEvaluator expects ``root_agent`` on ``*.agent`` modules.
root_agent = cost_agent

__all__ = [
    "cost_agent",
    "root_agent",
]
