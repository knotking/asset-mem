"""SerpAPI / YouTube geo helpers for search_location coordinates."""

from __future__ import annotations

import logging
import math
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import requests

from .agent_inputs import SearchLocation, SearchLocationCoordinates
from .search_location_utils import parse_search_location

logger = logging.getLogger(__name__)

_GEOCODE_REVERSE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
_SERPAPI_LOCATIONS_URL = "https://serpapi.com/locations.json"
_REVERSE_GEOCODE_TIMEOUT_S = 10
_LOCATIONS_API_TIMEOUT_S = 10
_GEO_CACHE_MAX_ENTRIES = 256


def _geo_cache_ttl_seconds() -> float:
    raw = os.getenv("SERPAPI_GEO_CACHE_TTL_SECONDS", "86400").strip()
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 86400.0


class _TtlCache:
    """In-process TTL cache (disabled when ttl_seconds is 0)."""

    def __init__(self, ttl_seconds: float, *, max_size: int = _GEO_CACHE_MAX_ENTRIES) -> None:
        self._ttl = ttl_seconds
        self._max_size = max_size
        self._entries: Dict[Any, Tuple[Any, float]] = {}

    def clear(self) -> None:
        self._entries.clear()

    def get(self, key: Any) -> Optional[Any]:
        if self._ttl <= 0:
            return None
        entry = self._entries.get(key)
        if entry is None:
            return None
        value, expires = entry
        if time.monotonic() > expires:
            self._entries.pop(key, None)
            return None
        return value

    def set(self, key: Any, value: Any) -> None:
        if self._ttl <= 0:
            return
        if len(self._entries) >= self._max_size:
            self._entries.pop(next(iter(self._entries)))
        self._entries[key] = (value, time.monotonic() + self._ttl)


_reverse_geocode_cache = _TtlCache(_geo_cache_ttl_seconds())
_serpapi_locations_cache = _TtlCache(_geo_cache_ttl_seconds())


def clear_geo_caches() -> None:
    """Clear SerpAPI / reverse-geocode caches (tests)."""
    _reverse_geocode_cache.clear()
    _serpapi_locations_cache.clear()

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


def radius_miles_to_maps_zoom(radius_miles: int) -> int:
    """Map search radius to Google Maps zoom (SerpAPI ``z`` / ``ll`` suffix)."""
    miles = max(5, min(100, int(radius_miles)))
    if miles <= 5:
        return 14
    if miles <= 15:
        return 13
    if miles <= 30:
        return 12
    if miles <= 60:
        return 11
    return 10


def maps_ll_from_coordinates(lat: float, lng: float, radius_miles: int) -> str:
    """SerpAPI Google Maps ``ll`` parameter: ``@lat,lng,zoom``."""
    z = radius_miles_to_maps_zoom(radius_miles)
    return f"@{lat:.7f},{lng:.7f},{z}z"


def maps_lat_lon_params(
    search_location: SearchLocation,
) -> Dict[str, Any]:
    """SerpAPI Google Maps ``lat`` / ``lon`` / ``z`` (+ ``nearby``) params."""
    lat = search_location.coordinates.lat
    lng = search_location.coordinates.lng
    return {
        "lat": lat,
        "lon": lng,
        "z": radius_miles_to_maps_zoom(search_location.radius_miles),
        "nearby": True,
    }


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
    return bool(t) and t.endswith("United States") and t.count(",") >= 2 and not is_street_address(t)


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
            logger.debug("serpapi locations.json HTTP %s for q=%r", resp.status_code, query)
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


def _reverse_geocode_sync(lat: float, lng: float) -> Optional[str]:
    cache_key = (round(lat, 4), round(lng, 4))
    cached = _reverse_geocode_cache.get(cache_key)
    if cached is not None:
        return cached

    api_key = (os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GEOCODING_API_KEY") or "").strip()
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


# DIY YouTube geo: loose circle (not tied to search_location.radius_miles).
# YouTube search.list caps locationRadius at 1000 km; 2000 km is clamped to that max.
_YOUTUBE_API_MAX_LOCATION_RADIUS_KM = 1000
_DEFAULT_YOUTUBE_LOCATION_RADIUS_KM = 2000


def youtube_location_radius_km() -> int:
    """Radius for YouTube ``locationRadius`` (env ``DIY_YOUTUBE_LOCATION_RADIUS_KM``, default 2000)."""
    raw = os.getenv(
        "DIY_YOUTUBE_LOCATION_RADIUS_KM",
        str(_DEFAULT_YOUTUBE_LOCATION_RADIUS_KM),
    ).strip()
    try:
        preferred = int(raw)
    except ValueError:
        preferred = _DEFAULT_YOUTUBE_LOCATION_RADIUS_KM
    preferred = max(1, preferred)
    if preferred > _YOUTUBE_API_MAX_LOCATION_RADIUS_KM:
        logger.debug(
            "youtube locationRadius: requested %dkm, using YouTube API max %dkm",
            preferred,
            _YOUTUBE_API_MAX_LOCATION_RADIUS_KM,
        )
        return _YOUTUBE_API_MAX_LOCATION_RADIUS_KM
    return preferred


def youtube_geo_params(
    search_location: Optional[SearchLocation],
) -> Dict[str, str]:
    """
    YouTube Data API ``location`` + ``locationRadius`` (loose geo filter).

    Uses a large fixed radius (default 2000 km, clamped to API max 1000 km), not
    ``search_location.radius_miles``, so more geotagged tutorials qualify.
    """
    if search_location is None:
        return {}
    lat = search_location.coordinates.lat
    lng = search_location.coordinates.lng
    radius_km = youtube_location_radius_km()
    return {
        "location": f"{lat},{lng}",
        "locationRadius": f"{radius_km}km",
    }


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
    source = merged.get("source")
    if source not in ("property_address", "device_gps"):
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
    return enrich_search_location_label(sl, merged.get("property_address") if isinstance(merged.get("property_address"), str) else None)


def parse_search_location_arg(raw: Any) -> Optional[SearchLocation]:
    return merge_search_location_sources(raw)


_IRRELEVANT_PROVIDER_RE = re.compile(
    r"\b(collision|auto\s*body|body\s*shop|towing|impound|tow\s*service|car\s*wash)\b",
    re.IGNORECASE,
)
_RELEVANT_PROVIDER_RE = re.compile(
    r"\b(garage\s*door|overhead\s*door|door\s*repair|painter|painting|paint|refinish)\b",
    re.IGNORECASE,
)


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def _city_hint_from_address(property_address: Optional[str]) -> Optional[str]:
    pa = (property_address or "").strip()
    if not pa:
        return None
    parts = [p.strip() for p in pa.split(",") if p.strip()]
    if len(parts) >= 2:
        return parts[-2].lower()
    return None


def _maps_item_coords(item: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    gps = item.get("gps_coordinates")
    if isinstance(gps, dict):
        lat = gps.get("latitude")
        lng = gps.get("longitude")
        if lat is not None and lng is not None:
            try:
                return float(lat), float(lng)
            except (TypeError, ValueError):
                pass
    return None


def _score_maps_item(
    item: Dict[str, Any],
    anchor_lat: float,
    anchor_lng: float,
    city_hint: Optional[str],
) -> float:
    title = (item.get("title") or item.get("name") or "").strip()
    addr = (item.get("address") or "").strip()
    blob = f"{title} {addr} {(item.get('type') or '')}"
    if _IRRELEVANT_PROVIDER_RE.search(blob):
        return -1000.0
    score = 0.0
    if _RELEVANT_PROVIDER_RE.search(blob):
        score += 40.0
    if re.search(r"\bgarage\s*door\b", blob, re.I):
        score += 25.0
    if re.search(r"\bpaint", blob, re.I):
        score += 15.0
    coords = _maps_item_coords(item)
    if coords:
        dist = _haversine_miles(anchor_lat, anchor_lng, coords[0], coords[1])
        score += max(0.0, 50.0 - dist * 3.0)
        item["_distance_miles"] = round(dist, 1)
    if city_hint and city_hint in addr.lower():
        score += 20.0
    rating = item.get("rating")
    if isinstance(rating, (int, float)) and rating >= 4.5:
        score += 5.0
    return score


def rank_maps_local_results(
    items: List[Dict[str, Any]],
    *,
    anchor_lat: float,
    anchor_lng: float,
    property_address: Optional[str] = None,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    """Filter irrelevant listings and sort by relevance + proximity."""
    city_hint = _city_hint_from_address(property_address)
    scored: List[Tuple[float, Dict[str, Any]]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        s = _score_maps_item(item, anchor_lat, anchor_lng, city_hint)
        if s <= -500:
            continue
        scored.append((s, item))
    scored.sort(key=lambda x: (-x[0], x[1].get("_distance_miles", 9999)))
    return [item for _, item in scored[:max_results]]


def _format_maps_item_line(item: Dict[str, Any]) -> str:
    title = (item.get("title") or item.get("name") or "").strip()
    addr = (item.get("address") or "").strip()
    rating = item.get("rating")
    reviews = item.get("reviews")
    phone = (item.get("phone") or "").strip()
    bits = [b for b in (title, addr) if b]
    dist = item.get("_distance_miles")
    if dist is not None:
        bits.append(f"{dist} mi")
    if rating is not None:
        bits.append(f"rating {rating}")
    if reviews:
        bits.append(f"reviews {reviews}")
    if phone:
        bits.append(phone)
    return " | ".join(bits)


def format_google_maps_results(
    data: Dict[str, Any],
    *,
    search_location: Optional[SearchLocation] = None,
    property_address: Optional[str] = None,
    max_results: int = 10,
) -> str:
    """Serialize ranked/filtered Google Maps local results for agent consumption."""
    local = data.get("local_results")
    if not isinstance(local, list):
        error = data.get("error")
        if error:
            return f"SerpAPI Maps error: {error}"
        return "No local results found."

    items = [x for x in local if isinstance(x, dict)]
    if search_location is not None:
        items = rank_maps_local_results(
            items,
            anchor_lat=search_location.coordinates.lat,
            anchor_lng=search_location.coordinates.lng,
            property_address=property_address,
            max_results=max_results,
        )
        dropped = len(local) - len(items)
        if dropped:
            logger.info(
                "serpapi_search: ranked_maps kept=%d dropped=%d city_hint=%s",
                len(items),
                dropped,
                _city_hint_from_address(property_address),
            )
    else:
        items = items[:max_results]

    places = [_format_maps_item_line(item) for item in items if _format_maps_item_line(item)]
    if places:
        return str(places)
    error = data.get("error")
    if error:
        return f"SerpAPI Maps error: {error}"
    return "No local results found."
