"""SerpAPI locations.json canonical name lookup."""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

from property_agent.shared.inputs import SearchLocation, SearchLocationCoordinates
from property_agent.geo.http import requests
from property_agent.geo.address_parse import (
    _US_STATE_FULL,
    _city_state_from_us_address,
    is_street_address,
)
from property_agent.geo.cache import _serpapi_locations_cache

logger = logging.getLogger(__name__)


_SERPAPI_LOCATIONS_URL = "https://serpapi.com/locations.json"
_LOCATIONS_API_TIMEOUT_S = 10

def _locations_api_query(city: str, state_abbr: str) -> str:
    state_full = _US_STATE_FULL.get(state_abbr.upper(), state_abbr)
    return f"{city.strip()},{state_full}"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _looks_like_serpapi_canonical(text: str) -> bool:
    """True when ``text`` already matches SerpAPI ``canonical_name`` shape."""
    t = (text or "").strip()
    return (
        bool(t)
        and t.endswith("United States")
        and t.count(",") >= 2
        and not is_street_address(t)
    )


def lookup_serpapi_canonical_location(
    search_location: Optional[SearchLocation],
    property_address: Optional[str] = None,
) -> Optional[str]:
    """
    Resolve SerpAPI Shopping ``location`` via ``/locations.json`` (not Google geocode).

    Picks the US candidate closest to ``search_location`` coordinates when present.
    Returns ``None`` when lookup fails (caller should omit ``location`` and rely on ``gl``).
    """
    pa = (property_address or "").strip() or None
    label = ""
    if search_location is not None:
        label = (search_location.label or "").strip()
    if label and _looks_like_serpapi_canonical(label):
        return label

    city: Optional[str] = None
    state: Optional[str] = None
    if pa:
        city, state = _city_state_from_us_address(pa)
    if (not city or not state) and label:
        city, state = _city_state_from_us_address(label)
    if not city or not state:
        logger.debug(
            "serpapi locations: no city/state from property_address=%r label=%r",
            pa,
            label,
        )
        return None

    query = _locations_api_query(city, state)
    cache_key = query.lower()
    cached = _serpapi_locations_cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        resp = requests.get(
            _SERPAPI_LOCATIONS_URL,
            params={"q": query, "limit": 15},
            timeout=_LOCATIONS_API_TIMEOUT_S,
        )
        if not resp.ok:
            logger.debug(
                "serpapi locations.json HTTP %s for q=%r", resp.status_code, query
            )
            return None
        candidates = resp.json()
        if not isinstance(candidates, list) or not candidates:
            return None
    except requests.RequestException:
        logger.debug("serpapi locations.json failed for q=%r", query, exc_info=True)
        return None

    us_candidates = [
        c
        for c in candidates
        if isinstance(c, dict)
        and c.get("country_code") == "US"
        and (c.get("canonical_name") or "").strip()
    ]
    if not us_candidates:
        return None

    us_candidates = _filter_candidates_by_state(us_candidates, state)

    anchor_lat = anchor_lng = None
    if search_location is not None:
        anchor_lat = search_location.coordinates.lat
        anchor_lng = search_location.coordinates.lng

    chosen = us_candidates[0]
    if anchor_lat is not None and anchor_lng is not None:
        best_km = float("inf")
        for cand in us_candidates:
            gps = cand.get("gps")
            if not isinstance(gps, list) or len(gps) < 2:
                continue
            try:
                cand_lng, cand_lat = float(gps[0]), float(gps[1])
            except (TypeError, ValueError):
                continue
            dist = _haversine_km(anchor_lat, anchor_lng, cand_lat, cand_lng)
            if dist < best_km:
                best_km = dist
                chosen = cand

    canonical = (chosen.get("canonical_name") or "").strip()
    if canonical:
        _serpapi_locations_cache.set(cache_key, canonical)
        logger.debug(
            "serpapi locations: resolved q=%r candidates=%d",
            query,
            len(us_candidates),
        )
    return canonical or None


def resolve_serpapi_location_name(
    search_location: Optional[SearchLocation],
    property_address: Optional[str] = None,
) -> Optional[str]:
    """Canonical SerpAPI Shopping ``location`` (``locations.json``, not Google geocode)."""
    return lookup_serpapi_canonical_location(search_location, property_address)


def _filter_candidates_by_state(
    candidates: List[Dict[str, Any]], state_abbr: Optional[str]
) -> List[Dict[str, Any]]:
    if not state_abbr:
        return candidates
    state_full = _US_STATE_FULL.get(state_abbr.upper(), state_abbr)
    needle = state_full.lower()
    matched = [
        c
        for c in candidates
        if needle in ((c.get("canonical_name") or "").lower())
    ]
    return matched or candidates


def _coords_from_candidate(candidate: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    gps = candidate.get("gps")
    if not isinstance(gps, list) or len(gps) < 2:
        return None
    try:
        lng, lat = float(gps[0]), float(gps[1])
    except (TypeError, ValueError):
        return None
    return lat, lng


def _pick_location_candidate(
    candidates: List[Dict[str, Any]],
    *,
    state_abbr: Optional[str],
    anchor_lat: Optional[float] = None,
    anchor_lng: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    us_candidates = [
        c
        for c in candidates
        if isinstance(c, dict)
        and c.get("country_code") == "US"
        and (c.get("canonical_name") or "").strip()
    ]
    if not us_candidates:
        return None
    us_candidates = _filter_candidates_by_state(us_candidates, state_abbr)
    chosen = us_candidates[0]
    if anchor_lat is not None and anchor_lng is not None:
        best_km = float("inf")
        for cand in us_candidates:
            coords = _coords_from_candidate(cand)
            if coords is None:
                continue
            lat, lng = coords
            dist = _haversine_km(anchor_lat, anchor_lng, lat, lng)
            if dist < best_km:
                best_km = dist
                chosen = cand
    return chosen


def resolve_property_address_coords(
    property_address: str,
) -> Optional[Tuple[float, float, str]]:
    """
    City-level lat/lng from SerpAPI ``locations.json`` (no Google Geocoding key).

    Returns ``(lat, lng, label)`` or ``None``.
    """
    pa = (property_address or "").strip()
    if not pa:
        return None
    city, state = _city_state_from_us_address(pa)
    if not city or not state:
        logger.debug("serpapi coords: no city/state in address=%r", pa)
        return None

    query = _locations_api_query(city, state)
    cache_key = f"coords:{query.lower()}"
    cached = _serpapi_locations_cache.get(cache_key)
    if isinstance(cached, tuple) and len(cached) == 3:
        return cached

    try:
        resp = requests.get(
            _SERPAPI_LOCATIONS_URL,
            params={"q": query, "limit": 15},
            timeout=_LOCATIONS_API_TIMEOUT_S,
        )
        if not resp.ok:
            logger.debug(
                "serpapi locations.json HTTP %s for q=%r", resp.status_code, query
            )
            return None
        candidates = resp.json()
        if not isinstance(candidates, list) or not candidates:
            return None
    except requests.RequestException:
        logger.debug("serpapi locations.json failed for q=%r", query, exc_info=True)
        return None

    chosen = _pick_location_candidate(candidates, state_abbr=state)
    if chosen is None:
        return None
    coords = _coords_from_candidate(chosen)
    if coords is None:
        return None
    lat, lng = coords
    label = (chosen.get("canonical_name") or "").strip() or pa
    resolved = (lat, lng, label)
    _serpapi_locations_cache.set(cache_key, resolved)
    logger.info(
        "serpapi coords: resolved q=%r lat=%.4f lng=%.4f",
        query,
        lat,
        lng,
    )
    return resolved


def search_location_from_property_address(
    property_address: str,
    *,
    radius_miles: int = 5,
) -> Optional[SearchLocation]:
    resolved = resolve_property_address_coords(property_address)
    if resolved is None:
        return None
    lat, lng, label = resolved
    return SearchLocation(
        source="property_address",
        radius_miles=radius_miles,
        coordinates=SearchLocationCoordinates(lat=lat, lng=lng),
        label=label,
    )

