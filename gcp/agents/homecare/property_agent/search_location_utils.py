"""Helpers for unified search_location on agent inputs."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from .agent_inputs import SearchLocation


def parse_search_location(raw: Any) -> Optional[SearchLocation]:
    if raw is None:
        return None
    if isinstance(raw, SearchLocation):
        return raw
    if isinstance(raw, dict):
        try:
            return SearchLocation.model_validate(raw)
        except Exception:
            return None
    return None


def market_label(
    search_location: Optional[SearchLocation],
    property_address: Optional[str] = None,
) -> Optional[str]:
    from .serpapi_geo import resolve_market_label

    return resolve_market_label(search_location, property_address)


def market_coordinates(
    search_location: Optional[SearchLocation],
) -> Optional[Tuple[float, float]]:
    if search_location is None:
        return None
    return search_location.coordinates.lat, search_location.coordinates.lng


def search_location_from_payload(payload: Dict[str, Any]) -> Optional[SearchLocation]:
    return parse_search_location(payload.get("search_location"))


def legacy_search_location_from_payload(payload: Dict[str, Any]) -> Optional[SearchLocation]:
    """Build SearchLocation from deprecated location_* fields when search_location absent."""
    if payload.get("search_location"):
        return parse_search_location(payload["search_location"])
    coords = payload.get("location_coordinates")
    if not coords or coords.get("lat") is None or coords.get("lng") is None:
        return None
    from .agent_inputs import SearchLocationCoordinates

    source = "device_gps" if payload.get("location_type") == "location" else "property_address"
    label = (payload.get("property_address") or "").strip() or None
    if source == "device_gps":
        label = None
    radius = payload.get("location_radius") or 5
    return SearchLocation(
        source=source,
        radius_miles=int(radius),
        coordinates=SearchLocationCoordinates(lat=float(coords["lat"]), lng=float(coords["lng"])),
        label=label,
    )
