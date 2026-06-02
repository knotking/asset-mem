"""Resolve city-level coordinates via SerpAPI locations.json (no Google Geocoding key)."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from .us_address import (
    city_state_from_us_address,
    serpapi_locations_query,
    state_full_name,
)

logger = logging.getLogger(__name__)

_SERPAPI_LOCATIONS_URL = "https://serpapi.com/locations.json"
_LOCATIONS_API_TIMEOUT_S = 10
_CACHE_TTL_S = 3600.0
_CACHE_MAX = 128

_coords_cache: Dict[str, Tuple[float, Tuple[Any, ...]]] = {}


@dataclass(frozen=True)
class SerpApiLocationCoords:
    lat: float
    lng: float
    label: str


def _cache_get(key: str) -> Optional[SerpApiLocationCoords]:
    entry = _coords_cache.get(key)
    if entry is None:
        return None
    expires_at, payload = entry
    if time.monotonic() > expires_at:
        _coords_cache.pop(key, None)
        return None
    lat, lng, label = payload
    return SerpApiLocationCoords(lat=lat, lng=lng, label=label)


def _cache_set(key: str, value: SerpApiLocationCoords) -> None:
    if len(_coords_cache) >= _CACHE_MAX:
        _coords_cache.clear()
    _coords_cache[key] = (
        time.monotonic() + _CACHE_TTL_S,
        (value.lat, value.lng, value.label),
    )


def _filter_candidates_by_state(
    candidates: List[Dict[str, Any]], state_abbr: str
) -> List[Dict[str, Any]]:
    state_full = state_full_name(state_abbr)
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


def parse_serpapi_location_coords(
    property_address: str,
    *,
    candidates: List[Dict[str, Any]],
) -> Optional[SerpApiLocationCoords]:
    """Pick the best US candidate for ``property_address`` city/state."""
    city, state = city_state_from_us_address(property_address)
    if not city or not state:
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
    chosen = us_candidates[0]
    coords = _coords_from_candidate(chosen)
    if coords is None:
        return None

    lat, lng = coords
    label = (chosen.get("canonical_name") or "").strip()
    return SerpApiLocationCoords(lat=lat, lng=lng, label=label or property_address)


async def resolve_property_address_via_serpapi(
    property_address: str,
) -> Optional[SerpApiLocationCoords]:
    """
    City-level lat/lng from SerpAPI ``locations.json``.

    Public endpoint; does not require ``SERP_API_KEY``. Used when Google Geocoding
    is unavailable and the client chose ``property_address`` search mode.
    """
    addr = (property_address or "").strip()
    if not addr:
        return None

    city, state = city_state_from_us_address(addr)
    if not city or not state:
        logger.debug("serpapi coords: no city/state in address=%r", addr)
        return None

    query = serpapi_locations_query(city, state)
    cache_key = query.lower()
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        import aiohttp

        async with aiohttp.ClientSession() as session:
            async with session.get(
                _SERPAPI_LOCATIONS_URL,
                params={"q": query, "limit": 15},
                timeout=aiohttp.ClientTimeout(total=_LOCATIONS_API_TIMEOUT_S),
            ) as resp:
                if resp.status != 200:
                    logger.debug(
                        "serpapi locations.json HTTP %s for q=%r", resp.status, query
                    )
                    return None
                body = await resp.json()
    except Exception as exc:
        logger.debug("serpapi locations.json failed for q=%r: %s", query, exc)
        return None

    if not isinstance(body, list) or not body:
        return None

    resolved = parse_serpapi_location_coords(addr, candidates=body)
    if resolved is not None:
        _cache_set(cache_key, resolved)
        logger.info(
            "search_location: serpapi city fallback q=%r lat=%.4f lng=%.4f",
            query,
            resolved.lat,
            resolved.lng,
        )
    return resolved
