import json
from google.adk.agents import Agent


def cost_estimation(query: str) -> str:
    """Provides high-level cost estimates for DIY and professional service options."""
    query_lower = query.lower()

    cost_categories = {
        # Automotive repairs
        "scratch": {"diy": "$20-50", "pro": "$200-500", "description": "Paint touch-up and scratch repair"},
        "dent": {"diy": "$30-80", "pro": "$150-400", "description": "Minor dent repair"},
        "brake": {"diy": "$100-300", "pro": "$300-600", "description": "Brake pad/rotor replacement"},
        "oil": {"diy": "$30-50", "pro": "$50-80", "description": "Oil change service"},

        # Home repairs
        "plumbing": {"diy": "$50-150", "pro": "$150-400", "description": "Minor plumbing repair"},
        "leak": {"diy": "$20-100", "pro": "$200-500", "description": "Pipe leak repair"},
        "electrical": {"diy": "$30-100", "pro": "$150-300", "description": "Outlet/switch replacement"},
        "drywall": {"diy": "$20-50", "pro": "$200-400", "description": "Drywall patch and repair"},
        "painting": {"diy": "$50-200", "pro": "$300-800", "description": "Room painting"},

        # Appliance repairs
        "appliance": {"diy": "$50-200", "pro": "$200-500", "description": "Appliance repair"},
        "refrigerator": {"diy": "$100-300", "pro": "$300-600", "description": "Refrigerator repair"},
        "washer": {"diy": "$50-150", "pro": "$200-400", "description": "Washing machine repair"},
        "dryer": {"diy": "$50-150", "pro": "$200-400", "description": "Dryer repair"},

        # HVAC
        "hvac": {"diy": "$100-300", "pro": "$300-800", "description": "HVAC maintenance/repair"},
        "furnace": {"diy": "$100-400", "pro": "$400-1000", "description": "Furnace repair"},
        "air conditioning": {"diy": "$100-300", "pro": "$300-800", "description": "AC repair"},
    }

    matched_category = None
    for category, costs in cost_categories.items():
        if category in query_lower:
            matched_category = costs
            break

    if matched_category:
        diy_cost = matched_category["diy"]
        pro_cost = matched_category["pro"]
        description = matched_category["description"]

        response_data = {
            "costEstimates": {
                "repair_type": description.title(),
                "DIY": {
                    "cost_range": diy_cost,
                    "includes": [
                        "Material/product costs",
                        "Basic tools (if needed)",
                        "Time investment required",
                    ],
                    "savings": "60-80% on labor costs",
                    "complexity": "Simple repairs may be cost-effective",
                },
                "Service": {
                    "cost_range": pro_cost,
                    "includes": [
                        "Labor costs",
                        "Professional expertise",
                        "Warranty/guarantee included",
                    ],
                    "benefits": "Expertise and warranty",
                    "complexity": "Complex or safety-critical repairs recommended",
                },
                "comparison": {
                    "diy_savings": "60-80% on labor costs",
                    "professional_benefits": "Expertise and warranty",
                    "considerations": "Complexity and skill level",
                },
                "recommendation": {
                    "simple_repairs": "DIY may be cost-effective",
                    "complex_repairs": "Professional service recommended",
                    "note": "Estimates may vary by location and specific circumstances",
                },
            }
        }
    else:
        response_data = {
            "costEstimates": {
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
                "Service": {
                    "cost_range": "$200-800",
                    "includes": [
                        "Labor costs depend on complexity",
                        "Professional expertise included",
                        "Warranty/guarantee typically provided",
                    ],
                    "benefits": "Expertise and warranty",
                    "complexity": "Complex or safety-critical repairs recommended",
                },
                "comparison": {
                    "diy_savings": "60-80% on labor costs",
                    "professional_benefits": "Expertise and warranty",
                    "considerations": "Repair complexity and safety factors",
                },
                "recommendation": {
                    "simple_repairs": "DIY may be cost-effective",
                    "complex_repairs": "Professional service recommended",
                    "note": "Estimates are rough and may vary significantly by location and specific circumstances. For accurate estimates, consult local professionals or get multiple quotes.",
                },
            }
        }

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
    description='Provides DIY vs Service cost estimations and DIY-only estimates.',
    instruction='Use these tools to estimate costs. Always produce JSON as defined by the tool outputs.',
    tools=[
        cost_estimation,
        cost_estimation_diy,
    ],
)

__all__ = [
    "cost_agent",
]


