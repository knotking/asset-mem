"""Helpers for unified search_location on agent inputs."""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from property_agent.shared.inputs import SearchLocation


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
    from property_agent.geo.address_parse import resolve_market_label

    return resolve_market_label(search_location, property_address)


def market_coordinates(
    search_location: Optional[SearchLocation],
) -> Optional[Tuple[float, float]]:
    if search_location is None:
        return None
    return search_location.coordinates.lat, search_location.coordinates.lng


def search_location_from_payload(payload: Dict[str, Any]) -> Optional[SearchLocation]:
    return parse_search_location(payload.get("search_location"))
