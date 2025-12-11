import json
import re
from typing import Any, Dict, List, Optional

from google.adk.agents import Agent


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
    """Provides cost estimates grounded in the triage diagnosis."""
    diagnosis = _extract_diagnosis_from_query(query)
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
    model='gemini-3-pro-preview',
    name='cost_agent',
    description='Provides DIY vs Service cost estimations and DIY-only estimates.',
    instruction=(
        'Ground every cost estimate in the triage diagnosis provided in the input payload. '
        'Extract the diagnosis details before calling a tool and prefer the most specific category. '
        'Always return structured JSON exactly as produced by the tools.'
    ),
    tools=[
        cost_estimation,
        cost_estimation_diy,
    ],
)

__all__ = [
    "cost_agent",
]


