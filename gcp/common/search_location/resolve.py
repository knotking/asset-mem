"""Resolve client search location + legacy fields into canonical SearchLocation."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

from .models import (
    DEFAULT_SEARCH_RADIUS_MILES,
    SearchLocation,
    SearchLocationCoordinates,
    SearchLocationInput,
    SearchLocationSource,
)

logger = logging.getLogger(__name__)


def _clamp_radius(radius: Optional[int]) -> int:
    from .models import MAX_SEARCH_RADIUS_MILES, MIN_SEARCH_RADIUS_MILES

    if radius is None:
        return DEFAULT_SEARCH_RADIUS_MILES
    if radius < MIN_SEARCH_RADIUS_MILES:
        return MIN_SEARCH_RADIUS_MILES
    if radius > MAX_SEARCH_RADIUS_MILES:
        return MAX_SEARCH_RADIUS_MILES
    return radius


def _coords_from_dict(data: Optional[Dict[str, Any]]) -> Optional[SearchLocationCoordinates]:
    if not data:
        return None
    lat = data.get("lat")
    lng = data.get("lng")
    if lat is None or lng is None:
        return None
    try:
        return SearchLocationCoordinates(lat=float(lat), lng=float(lng))
    except (TypeError, ValueError):
        return None


def _legacy_source(location_type: Optional[str]) -> Optional[SearchLocationSource]:
    if location_type == "location":
        return "device_gps"
    if location_type == "address":
        return "property_address"
    return None


def parse_search_location_input(raw: Any) -> Optional[SearchLocationInput]:
    if raw is None:
        return None
    if isinstance(raw, SearchLocationInput):
        return raw
    if isinstance(raw, dict):
        try:
            return SearchLocationInput.model_validate(raw)
        except Exception:
            return None
    return None


async def resolve_search_location(
    *,
    property_address: Optional[str] = None,
    search_location_input: Optional[SearchLocationInput] = None,
    # Legacy adapter (deprecated)
    location_type: Optional[str] = None,
    location_coordinates: Optional[Dict[str, float]] = None,
    location_radius: Optional[int] = None,
) -> Optional[SearchLocation]:
    """
    Build canonical SearchLocation for agent payloads.

    Priority:
    1. Explicit search_location_input from client
    2. Legacy location_type + location_coordinates / property_address
  """
    addr = (property_address or "").strip() or None
    radius = _clamp_radius(
        search_location_input.radius_miles if search_location_input else location_radius
    )

    source: Optional[SearchLocationSource] = None
    coords: Optional[SearchLocationCoordinates] = None
    label: Optional[str] = None

    if search_location_input is not None:
        source = search_location_input.source
        coords = search_location_input.coordinates
        if source == "property_address":
            label = addr
        radius = _clamp_radius(search_location_input.radius_miles or radius)
    else:
        source = _legacy_source(location_type)
        coords = _coords_from_dict(location_coordinates)
        if source == "property_address":
            label = addr
        elif source == "device_gps" and coords:
            label = None

    if source is None:
        if coords is not None:
            source = "device_gps"
        elif addr and location_type == "address":
            source = "property_address"
            label = addr
        else:
            return None

    if source == "device_gps":
        if coords is None:
            logger.warning("search_location: device_gps requested but no coordinates")
            return None
        if not label and addr:
            label = addr
        elif not label:
            rev = await _reverse_geocode_label(coords.lat, coords.lng)
            if rev:
                label = rev
        return SearchLocation(
            source=source,
            radius_miles=radius,
            coordinates=coords,
            label=label,
        )

    # property_address: geocode when possible
    if not addr:
        logger.warning("search_location: property_address source but no property_address")
        return None

    geocoded = await _geocode_address(addr)
    if geocoded:
        coords, formatted = geocoded
        return SearchLocation(
            source="property_address",
            radius_miles=radius,
            coordinates=coords,
            label=formatted or addr,
        )

    if coords is not None:
        return SearchLocation(
            source="property_address",
            radius_miles=radius,
            coordinates=coords,
            label=addr,
        )

    logger.warning("search_location: could not resolve property_address to coordinates")
    return None


async def _reverse_geocode_label(lat: float, lng: float) -> Optional[str]:
    try:
        import aiohttp

        api_key = os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GEOCODING_API_KEY")
        if not api_key:
            return None
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"latlng": f"{lat},{lng}", "key": api_key}
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return None
                body = await resp.json()
        if body.get("status") != "OK" or not body.get("results"):
            return None
        formatted = (body["results"][0].get("formatted_address") or "").strip()
        return formatted or None
    except Exception as e:
        logger.debug("reverse geocode label failed: %s", e)
        return None


async def _geocode_address(address: str) -> Optional[tuple[SearchLocationCoordinates, Optional[str]]]:
    try:
        from common.geocoding import GeocodingClient, GeocodingConfig

        config = GeocodingConfig.from_env()
        if not config.is_configured:
            return None
        client = GeocodingClient(config)
        response = await client.geocode(address, region="us")
        if response.success and response.has_location and response.lat is not None and response.lng is not None:
            return (
                SearchLocationCoordinates(lat=response.lat, lng=response.lng),
                response.formatted_address,
            )
    except Exception as e:
        logger.warning("search_location geocode failed: %s", e, exc_info=True)
    return None
