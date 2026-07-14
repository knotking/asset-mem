"""
Prompt Builder for Checkpoint Analysis

This module provides a platform-agnostic way to build analysis and comparison prompts
based on AI-detected asset types. This makes the system extensible to any asset type
without code changes - the AI determines the appropriate analysis strategy.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def get_asset_category(detected_asset: Optional[str], asset_features: Optional[list] = None) -> str:
    """
    Categorizes an asset based on detected asset information.
    
    Uses AI-detected information to determine asset category rather than
    hardcoded keyword matching. This makes the system extensible.
    
    Args:
        detected_asset: The detected asset name from AI (e.g., "Kitchen", "Car", "Refrigerator")
        asset_features: Optional list of detected features
        
    Returns:
        One of: "vehicle", "appliance", "property", or "generic"
    """
    if not detected_asset:
        return "generic"
    
    detected_lower = detected_asset.lower()
    
    # Check for vehicle indicators
    vehicle_keywords = ["car", "truck", "vehicle", "motorcycle", "boat", "rv", "automobile"]
    if any(keyword in detected_lower for keyword in vehicle_keywords):
        return "vehicle"
    
    # Check for appliance indicators
    appliance_keywords = [
        "refrigerator", "fridge", "washer", "dryer", "dishwasher", "oven", "stove", "range",
        "hvac", "heating", "cooling", "furnace", "air conditioner", "ac unit", "water heater",
        "waterheater", "microwave", "garbage disposal", "disposal", "appliance", "septic",
        "pump", "boiler"
    ]
    if any(keyword in detected_lower for keyword in appliance_keywords):
        return "appliance"
    
    # Check asset_features for additional context
    if asset_features:
        features_lower = " ".join([f.lower() for f in asset_features])
        if any(keyword in features_lower for keyword in vehicle_keywords):
            return "vehicle"
        if any(keyword in features_lower for keyword in appliance_keywords):
            return "appliance"
    
    # Check for landscape/irrigation indicators
    landscape_keywords = [
        "lawn", "turf", "garden bed", "garden beds", "raised bed", "raised beds",
        "vegetable garden", "flower bed", "flower beds", "planter",
        "irrigation", "sprinkler", "drip line", "drip lines",
        "landscape", "landscaping",
        "french drain", "swale", "drainage system",
        "shrub", "hedge", "ground cover", "mulch", "rock bed",
        "backflow", "irrigation controller",
        "retaining wall", "pathway", "edging",
    ]
    if any(keyword in detected_lower for keyword in landscape_keywords):
        return "landscape_irrigation"

    # Default to property/generic
    return "property"


def build_analysis_prompt(
    media_type: str,
    location: str,
    asset_category: str = "property",
    detected_asset: Optional[str] = None
) -> str:
    """
    Builds an analysis prompt tailored to the asset category.
    
    This is a platform-extensible approach where prompts adapt based on
    AI-detected asset category rather than hardcoded types.
    
    Args:
        media_type: "image" or "video"
        location: Location/asset name
        asset_category: One of "vehicle", "appliance", "property", or "generic"
        detected_asset: Optional detected asset name for context
        
    Returns:
        Analysis prompt string
    """
    base_context = f"Location/Asset: {location or detected_asset or 'Unknown'}"
    
    if asset_category == "vehicle":
        return f"""
        Analyze this {media_type} of a vehicle checkpoint.
        {base_context}
        
        Provide a structured analysis in JSON format with the following fields:
        - summary: A brief summary of the vehicle's condition and what is visible.
        - conditions: A list of conditions specific to vehicles (e.g., "good", "excellent", "fair", "damaged", "wear visible", "clean", "dirty", "well-maintained", "needs maintenance").
        - detectedItems: A list of vehicle components/parts identified (e.g., "tires", "windshield", "paint", "headlights", "bumper", "interior trim", "dashboard", etc.).
        - issues: A list of issue objects, each with:
          * description: Description of the issue
          * severity: "minor", "moderate", "major", or "critical"
          Examples:
          * Exterior: paint damage, scratches, dents, rust, tire condition, windshield cracks, light damage, etc.
          * Interior: wear on seats, dashboard cracks, stains, missing parts, etc.
          * Mechanical: visible leaks, worn components, etc.
          If none, return empty array.
        
        Additionally, provide structured condition and damage scores:
        - condition_scores: An object with component names as keys and scores (0-100) as values:
            * exterior: 0-100 (100 = perfect, 0 = completely damaged)
            * interior: 0-100
            * mechanical: 0-100 (if visible/apparent)
            * paint: 0-100
            * tires: 0-100 (if visible)
            * overall: 0-100 (weighted average of all components)
        
        - damage_scores: An object with damage types as keys and severity (0-100) as values:
            * rust: 0-100 (0 = none, 100 = severe)
            * dents: 0-100
            * scratches: 0-100
            * wear: 0-100
        
        - cost_estimates: An object with cost estimates:
            * repairs_immediate: Estimated immediate repair cost in USD (0 if none needed)
            * maintenance_annual: Estimated annual maintenance cost in USD
        """
    
    elif asset_category == "appliance":
        return f"""
        Analyze this {media_type} of a home appliance checkpoint.
        {base_context}
        
        Provide a structured analysis in JSON format with the following fields:
        - summary: A brief summary of the appliance's condition and what is visible.
        - conditions: A list of conditions specific to appliances (e.g., "good", "excellent", "fair", "poor", "worn", "clean", "dirty", "well-maintained", "needs maintenance", "needs replacement", "efficient", "inefficient").
        - detectedItems: A list of appliance components/parts identified (e.g., "door seals", "control panel", "filter", "coils", "vents", "drain", "hoses", "electrical connections", etc.).
        - issues: A list of issue objects, each with:
          * description: Description of the issue
          * severity: "minor", "moderate", "major", or "critical"
          Examples:
          * Physical: dents, scratches, rust, corrosion, cracks, loose parts, worn seals, damaged controls
          * Functional: leaks, poor performance indicators, unusual wear patterns, clogged filters/vents
          * Safety: exposed wires, gas leaks (if visible), improper installation, fire hazards
          * Age/Maintenance: excessive wear, outdated appearance, missing parts, signs of neglect
          If none, return empty array.
        
        Additionally, provide structured condition and damage scores:
        - condition_scores: An object with component names as keys and scores (0-100) as values:
            * exterior: 0-100 (100 = perfect, 0 = completely damaged)
            * interior: 0-100 (if applicable)
            * seals: 0-100
            * controls: 0-100
            * overall: 0-100 (weighted average of all components)
        
        - damage_scores: An object with damage types as keys and severity (0-100) as values:
            * rust: 0-100 (0 = none, 100 = severe)
            * corrosion: 0-100
            * wear: 0-100
            * leaks: 0-100
        
        - cost_estimates: An object with cost estimates:
            * repairs_immediate: Estimated immediate repair cost in USD (0 if none needed)
            * maintenance_annual: Estimated annual maintenance cost in USD
        """
    
    elif asset_category == "landscape_irrigation":
        return f"""
        Analyze this {media_type} of a landscape and irrigation checkpoint.
        {base_context}

        Provide a structured analysis in JSON format with the following fields:
        - summary: A brief summary of the landscape/irrigation area's condition and what is visible.
        - conditions: A list of conditions specific to landscape and irrigation (e.g., "healthy", "drought stressed", "overgrown", "well-maintained", "weed-infested", "bare patches", "good coverage", "irrigation failure", "waterlogged", "erosion present").
        - detectedItems: A list of landscape/irrigation components identified (e.g., "lawn", "garden beds", "shrubs", "trees", "sprinkler heads", "drip lines", "irrigation controller", "mulch", "retaining wall", "drainage grate", etc.).
        - issues: A list of issue objects, each with:
          * description: Description of the issue
          * severity: "minor", "moderate", "major", or "critical"
          Examples:
          * Plant health: yellowing/browning foliage, bare patches, disease signs, pest damage, drought stress, overwatering symptoms
          * Irrigation: broken or misaligned sprinkler heads, leaks, uneven water coverage, dry spots despite irrigation, ponding
          * Drainage: erosion, standing water, grading problems, washouts, soil displacement
          * Weeds: weed presence and infestation severity
          * Hardscape: retaining wall cracks, heaving, mulch depletion, pathway/edging displacement
          If none, return empty array.

        Additionally, provide structured condition and damage scores:
        - condition_scores: An object with component names as keys and scores (0-100) as values:
            * plant_health: 0-100 (100 = thriving, 0 = dead/failed)
            * irrigation_coverage: 0-100 (100 = uniform full coverage, 0 = no functional coverage)
            * drainage: 0-100 (100 = excellent drainage, 0 = severe standing water/erosion)
            * overall: 0-100 (weighted average of all components)
            * lawn: 0-100 (if lawn visible)
            * garden_beds: 0-100 (if garden beds visible)
            * trees_shrubs: 0-100 (if trees/shrubs visible)
            * hardscape: 0-100 (if retaining walls, edging, or pathways visible)

        - damage_scores: An object with damage types as keys and severity (0-100) as values:
            * drought_stress: 0-100 (0 = none, 100 = severe)
            * pest_damage: 0-100
            * disease: 0-100
            * erosion: 0-100
            * irrigation_failure: 0-100
            * weed_infestation: 0-100

        - cost_estimates: An object with cost estimates:
            * repairs_immediate: Estimated immediate repair cost in USD (0 if none needed)
            * maintenance_annual: Estimated annual maintenance cost in USD
        """

    else:  # property or generic
        return f"""
        Analyze this {media_type} of a property checkpoint.
        {base_context}
        
        Provide a structured analysis in JSON format with the following fields:
        - summary: A brief summary of what is seen.
        - conditions: A list of conditions (e.g., "good", "damaged", "wear and tear", "clean", "cluttered", "well-maintained").
        - detectedItems: A list of objects or items identified.
        - issues: A list of issue objects, each with:
          * description: Description of the issue
          * severity: "minor", "moderate", "major", or "critical"
          Examples: structural damage, water damage, wear, cracks, mold, pest damage, etc.
          If none, return empty array.
        
        Additionally, provide structured condition and damage scores:
        - condition_scores: An object with component names as keys and scores (0-100) as values:
            * roof: 0-100 (100 = perfect, 0 = completely damaged)
            * wall: 0-100
            * foundation: 0-100
            * overall: 0-100 (weighted average of all components)
            * windows: 0-100 (if visible)
            * doors: 0-100 (if visible)
            * paint: 0-100 (if visible)
            * flooring: 0-100 (if visible)
            * ceiling: 0-100 (if visible)
            * plumbing: 0-100 (if visible/apparent)
            * electrical: 0-100 (if visible/apparent)
            * hvac: 0-100 (if visible/apparent)
        
        - damage_scores: An object with damage types as keys and severity (0-100) as values:
            * water: 0-100 (0 = none, 100 = severe)
            * mold: 0-100
            * pest: 0-100
            * cracks: 0-100
        
        - cost_estimates: An object with cost estimates:
            * repairs_immediate: Estimated immediate repair cost in USD (0 if none needed)
            * maintenance_annual: Estimated annual maintenance cost in USD
        """


def build_comparison_prompt(
    location: str,
    asset_category: str = "property",
    detected_asset: Optional[str] = None
) -> str:
    """
    Builds a comparison prompt tailored to the asset category.
    
    Args:
        location: Location/asset name
        asset_category: One of "vehicle", "appliance", "property", or "generic"
        detected_asset: Optional detected asset name for context
        
    Returns:
        Comparison prompt string (without the JSON schema part)
    """
    base_context = f"Location/Asset: {location or detected_asset or 'Unknown'}"
    
    if asset_category == "vehicle":
        return f"""
    Compare these two images/videos of a vehicle checkpoint (Image 1 is 'Before' or 'Previous', Image 2 is 'After' or 'Current').
    {base_context}

    Identify the differences between the two images, focusing on vehicle-specific changes:
    1. Exterior changes: paint damage, scratches, dents, rust, new/repaired damage, tire wear changes.
    2. Interior changes: wear progression, new stains or damage, part replacements, modifications.
    3. Condition changes: deterioration, improvements, maintenance effects, cleaning.

    Provide a structured comparison in JSON format with the following fields:
    """
    
    elif asset_category == "appliance":
        return f"""
    Compare these two images/videos of a home appliance checkpoint (Image 1 is 'Before' or 'Previous', Image 2 is 'After' or 'Current').
    {base_context}

    Identify the differences between the two images, focusing on appliance-specific changes:
    1. Physical condition changes: new dents, scratches, rust, corrosion, cracks, worn seals, damaged controls, loose parts.
    2. Wear progression: increased wear on moving parts, seals, surfaces, indicators of aging or usage.
    3. Functional changes: new leaks, blocked vents/filters, replaced parts, modifications, repairs, or maintenance effects.
    4. Performance indicators: changes that suggest efficiency improvements or degradation.

    Provide a structured comparison in JSON format with the following fields:
    """
    
    elif asset_category == "landscape_irrigation":
        return f"""
    Compare these two images/videos of a landscape and irrigation checkpoint (Image 1 is 'Before' or 'Previous', Image 2 is 'After' or 'Current').
    {base_context}

    Identify the differences between the two images, focusing on landscape and irrigation-specific changes:
    1. Plant health changes: growth or die-back, disease spread or recovery, pest damage progression or treatment effects, drought stress improvement or worsening, seasonal changes vs. structural damage.
    2. Irrigation changes: new leaks, repaired or broken sprinkler heads, shifts in water coverage patterns, dry spots appearing or resolving, ponding or runoff.
    3. Drainage changes: erosion progression or stabilisation, standing water appearing or clearing, grading work effects, soil displacement or washouts.
    4. Weed or pest changes: infestation growth or treatment results.
    5. Hardscape changes: retaining wall movement or repair, mulch depletion or replenishment, edging or pathway displacement.

    Provide a structured comparison in JSON format with the following fields:
    """

    else:  # property or generic
        return f"""
    Compare these two images/videos of a property checkpoint (Image 1 is 'Before' or 'Previous', Image 2 is 'After' or 'Current').
    {base_context}

    Identify the differences between the two images, focusing on:
    1. Structural changes (damage, repairs).
    2. Item changes (added, removed, moved).
    3. Condition changes (wear and tear, cleaning).

    Provide a structured comparison in JSON format with the following fields:
    """

