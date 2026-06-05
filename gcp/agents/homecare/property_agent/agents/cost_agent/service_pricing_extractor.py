"""
Service provider pricing data extractor.

This module extracts pricing information from service provider results
(SerpAPI and Yelp) to validate and calibrate AI-generated cost estimates.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _extract_price_from_text(text: str) -> List[Tuple[float, float]]:
    """
    Extract price ranges from text using various patterns.

    Args:
        text: Text that may contain pricing information

    Returns:
        List of (low, high) tuples for found price ranges
    """
    price_ranges: List[Tuple[float, float]] = []

    if not text:
        return price_ranges

    # Pattern 1: $XX-$YY or $XX - $YY
    pattern1 = r"\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[-–—]\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)"
    matches1 = re.finditer(pattern1, text)
    for match in matches1:
        try:
            low = float(match.group(1).replace(",", ""))
            high = float(match.group(2).replace(",", ""))
            if low < high and low > 0 and high < 100000:  # Sanity check
                price_ranges.append((low, high))
        except (ValueError, AttributeError):
            continue

    # Pattern 2: $XX to $YY
    pattern2 = (
        r"\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s+to\s+\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)"
    )
    matches2 = re.finditer(pattern2, text, re.IGNORECASE)
    for match in matches2:
        try:
            low = float(match.group(1).replace(",", ""))
            high = float(match.group(2).replace(",", ""))
            if low < high and low > 0 and high < 100000:
                price_ranges.append((low, high))
        except (ValueError, AttributeError):
            continue

    # Pattern 3: Starting at $XX or From $XX
    pattern3 = r"(?:starting at|from|starts at)\s+\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)"
    matches3 = re.finditer(pattern3, text, re.IGNORECASE)
    for match in matches3:
        try:
            price = float(match.group(1).replace(",", ""))
            if price > 0 and price < 100000:
                # Estimate high end as 2-3x the starting price
                price_ranges.append((price, price * 2.5))
        except (ValueError, AttributeError):
            continue

    # Pattern 4: Single price mentions $XX
    pattern4 = r"\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)"
    matches4 = re.finditer(pattern4, text)
    for match in matches4:
        try:
            price = float(match.group(1).replace(",", ""))
            if price > 0 and price < 100000:
                # Create range ±30% around single price
                price_ranges.append((price * 0.7, price * 1.3))
        except (ValueError, AttributeError):
            continue

    return price_ranges


def extract_pricing_from_serp_results(
    serp_results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Extract pricing information from SerpAPI results.

    Args:
        serp_results: List of service provider results from SerpAPI

    Returns:
        Dictionary with extracted pricing data
    """
    pricing_data: Dict[str, Any] = {
        "found_prices": False,
        "price_ranges": [],
        "average_low": None,
        "average_high": None,
        "provider_count": 0,
        "providers_with_pricing": [],
    }

    if not serp_results or not isinstance(serp_results, list):
        return pricing_data

    pricing_data["provider_count"] = len(serp_results)
    all_ranges: List[Tuple[float, float]] = []

    for provider in serp_results:
        if not isinstance(provider, dict):
            continue

        provider_name = provider.get("name", "Unknown")

        # Check various fields for pricing info
        text_fields = [
            provider.get("description", ""),
            provider.get("snippet", ""),
            provider.get("reviews", ""),
            str(provider.get("attributes", {})),
        ]

        combined_text = " ".join(text_fields)
        price_ranges = _extract_price_from_text(combined_text)

        if price_ranges:
            pricing_data["found_prices"] = True
            all_ranges.extend(price_ranges)
            pricing_data["providers_with_pricing"].append(
                {
                    "name": provider_name,
                    "price_ranges": [
                        f"${low:.0f}-${high:.0f}" for low, high in price_ranges
                    ],
                }
            )

    # Calculate averages if we found prices
    if all_ranges:
        avg_low = sum(r[0] for r in all_ranges) / len(all_ranges)
        avg_high = sum(r[1] for r in all_ranges) / len(all_ranges)
        pricing_data["average_low"] = round(avg_low, 2)
        pricing_data["average_high"] = round(avg_high, 2)
        pricing_data["price_ranges"] = [f"${r[0]:.0f}-${r[1]:.0f}" for r in all_ranges]

    logger.info(
        f"Extracted pricing from {len(pricing_data['providers_with_pricing'])} of {pricing_data['provider_count']} SerpAPI providers"
    )

    return pricing_data


def extract_pricing_from_yelp_results(
    yelp_results: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Extract pricing information from Yelp API results.

    Args:
        yelp_results: List of service provider results from Yelp

    Returns:
        Dictionary with extracted pricing data
    """
    pricing_data: Dict[str, Any] = {
        "found_prices": False,
        "price_ranges": [],
        "price_levels": {},  # Yelp uses $ symbols for price level
        "average_low": None,
        "average_high": None,
        "provider_count": 0,
        "providers_with_pricing": [],
    }

    if not yelp_results or not isinstance(yelp_results, list):
        return pricing_data

    pricing_data["provider_count"] = len(yelp_results)
    all_ranges: List[Tuple[float, float]] = []

    # Yelp price level to approximate cost mapping
    price_level_map = {
        "$": (50, 150),
        "$$": (150, 300),
        "$$$": (300, 600),
        "$$$$": (600, 1500),
    }

    for provider in yelp_results:
        if not isinstance(provider, dict):
            continue

        provider_name = provider.get("name", "Unknown")

        # Check for Yelp price level
        price_level = provider.get("price", "")
        if price_level in price_level_map:
            pricing_data["found_prices"] = True
            price_range = price_level_map[price_level]
            all_ranges.append(price_range)

            # Track price level distribution
            pricing_data["price_levels"][price_level] = (
                pricing_data["price_levels"].get(price_level, 0) + 1
            )

            pricing_data["providers_with_pricing"].append(
                {
                    "name": provider_name,
                    "price_level": price_level,
                    "estimated_range": f"${price_range[0]}-${price_range[1]}",
                }
            )

        # Also check text fields for explicit pricing
        text_fields = [
            provider.get("snippet_text", ""),
            provider.get("review_snippet", ""),
            str(provider.get("categories", [])),
        ]

        combined_text = " ".join(text_fields)
        price_ranges = _extract_price_from_text(combined_text)

        if price_ranges:
            pricing_data["found_prices"] = True
            all_ranges.extend(price_ranges)

    # Calculate averages if we found prices
    if all_ranges:
        avg_low = sum(r[0] for r in all_ranges) / len(all_ranges)
        avg_high = sum(r[1] for r in all_ranges) / len(all_ranges)
        pricing_data["average_low"] = round(avg_low, 2)
        pricing_data["average_high"] = round(avg_high, 2)
        pricing_data["price_ranges"] = [f"${r[0]:.0f}-${r[1]:.0f}" for r in all_ranges]

    logger.info(
        f"Extracted pricing from {len(pricing_data['providers_with_pricing'])} of {pricing_data['provider_count']} Yelp providers"
    )

    return pricing_data


def combine_service_provider_pricing(
    serp_pricing: Dict[str, Any], yelp_pricing: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Combine pricing data from multiple sources.

    Args:
        serp_pricing: Pricing data from SerpAPI
        yelp_pricing: Pricing data from Yelp

    Returns:
        Combined pricing data
    """
    combined: Dict[str, Any] = {
        "has_pricing_data": False,
        "sources": [],
        "combined_average_low": None,
        "combined_average_high": None,
        "confidence": 0.0,
        "total_providers": 0,
        "providers_with_pricing": 0,
    }

    # Collect all averages
    averages_low = []
    averages_high = []

    if serp_pricing.get("found_prices"):
        combined["has_pricing_data"] = True
        combined["sources"].append("SerpAPI")
        if serp_pricing.get("average_low"):
            averages_low.append(serp_pricing["average_low"])
        if serp_pricing.get("average_high"):
            averages_high.append(serp_pricing["average_high"])
        combined["providers_with_pricing"] += len(
            serp_pricing.get("providers_with_pricing", [])
        )

    if yelp_pricing.get("found_prices"):
        combined["has_pricing_data"] = True
        combined["sources"].append("Yelp")
        if yelp_pricing.get("average_low"):
            averages_low.append(yelp_pricing["average_low"])
        if yelp_pricing.get("average_high"):
            averages_high.append(yelp_pricing["average_high"])
        combined["providers_with_pricing"] += len(
            yelp_pricing.get("providers_with_pricing", [])
        )

    combined["total_providers"] = serp_pricing.get(
        "provider_count", 0
    ) + yelp_pricing.get("provider_count", 0)

    # Calculate combined averages
    if averages_low:
        combined["combined_average_low"] = round(
            sum(averages_low) / len(averages_low), 2
        )
    if averages_high:
        combined["combined_average_high"] = round(
            sum(averages_high) / len(averages_high), 2
        )

    # Calculate confidence based on data availability
    if combined["has_pricing_data"]:
        # Base confidence on number of providers with pricing
        if combined["total_providers"] > 0:
            coverage = combined["providers_with_pricing"] / combined["total_providers"]
            combined["confidence"] = min(0.3 + (coverage * 0.5), 0.8)  # 0.3-0.8 range

        # Boost confidence if we have data from multiple sources
        if len(combined["sources"]) > 1:
            combined["confidence"] = min(combined["confidence"] + 0.1, 0.9)

    logger.info(
        f"Combined pricing data: {combined['providers_with_pricing']}/{combined['total_providers']} providers, confidence: {combined['confidence']:.2f}"
    )

    return combined


def calibrate_ai_estimate_with_provider_data(
    ai_estimate: Dict[str, Any],
    provider_pricing: Dict[str, Any],
    calibration_weight: float = 0.3,
) -> Dict[str, Any]:
    """
    Calibrate AI-generated cost estimate using real provider pricing data.

    Args:
        ai_estimate: AI-generated cost estimate
        provider_pricing: Combined provider pricing data
        calibration_weight: Weight to give provider data (0.0-1.0)

    Returns:
        Calibrated cost estimate
    """
    if not provider_pricing.get("has_pricing_data"):
        logger.info("No provider pricing data available for calibration")
        return ai_estimate

    if not provider_pricing.get("combined_average_low") or not provider_pricing.get(
        "combined_average_high"
    ):
        logger.info("Insufficient provider pricing data for calibration")
        return ai_estimate

    try:
        calibrated = json.loads(json.dumps(ai_estimate))  # Deep copy

        # Extract AI's professional service estimate
        service_range = (
            calibrated.get("costEstimates", {}).get("Service", {}).get("cost_range", "")
        )

        # Parse AI estimate
        match = re.search(
            r"\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[-–]\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)",
            service_range,
        )
        if not match:
            logger.warning("Could not parse AI service cost range for calibration")
            return ai_estimate

        ai_low = float(match.group(1).replace(",", ""))
        ai_high = float(match.group(2).replace(",", ""))

        # Get provider averages
        provider_low = provider_pricing["combined_average_low"]
        provider_high = provider_pricing["combined_average_high"]

        # Calibrate using weighted average
        calibrated_low = (ai_low * (1 - calibration_weight)) + (
            provider_low * calibration_weight
        )
        calibrated_high = (ai_high * (1 - calibration_weight)) + (
            provider_high * calibration_weight
        )

        # Update the estimate
        calibrated["costEstimates"]["Service"]["cost_range"] = (
            f"${calibrated_low:.0f}-${calibrated_high:.0f}"
        )

        # Add note about calibration
        if "recommendation" not in calibrated["costEstimates"]:
            calibrated["costEstimates"]["recommendation"] = {}

        original_notes = calibrated["costEstimates"]["recommendation"].get("notes", "")
        calibration_note = f" Estimate calibrated using data from {provider_pricing['providers_with_pricing']} local service providers."
        calibrated["costEstimates"]["recommendation"]["notes"] = (
            original_notes + calibration_note
        )

        logger.info(
            f"Calibrated estimate: ${ai_low:.0f}-${ai_high:.0f} → ${calibrated_low:.0f}-${calibrated_high:.0f}"
        )

        return calibrated

    except Exception as e:
        logger.error(f"Calibration failed: {str(e)}", exc_info=True)
        return ai_estimate


def extract_and_combine_all_pricing(
    service_results: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """
    Extract and combine pricing from all available service provider sources.

    Args:
        service_results: Service results containing serpAPIResults and yelpAPIResults

    Returns:
        Combined pricing data or None if no service results
    """
    if not service_results:
        return None

    # Extract from SerpAPI results
    serp_results = service_results.get("localPros", {}).get("serpAPIResults", [])
    serp_pricing = extract_pricing_from_serp_results(serp_results)

    # Extract from Yelp results
    yelp_results = service_results.get("localPros", {}).get("yelpAPIResults", [])
    yelp_pricing = extract_pricing_from_yelp_results(yelp_results)

    # Combine
    combined_pricing = combine_service_provider_pricing(serp_pricing, yelp_pricing)

    return combined_pricing if combined_pricing.get("has_pricing_data") else None


__all__ = [
    "extract_pricing_from_serp_results",
    "extract_pricing_from_yelp_results",
    "combine_service_provider_pricing",
    "calibrate_ai_estimate_with_provider_data",
    "extract_and_combine_all_pricing",
]
