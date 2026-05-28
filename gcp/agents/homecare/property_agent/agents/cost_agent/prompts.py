"""
Prompt templates for AI-powered cost estimation.

This module contains structured prompts for different aspects of cost estimation
including location-aware pricing, material costs, complexity analysis, and market trends.
"""

from typing import Optional


def get_location_pricing_prompt(trade: str, location: str) -> str:
    """
    Generate prompt for location-aware labor rate estimation.

    Args:
        trade: Type of trade (plumber, electrician, HVAC, etc.)
        location: City and state

    Returns:
        Formatted prompt string
    """
    return f"""What are the typical hourly labor rates for {trade} services in {location} in 2026?

Please provide:
1. Average hourly rate range
2. Factors affecting rates in this location (cost of living, demand, licensing requirements)
3. Typical service call fees or minimum charges
4. How these rates compare to national averages

Focus on current 2026 pricing data."""


def get_material_cost_prompt(
    materials: str, repair_type: str, location: Optional[str] = None
) -> str:
    """
    Generate prompt for material cost estimation.

    Args:
        materials: List or description of materials needed
        repair_type: Type of repair
        location: Optional location for regional pricing

    Returns:
        Formatted prompt string
    """
    location_context = f" in {location}" if location else ""

    return f"""What is the current cost of materials for {repair_type}{location_context} in 2026?

Materials needed: {materials}

Please provide:
1. Cost range for each major material or component
2. Total estimated material cost range
3. Where these materials are typically purchased (home improvement stores, specialty suppliers)
4. Any seasonal price variations or current market trends affecting costs

Use current 2026 pricing."""


def get_complexity_analysis_prompt(diagnosis: str) -> str:
    """
    Generate prompt for repair complexity analysis.

    Args:
        diagnosis: Repair diagnosis text

    Returns:
        Formatted prompt string
    """
    return f"""Analyze the repair complexity for the following issue:

**Diagnosis:** {diagnosis}

Please assess:

1. **Access Difficulty:**
   - How easy is it to reach the repair location?
   - Are special tools or equipment needed for access?
   - Any confined spaces or height work involved?

2. **Skill Level Required:**
   - What level of expertise is needed (beginner, intermediate, advanced, professional-only)?
   - Specific skills or knowledge required
   - Common mistakes or pitfalls for DIY attempts

3. **Time Required:**
   - Estimated time for DIY completion
   - Estimated time for professional completion
   - Factors that could extend the timeline

4. **Safety Concerns:**
   - Any electrical, plumbing, or structural safety issues?
   - Need for protective equipment or safety measures?
   - Risks of improper repair

5. **Code Compliance:**
   - Are permits required?
   - Building code considerations?
   - Inspection requirements?

6. **DIY Feasibility:**
   - Is this repair suitable for DIY?
   - What conditions make it DIY-appropriate vs requiring a professional?
   - Tools and materials needed for DIY approach

Provide a clear assessment of whether this repair is suitable for DIY or requires professional service."""


def get_market_trends_prompt(repair_type: str, location: Optional[str] = None) -> str:
    """
    Generate prompt for current market trends and pricing.

    Args:
        repair_type: Type of repair or service
        location: Optional location for regional trends

    Returns:
        Formatted prompt string
    """
    location_context = f" in {location}" if location else ""

    return f"""What are the current pricing trends for {repair_type} services{location_context} in 2026?

Please provide:

1. **Current Market Rates:**
   - Typical cost range for this type of repair
   - How prices have changed recently
   - Factors driving current pricing

2. **Seasonal Variations:**
   - Are there seasonal price fluctuations?
   - Best time of year for pricing?
   - Current demand levels

3. **Material Cost Trends:**
   - Are material costs rising, falling, or stable?
   - Supply chain considerations
   - Alternative materials or approaches

4. **Labor Availability:**
   - Is there high demand for this type of service?
   - Typical wait times for professionals
   - Impact on pricing

5. **Regional Factors:**
   - How does this location compare to national averages?
   - Local market conditions affecting pricing
   - Regional cost-of-living adjustments

Focus on current 2026 data and trends."""


def get_comprehensive_cost_estimate_prompt(
    diagnosis: str,
    location: Optional[str] = None,
    repair_type: Optional[str] = None,
    severity: Optional[str] = None,
    complexity_factors: Optional[list] = None,
) -> str:
    """
    Generate comprehensive cost estimation prompt with all context.

    Args:
        diagnosis: Full repair diagnosis
        location: Property location (city, state)
        repair_type: Categorized repair type
        severity: Severity level (low, moderate, high)
        complexity_factors: List of complexity factors

    Returns:
        Formatted comprehensive prompt
    """
    location_context = f" in {location}" if location else ""
    repair_context = f"\n**Repair Category:** {repair_type}" if repair_type else ""
    severity_context = f"\n**Severity:** {severity}" if severity else ""
    complexity_context = ""
    if complexity_factors:
        complexity_context = (
            f"\n**Complexity Factors:** {', '.join(complexity_factors)}"
        )

    return f"""You are a home repair cost estimation expert. Provide accurate, detailed cost estimates for the following repair{location_context}.

**Repair Diagnosis:** {diagnosis}{repair_context}{severity_context}{complexity_context}

Please provide comprehensive cost estimates in the following structure:

## 1. DIY Cost Estimate

**Cost Range:** [Provide range in 2026 dollars, materials only]

**What's Included:**
- Specific materials needed with approximate costs
- Tools required (note if homeowner likely already owns)
- Consumables and supplies
- Safety equipment if needed

**Time Estimate:** [Hours or days for completion]

**Skill Level Required:** [Beginner/Intermediate/Advanced]

**Potential Savings:** [Compared to professional service]

**DIY Considerations:**
- Difficulty level and common challenges
- Required skills or knowledge
- Safety concerns
- When DIY is appropriate vs. not recommended

## 2. Professional Service Cost Estimate

**Cost Range:** [Provide range in 2026 dollars, labor + materials{location_context}]

**What's Included:**
- Professional labor (specify hourly rate or flat fee)
- All materials and supplies
- Permits and inspections (if required)
- Warranty coverage
- Cleanup and disposal

**Typical Duration:** [Time for professional completion]

**Benefits of Professional Service:**
- Expertise and experience
- Proper tools and equipment
- Code compliance and permits
- Warranty and insurance
- Safety and liability

## 3. Cost Comparison

**DIY Savings:** [Percentage and dollar amount saved by DIY]

**Professional Benefits:** [Value beyond just labor cost]

**Important Considerations:**
- Tool costs if not already owned
- Time investment and opportunity cost
- Risk of mistakes or need for rework
- Safety and liability concerns
- Code compliance and resale value impact
- Warranty implications

## 4. Recommendations

**When DIY is Appropriate:**
[Conditions under which DIY makes sense]

**When Professional Service is Recommended:**
[Situations requiring professional expertise]

**Next Steps:**
- For DIY: Research resources, tutorials, obtain materials
- For Professional: Get 2-3 quotes, verify licensing and insurance

**Important Notes:**
[Any specific warnings, tips, or considerations for this repair]

---

**Requirements:**
- Use current 2026 pricing data
- Consider regional cost variations{location_context if location else ""}
- Account for all complexity factors{': ' + ', '.join(complexity_factors) if complexity_factors else ""}
- Provide realistic ranges, not single point estimates
- Be specific about what's included in each cost
- Consider both immediate costs and long-term value
"""


def get_cost_validation_prompt(
    estimated_diy_range: str,
    estimated_pro_range: str,
    diagnosis: str,
    location: Optional[str] = None,
) -> str:
    """
    Generate prompt to validate and refine cost estimates.

    Args:
        estimated_diy_range: Initial DIY cost estimate
        estimated_pro_range: Initial professional cost estimate
        diagnosis: Repair diagnosis
        location: Optional location

    Returns:
        Validation prompt
    """
    location_context = f" in {location}" if location else ""

    return f"""Please validate and refine these cost estimates for accuracy:

**Repair:** {diagnosis}
**Location:** {location or "Not specified"}

**Current Estimates:**
- DIY Cost: {estimated_diy_range}
- Professional Service Cost: {estimated_pro_range}

**Validation Questions:**

1. Are these cost ranges realistic for 2026{location_context}?
2. Do the ranges properly account for:
   - Current material costs
   - Regional labor rates
   - Typical markup and overhead
   - Permit and inspection fees (if applicable)

3. Is the DIY estimate reasonable considering:
   - Material costs only (no labor)
   - Tool costs if not owned
   - Consumables and supplies

4. Is the professional estimate reasonable considering:
   - Labor hours required
   - Local labor rates
   - Material markup
   - Overhead and profit margin
   - Warranty and insurance costs

5. Should these estimates be adjusted? If so, provide:
   - Revised DIY range
   - Revised professional range
   - Explanation for adjustments

Please provide validated cost ranges or confirm the current estimates are accurate."""


__all__ = [
    "get_location_pricing_prompt",
    "get_material_cost_prompt",
    "get_complexity_analysis_prompt",
    "get_market_trends_prompt",
    "get_comprehensive_cost_estimate_prompt",
    "get_cost_validation_prompt",
]
