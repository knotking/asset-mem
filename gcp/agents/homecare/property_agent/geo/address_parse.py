"""US address parsing, reverse geocode, and search_location merge."""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, Literal, Optional, Tuple

from property_agent.shared.inputs import SearchLocation, SearchLocationCoordinates
from property_agent.geo.http import requests
from property_agent.geo.cache import _reverse_geocode_cache
from property_agent.geo.search_location_utils import parse_search_location

logger = logging.getLogger(__name__)

_GEOCODE_REVERSE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
_REVERSE_GEOCODE_TIMEOUT_S = 10

# Abbrev → full name for SerpAPI ``locations.json?q=City,State`` queries.
_US_STATE_FULL: Dict[str, str] = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "DC": "District of Columbia",
}

_COORD_PAIR_RE = re.compile(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$")


def looks_like_coordinate_pair(text: str) -> bool:
    """True when ``text`` is only a lat,lng pair (not a human place name)."""
    return bool(_COORD_PAIR_RE.match((text or "").strip()))


def is_street_address(text: str) -> bool:
    """True when ``text`` looks like a US street address (SerpAPI rejects these)."""
    first = ((text or "").split(",")[0] or "").strip()
    return bool(first and re.match(r"^\d", first))


def _parse_state_zip(segment: str) -> Tuple[Optional[str], Optional[str]]:
    """Parse ``CA 94513`` or ``CA`` from the last comma segment of a US address."""
    seg = (segment or "").strip()
    state_match = re.match(r"^([A-Z]{2})\b", seg)
    if not state_match:
        return None, None
    state = state_match.group(1)
    zip_match = re.search(r"\b(\d{5})(?:-\d{4})?\b", seg)
    return state, zip_match.group(1) if zip_match else None


def _format_serpapi_city_state_zip(
    city: str, state: str, zip_code: Optional[str] = None
) -> str:
    """SerpAPI Shopping ``location`` — ``City, ST ZIP`` (zip optional)."""
    city = city.strip()
    state = state.strip()
    if zip_code:
        return f"{city}, {state} {zip_code.strip()}"
    return f"{city}, {state}"


def city_region_from_us_address(address: str) -> Optional[str]:
    """
    City-level place string for SerpAPI Shopping ``location``.

    Example: ``1982 Helena Way, Brentwood, CA 94513`` → ``Brentwood, CA 94513``.
    """
    addr = (address or "").strip()
    if not addr or looks_like_coordinate_pair(addr):
        return None
    addr = re.sub(r",\s*(USA|United States)\s*$", "", addr, flags=re.IGNORECASE)
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    if len(parts) < 2:
        return None
    if len(parts) >= 3 and is_street_address(addr):
        city = parts[-2]
        state, zip_code = _parse_state_zip(parts[-1])
        if city and state:
            return _format_serpapi_city_state_zip(city, state, zip_code)
    if len(parts) == 2:
        state, zip_code = _parse_state_zip(parts[1])
        if state:
            return _format_serpapi_city_state_zip(parts[0], state, zip_code)
    return None


def normalize_serpapi_shopping_location(text: str) -> Optional[str]:
    """Normalize a place string for SerpAPI Shopping (never a street address)."""
    raw = (text or "").strip()
    if not raw or looks_like_coordinate_pair(raw):
        return None
    if is_street_address(raw):
        return city_region_from_us_address(raw)
    parsed = city_region_from_us_address(raw)
    if parsed:
        return parsed
    trimmed = re.sub(r",\s*(USA|United States)\s*$", "", raw, flags=re.IGNORECASE)
    if re.search(r",\s*United States\s*$", trimmed, flags=re.IGNORECASE):
        without_country = re.sub(
            r",\s*United States\s*$", "", trimmed, flags=re.IGNORECASE
        ).strip()
        parts = [p.strip() for p in without_country.split(",") if p.strip()]
        if len(parts) == 2:
            state, zip_code = _parse_state_zip(parts[1])
            if state:
                return _format_serpapi_city_state_zip(parts[0], state, zip_code)
    return trimmed or None

def strip_embedded_geo_from_query(query: str) -> str:
    """Remove prose geo clauses the LLM may have added; geo is passed structurally."""
    q = (query or "").strip()
    if not q:
        return ""
    q = re.sub(
        r"\s+near\s+-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?(?:\s+within\s+\d+\s+miles?)?",
        "",
        q,
        flags=re.IGNORECASE,
    )
    q = re.sub(r"\s+within\s+\d+\s+miles?\b", "", q, flags=re.IGNORECASE)
    q = re.sub(r"\s+near\s+me\b", "", q, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", q).strip()

def resolve_market_label(
    search_location: Optional[SearchLocation],
    property_address: Optional[str] = None,
) -> Optional[str]:
    """
    Human-readable market label for cost, shopping, and DIY locality.

    Order: ``search_location.label`` → reverse geocode → ``property_address`` → coords.
    """
    pa = (property_address or "").strip() or None
    if search_location is None:
        return pa
    label = (search_location.label or "").strip()
    if label:
        return label
    if pa:
        return pa
    lat = search_location.coordinates.lat
    lng = search_location.coordinates.lng
    geocoded = _reverse_geocode_sync(lat, lng)
    if geocoded:
        return geocoded
    lat = search_location.coordinates.lat
    lng = search_location.coordinates.lng
    return f"{lat:.4f},{lng:.4f}"


def enrich_search_location_label(
    search_location: Optional[SearchLocation],
    property_address: Optional[str] = None,
) -> Optional[SearchLocation]:
    """Fill ``label`` on ``search_location`` when missing (reverse geocode or property address)."""
    if search_location is None:
        return None
    if (search_location.label or "").strip():
        return search_location
    resolved = resolve_market_label(search_location, property_address)
    if not resolved:
        return search_location
    return search_location.model_copy(update={"label": resolved})
def _city_state_from_us_address(
    address: str,
) -> Tuple[Optional[str], Optional[str]]:
    """Extract city and state abbreviation from a US address string."""
    addr = (address or "").strip()
    if not addr or looks_like_coordinate_pair(addr):
        return None, None
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    if len(parts) >= 3 and is_street_address(addr):
        return parts[-2], _parse_state_zip(parts[-1])[0]
    if len(parts) == 2:
        return parts[0], _parse_state_zip(parts[1])[0]
    return None, None

def _reverse_geocode_sync(lat: float, lng: float) -> Optional[str]:
    cache_key = (round(lat, 4), round(lng, 4))
    cached = _reverse_geocode_cache.get(cache_key)
    if cached is not None:
        return cached

    api_key = (
        os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GEOCODING_API_KEY") or ""
    ).strip()
    if not api_key:
        return None
    resolved: Optional[str] = None
    try:
        resp = requests.get(
            _GEOCODE_REVERSE_URL,
            params={"latlng": f"{lat},{lng}", "key": api_key},
            timeout=_REVERSE_GEOCODE_TIMEOUT_S,
        )
        if not resp.ok:
            return None
        body = resp.json()
        if body.get("status") != "OK" or not body.get("results"):
            return None
        result = body["results"][0]
        locality = postal = state = None
        for comp in result.get("address_components") or []:
            types = comp.get("types") or []
            if "locality" in types:
                locality = (comp.get("long_name") or "").strip()
            elif "postal_code" in types:
                postal = (comp.get("long_name") or "").strip()
            elif "administrative_area_level_1" in types:
                state = (comp.get("short_name") or "").strip()
        if locality and state:
            resolved = _format_serpapi_city_state_zip(locality, state, postal)
        else:
            formatted = (result.get("formatted_address") or "").strip()
            if formatted:
                resolved = normalize_serpapi_shopping_location(formatted) or formatted
    except requests.RequestException:
        logger.debug("reverse geocode failed for %s,%s", lat, lng, exc_info=True)
    if resolved:
        _reverse_geocode_cache.set(cache_key, resolved)
    return resolved
def _coords_from_mapping(data: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    coords = data.get("coordinates")
    if not isinstance(coords, dict):
        return None
    lat, lng = coords.get("lat"), coords.get("lng")
    if lat is None or lng is None:
        return None
    try:
        return float(lat), float(lng)
    except (TypeError, ValueError):
        return None


def merge_search_location_sources(
    primary: Any,
    fallback: Any = None,
) -> Optional[SearchLocation]:
    """
    Build SearchLocation from tool args and/or session state.

    LLM tool calls often omit ``source``; session state may hold the full object.
    When coordinates are present, defaults ``source`` to ``device_gps`` and
    ``radius_miles`` to 5.
    """
    if isinstance(primary, SearchLocation):
        return primary
    if primary is None and isinstance(fallback, SearchLocation):
        return fallback

    merged: Dict[str, Any] = {}
    for raw in (fallback, primary):
        if raw is None:
            continue
        if isinstance(raw, SearchLocation):
            return raw
        if isinstance(raw, dict):
            for key, value in raw.items():
                if value is not None:
                    merged[key] = value

    if not merged:
        return None

    sl = parse_search_location(merged)
    if sl is not None:
        return sl

    coords = _coords_from_mapping(merged)
    if coords is None:
        return None

    lat, lng = coords
    source_raw = merged.get("source")
    if source_raw in ("property_address", "device_gps"):
        source: Literal["property_address", "device_gps"] = source_raw
    else:
        source = "device_gps"

    radius = merged.get("radius_miles", 5)
    try:
        radius = int(radius)
    except (TypeError, ValueError):
        radius = 5

    label = merged.get("label")
    if isinstance(label, str):
        label = label.strip() or None
    else:
        label = None
    if not label:
        pa = merged.get("property_address")
        if isinstance(pa, str) and pa.strip():
            label = pa.strip()

    sl = SearchLocation(
        source=source,
        radius_miles=radius,
        coordinates=SearchLocationCoordinates(lat=lat, lng=lng),
        label=label,
    )
    return enrich_search_location_label(
        sl,
        merged.get("property_address")
        if isinstance(merged.get("property_address"), str)
        else None,
    )


def parse_search_location_arg(raw: Any) -> Optional[SearchLocation]:
    return merge_search_location_sources(raw)

