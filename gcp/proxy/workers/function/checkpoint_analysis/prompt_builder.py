"""
Prompt Builder for Checkpoint Analysis

This module provides a platform-agnostic way to build analysis and comparison prompts
based on AI-detected asset types. This makes the system extensible to any asset type
without code changes - the AI determines the appropriate analysis strategy.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def get_asset_category(detected_room: Optional[str], room_features: Optional[list] = None) -> str:
    """
    Categorizes an asset based on detected room/area information.
    
    Uses AI-detected information to determine asset category rather than
    hardcoded keyword matching. This makes the system extensible.
    
    Args:
        detected_room: The detected room/asset name from AI
        room_features: Optional list of detected features
        
    Returns:
        One of: "vehicle", "appliance", "property", or "generic"
    """
    if not detected_room:
        return "generic"
    
    detected_lower = detected_room.lower()
    
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
    
    # Check room_features for additional context
    if room_features:
        features_lower = " ".join([f.lower() for f in room_features])
        if any(keyword in features_lower for keyword in vehicle_keywords):
            return "vehicle"
        if any(keyword in features_lower for keyword in appliance_keywords):
            return "appliance"
    
    # Default to property/generic
    return "property"


def build_analysis_prompt(
    media_type: str,
    location: str,
    asset_category: str = "property",
    detected_room: Optional[str] = None
) -> str:
    """
    Builds an analysis prompt tailored to the asset category.
    
    This is a platform-extensible approach where prompts adapt based on
    AI-detected asset category rather than hardcoded types.
    
    Args:
        media_type: "image" or "video"
        location: Location/asset name
        asset_category: One of "vehicle", "appliance", "property", or "generic"
        detected_room: Optional detected room/asset name for context
        
    Returns:
        Analysis prompt string
    """
    base_context = f"Location/Asset: {location or detected_room or 'Unknown'}"
    
    if asset_category == "vehicle":
        return f"""
        Analyze this {media_type} of a vehicle checkpoint.
        {base_context}
        
        Provide a structured analysis in JSON format with the following fields:
        - summary: A brief summary of the vehicle's condition and what is visible.
        - conditions: A list of conditions specific to vehicles (e.g., "good", "excellent", "fair", "damaged", "wear visible", "clean", "dirty", "well-maintained", "needs maintenance").
        - detectedItems: A list of vehicle components/parts identified (e.g., "tires", "windshield", "paint", "headlights", "bumper", "interior trim", "dashboard", etc.).
        - issues: A list of potential issues, damage, or wear detected:
          * Exterior: paint damage, scratches, dents, rust, tire condition, windshield cracks, light damage, etc.
          * Interior: wear on seats, dashboard cracks, stains, missing parts, etc.
          * Mechanical: visible leaks, worn components, etc.
          If none, return empty list.
        """
    
    elif asset_category == "appliance":
        return f"""
        Analyze this {media_type} of a home appliance checkpoint.
        {base_context}
        
        Provide a structured analysis in JSON format with the following fields:
        - summary: A brief summary of the appliance's condition and what is visible.
        - conditions: A list of conditions specific to appliances (e.g., "good", "excellent", "fair", "poor", "worn", "clean", "dirty", "well-maintained", "needs maintenance", "needs replacement", "efficient", "inefficient").
        - detectedItems: A list of appliance components/parts identified (e.g., "door seals", "control panel", "filter", "coils", "vents", "drain", "hoses", "electrical connections", etc.).
        - issues: A list of potential issues, damage, or wear detected:
          * Physical: dents, scratches, rust, corrosion, cracks, loose parts, worn seals, damaged controls
          * Functional: leaks, poor performance indicators, unusual wear patterns, clogged filters/vents
          * Safety: exposed wires, gas leaks (if visible), improper installation, fire hazards
          * Age/Maintenance: excessive wear, outdated appearance, missing parts, signs of neglect
          If none, return empty list.
        """
    
    else:  # property or generic
        return f"""
        Analyze this {media_type} of a property checkpoint.
        {base_context}
        
        Provide a structured analysis in JSON format with the following fields:
        - summary: A brief summary of what is seen.
        - conditions: A list of conditions (e.g., "good", "damaged", "wear and tear", "clean", "cluttered", "well-maintained").
        - detectedItems: A list of objects or items identified.
        - issues: A list of potential issues or damage detected (structural damage, water damage, wear, etc.). If none, return empty list.
        """


def build_comparison_prompt(
    location: str,
    asset_category: str = "property",
    detected_room: Optional[str] = None
) -> str:
    """
    Builds a comparison prompt tailored to the asset category.
    
    Args:
        location: Location/asset name
        asset_category: One of "vehicle", "appliance", "property", or "generic"
        detected_room: Optional detected room/asset name for context
        
    Returns:
        Comparison prompt string (without the JSON schema part)
    """
    base_context = f"Location/Asset: {location or detected_room or 'Unknown'}"
    
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

