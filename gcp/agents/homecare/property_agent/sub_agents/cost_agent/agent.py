import json
import logging
import re
from typing import Any, Dict, List, Optional

from google.adk.agents import Agent
from google import genai

from .config import config
from .ai_cost_estimator import estimate_costs_with_ai, validate_cost_ranges
from .service_pricing_extractor import extract_and_combine_all_pricing, calibrate_ai_estimate_with_provider_data

logger = logging.getLogger(__name__)


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
        json_match = re.search(r'\{.*\}', query, re.DOTALL)
        if json_match:
            try:
                nested = json.loads(json_match.group(0))
                if isinstance(nested, dict):
                    diagnosis = (
                        nested.get("triage_diagnosis")
                        or nested.get("diagnosis")
                        or nested.get("triageResult", {}).get("diagnosis")
                        or nested.get("analysis", {}).get("triageResult", {}).get("diagnosis")
                    )
            except (json.JSONDecodeError, TypeError):
                pass

    # Fallback: search for "Diagnosis:" lines in the text
    if diagnosis is None:
        diag_match = re.search(r'diagnosis\s*[:\-]\s*(.+)', query, re.IGNORECASE)
        if diag_match:
            diagnosis = diag_match.group(1).splitlines()[0].strip()

    return diagnosis


def _extract_property_address_from_query(query: str) -> Optional[str]:
    """Attempts to extract property address from the query payload."""
    property_address: Optional[str] = None

    # Try direct JSON parsing first
    try:
        parsed = json.loads(query)
        if isinstance(parsed, dict):
            property_address = (
                parsed.get("property_address")
                or parsed.get("address")
                or parsed.get("location")
            )
    except (json.JSONDecodeError, TypeError):
        pass

    # If JSON parse failed, try to locate JSON substring within the query
    if property_address is None:
        json_match = re.search(r'\{.*\}', query, re.DOTALL)
        if json_match:
            try:
                nested = json.loads(json_match.group(0))
                if isinstance(nested, dict):
                    property_address = (
                        nested.get("property_address")
                        or nested.get("address")
                        or nested.get("location")
                    )
            except (json.JSONDecodeError, TypeError):
                pass

    return property_address


def _extract_service_results_from_query(query: str) -> Optional[Dict[str, Any]]:
    """Attempts to extract service provider results from the query payload."""
    service_results: Optional[Dict[str, Any]] = None

    # Try direct JSON parsing first
    try:
        parsed = json.loads(query)
        if isinstance(parsed, dict):
            service_results = (
                parsed.get("serviceResults")
                or parsed.get("service_results")
            )
    except (json.JSONDecodeError, TypeError):
        pass

    # If JSON parse failed, try to locate JSON substring within the query
    if service_results is None:
        json_match = re.search(r'\{.*\}', query, re.DOTALL)
        if json_match:
            try:
                nested = json.loads(json_match.group(0))
                if isinstance(nested, dict):
                    service_results = (
                        nested.get("serviceResults")
                        or nested.get("service_results")
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
            "diy_includes": ["Touch-up paint kit", "Sandpaper/microfiber cloth", "2-4 hours of labor"],
            "service_includes": ["Professional paint blending", "Clear coat application", "Color matching"],
            "notes": "DIY is feasible for shallow scratches. Deep scratches exposing metal typically require professional repainting.",
        },
        {
            "keywords": ["dent repair", "small dent", "car dent"],
            "repair_type": "Minor automotive dent repair",
            "diy": "$40-120",
            "pro": "$180-450",
            "diy_includes": ["Paintless dent repair kit", "Heat gun or hair dryer", "1-2 hours"],
            "service_includes": ["Professional paintless dent removal", "Panel realignment"],
            "notes": "DIY only advisable for dents without paint damage. Professional repair ensures paint warranty remains intact.",
        },
        {
            "keywords": ["clogged drain", "slow drain", "sink clog"],
            "repair_type": "Clear clogged sink or tub drain",
            "diy": "$15-60",
            "pro": "$150-325",
            "diy_includes": ["Drain snake or auger", "Enzyme cleaner", "30-90 minutes of work"],
            "service_includes": ["Professional auger or hydro-jetting", "Inspection for pipe damage"],
            "notes": "If multiple fixtures back up simultaneously or there is sewage odor, professional service is recommended immediately.",
        },
        {
            "keywords": ["water leak", "pipe leak", "leaking pipe", "pinhole leak"],
            "repair_type": "Minor interior plumbing leak",
            "diy": "$25-120",
            "pro": "$220-550",
            "diy_includes": ["Pipe repair clamp or epoxy", "Replacement fittings", "Water shutoff and cleanup time"],
            "service_includes": ["Pipe section replacement", "Soldering/PEX crimping", "Moisture remediation guidance"],
            "notes": "DIY temporary fixes buy time, but replacement by a licensed plumber is recommended to prevent hidden water damage.",
        },
        {
            "keywords": ["roof leak", "missing shingle", "roof repair"],
            "repair_type": "Roof shingle patch or minor leak repair",
            "diy": "$80-250",
            "pro": "$350-900",
            "diy_includes": ["Replacement shingles", "Roof sealant", "Safety equipment"],
            "service_includes": ["Full leak inspection", "Flashing repair", "Warranty on workmanship"],
            "notes": "DIY suitable only for single-story, easy-access roofs. Extensive leaks or structural damage require a roofing contractor.",
        },
        {
            "keywords": ["hvac", "furnace", "air conditioner", "ac not cooling"],
            "repair_type": "HVAC diagnostic and tune-up",
            "diy": "$60-180",
            "pro": "$300-850",
            "diy_includes": ["Filter replacement", "Basic coil cleaning", "Thermostat troubleshooting"],
            "service_includes": ["Refrigerant check", "Electrical diagnostics", "Manufacturer-grade parts"],
            "notes": "DIY covers maintenance only. Refrigerant, electrical, or combustion issues must be handled by certified technicians.",
        },
        {
            "keywords": ["electrical outlet", "outlet replacement", "switch replacement"],
            "repair_type": "Replace standard electrical outlet or switch",
            "diy": "$25-75",
            "pro": "$150-300",
            "diy_includes": ["Replacement device", "Voltage tester", "1 hour of labor"],
            "service_includes": ["Licensed electrician", "Code-compliant installation", "Safety testing"],
            "notes": "DIY only if you are confident working with electrical systems and can safely shut off the circuit.",
        },
        {
            "keywords": ["drywall patch", "hole in wall", "drywall repair"],
            "repair_type": "Drywall hole patch and finishing",
            "diy": "$35-120",
            "pro": "$250-600",
            "diy_includes": ["Patch kit or drywall sheets", "Joint compound and sanding", "Paint blending supplies"],
            "service_includes": ["Seamless texture matching", "Dust containment", "Professional painting"],
            "notes": "For holes larger than 6 inches or if texture matching is critical, professional finishing is recommended.",
        },
        {
            "keywords": ["appliance repair", "washer not", "dryer not", "refrigerator warm"],
            "repair_type": "Major appliance diagnostic and repair",
            "diy": "$70-190",
            "pro": "$250-650",
            "diy_includes": ["Replacement part", "Multimeter", "Appliance disassembly time"],
            "service_includes": ["Manufacturer-trained technician", "Diagnostics fee", "Labor and warranty"],
            "notes": "DIY depends on part availability and comfort with electrical components. Professional service recommended for sealed systems or gas appliances.",
        },
    ]

    for entry in cost_library:
        if any(keyword in context_lower for keyword in entry["keywords"]):
            return entry

    return None


def _estimate_with_ai(
    diagnosis: str,
    property_address: Optional[str] = None,
    service_results: Optional[Dict[str, Any]] = None
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
        # Initialize Gemini client
        client = genai.Client()
        
        # Extract service provider pricing data if available
        provider_pricing = None
        if service_results and config.should_calibrate_with_provider_data():
            provider_pricing = extract_and_combine_all_pricing(service_results)
        
        # Call AI cost estimator
        logger.info(f"Calling AI cost estimator for: {diagnosis[:100]}...")
        ai_estimate, confidence = estimate_costs_with_ai(
            diagnosis=diagnosis,
            property_address=property_address,
            service_provider_data=provider_pricing,
            client=client
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
            logger.warning(f"AI confidence {confidence:.2f} below threshold {config.MIN_AI_CONFIDENCE_THRESHOLD}")
            return None, confidence, "low_confidence"
        
        # Calibrate with provider data if available and confidence is sufficient
        source = "ai"
        if provider_pricing and provider_pricing.get("confidence", 0) >= config.MIN_PROVIDER_DATA_CONFIDENCE:
            logger.info("Calibrating AI estimate with provider pricing data")
            ai_estimate = calibrate_ai_estimate_with_provider_data(
                ai_estimate,
                provider_pricing,
                calibration_weight=config.PROVIDER_DATA_WEIGHT
            )
            source = "ai_calibrated"
            confidence = min(confidence + 0.1, 1.0)  # Boost confidence slightly
        
        logger.info(f"AI cost estimation successful: source={source}, confidence={confidence:.2f}")
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
        diy_includes = category.get("diy_includes", ["Material costs", "Basic tools", "Time investment"])
        service_includes = category.get("service_includes", ["Labor", "Professional expertise", "Warranty coverage"])
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
        notes = (
            "Estimates are benchmarks. Obtain multiple quotes for accuracy, especially when safety or code compliance is involved."
        )

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


def cost_estimation(query: str) -> str:
    """
    Provides cost estimates grounded in the triage diagnosis.
    
    Uses AI-powered estimation with Google Search grounding when enabled,
    falls back to hardcoded cost library when AI fails or confidence is low.
    
    Args:
        query: Query string containing diagnosis and optional context
        
    Returns:
        JSON string with cost estimates
    """
    # Extract context from query
    diagnosis = _extract_diagnosis_from_query(query)
    property_address = _extract_property_address_from_query(query)
    service_results = _extract_service_results_from_query(query)
    
    if not diagnosis:
        diagnosis = query
    
    logger.info(f"Cost estimation request - diagnosis: {diagnosis[:100]}, location: {property_address or 'not provided'}")
    
    # Try AI estimation first if enabled
    if config.should_use_ai_estimation():
        ai_estimate, confidence, source = _estimate_with_ai(
            diagnosis=diagnosis,
            property_address=property_address,
            service_results=service_results
        )
        
        if ai_estimate and confidence >= config.MIN_AI_CONFIDENCE_THRESHOLD:
            logger.info(f"Using AI cost estimate (source: {source}, confidence: {confidence:.2f})")
            if config.LOG_AI_RESPONSES:
                logger.debug(f"AI estimate: {json.dumps(ai_estimate)}")
            return json.dumps(ai_estimate)
        else:
            # Log fallback reason
            fallback_reason = f"AI estimation failed or low confidence (source: {source}, confidence: {confidence:.2f})"
            if config.LOG_FALLBACK_USAGE:
                logger.warning(fallback_reason)
                fallback_log = config.get_fallback_reason_log(fallback_reason, diagnosis)
                logger.info(f"Fallback event: {json.dumps(fallback_log)}")
    
    # Fallback to hardcoded cost library
    logger.info("Using hardcoded cost library (fallback)")
    context_source = diagnosis or query
    matched = _match_cost_category(context_source)
    response_data = _build_cost_response(matched, diagnosis, fallback_query=query)
    
    return json.dumps(response_data)


def cost_estimation_diy(query: str) -> str:
    """Provides DIY-only cost estimate for the given repair query."""
    try:
        full = cost_estimation(query)
        parsed = json.loads(full)
        ce = parsed.get("costEstimates", {}) if isinstance(parsed, dict) else {}
        diy = ce.get("DIY") if isinstance(ce, dict) else None
        repair_type = ce.get("repair_type") if isinstance(ce, dict) else query
        result = {
            "diyCostEstimates": {
                "repair_type": repair_type,
                "DIY": diy
                or {
                    "cost_range": "$50-300",
                    "includes": [
                        "Material/product costs vary by repair type",
                        "Basic tools may be required",
                        "Time investment needed",
                    ],
                    "savings": "60-80% on labor costs",
                    "complexity": "Simple repairs may be cost-effective",
                },
            }
        }
        return json.dumps(result)
    except Exception:
        fallback = {
            "diyCostEstimates": {
                "repair_type": query,
                "DIY": {
                    "cost_range": "$50-300",
                    "includes": [
                        "Material/product costs vary by repair type",
                        "Basic tools may be required",
                        "Time investment needed",
                    ],
                    "savings": "60-80% on labor costs",
                    "complexity": "Simple repairs may be cost-effective",
                },
            }
        }
        return json.dumps(fallback)


cost_agent = Agent(
    model='gemini-2.5-flash',
    name='cost_agent',
    description='Provides AI-powered, location-aware DIY vs Service cost estimations and DIY-only estimates.',
    instruction=(
        'You are an AI-powered cost estimation agent that provides accurate, location-aware repair cost estimates. '
        '\n\n'
        'Your cost estimation uses:\n'
        '1. AI with Google Search grounding for real-time, location-specific pricing\n'
        '2. Service provider pricing data calibration when available\n'
        '3. Hardcoded cost library as fallback for reliability\n'
        '\n'
        'When calling tools:\n'
        '- Ground every cost estimate in the triage diagnosis provided in the input payload\n'
        '- Extract diagnosis, property_address, and serviceResults from the input when available\n'
        '- The tools will automatically use AI estimation when enabled and fall back to hardcoded values if needed\n'
        '- Always return structured JSON exactly as produced by the tools\n'
        '\n'
        'The cost estimates consider:\n'
        '- Regional labor rates and cost-of-living adjustments\n'
        '- Current 2026 material and service costs from real-time data\n'
        '- Repair complexity and safety factors\n'
        '- Local service provider pricing when available\n'
        '\n'
        'Always provide comprehensive cost breakdowns with DIY and professional service options.'
    ),
    tools=[
        cost_estimation,
        cost_estimation_diy,
    ],
)

__all__ = [
    "cost_agent",
]


