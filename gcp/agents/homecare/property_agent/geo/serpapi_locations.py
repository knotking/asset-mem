"""SerpAPI locations.json canonical name lookup."""

from __future__ import annotations

import logging
import math

from property_agent.shared.inputs import SearchLocation
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

