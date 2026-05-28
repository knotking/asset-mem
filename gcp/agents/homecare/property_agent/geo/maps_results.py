"""Google Maps local results ranking and formatting."""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

from property_agent.shared.inputs import SearchLocation

logger = logging.getLogger(__name__)

# Google Maps place types that indicate retail/supply, not trade contractors.
_RETAIL_MAPS_PLACE_TYPES = frozenset(
    {
        "hardware store",
        "home goods store",
        "lumber store",
        "tool store",
        "building materials store",
        "department store",
        "discount store",
        "warehouse store",
        "auto parts store",
    }
)


def _maps_place_type(item: Dict[str, Any]) -> str:
    raw = item.get("type") or item.get("place_type") or ""
    return str(raw).strip().lower()


def _is_retail_maps_listing(item: Dict[str, Any]) -> bool:
    place_type = _maps_place_type(item)
    if place_type in _RETAIL_MAPS_PLACE_TYPES:
        return True
    return place_type.endswith(" store") and "repair" not in place_type


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
    """Rank by proximity to the property; light tie-breakers only (city, rating)."""
    score = 0.0
    addr = (item.get("address") or "").strip().lower()
    coords = _maps_item_coords(item)
    if coords:
        dist = _haversine_miles(anchor_lat, anchor_lng, coords[0], coords[1])
        score += max(0.0, 50.0 - dist * 3.0)
        item["_distance_miles"] = round(dist, 1)
    if city_hint and city_hint in addr:
        score += 5.0
    rating = item.get("rating")
    if isinstance(rating, (int, float)) and rating >= 4.5:
        score += 2.0
    if _is_retail_maps_listing(item):
        score -= 40.0
    return score


def rank_maps_local_results(
    items: List[Dict[str, Any]],
    *,
    anchor_lat: float,
    anchor_lng: float,
    property_address: Optional[str] = None,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    """Sort SerpAPI Maps listings by distance from the search anchor (query defines relevance)."""
    city_hint = _city_hint_from_address(property_address)
    scored: List[Tuple[float, Dict[str, Any]]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        scored.append(
            (_score_maps_item(item, anchor_lat, anchor_lng, city_hint), item)
        )
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


def serp_maps_provider_rows(
    data: Dict[str, Any],
    *,
    search_location: Optional[SearchLocation] = None,
    property_address: Optional[str] = None,
    max_results: int = 10,
) -> List[Dict[str, Any]]:
    """Ranked SerpAPI Google Maps local results as provider objects for clients."""
    local = data.get("local_results")
    if not isinstance(local, list):
        return []

    items = [x for x in local if isinstance(x, dict)]
    if search_location is not None:
        items = rank_maps_local_results(
            items,
            anchor_lat=search_location.coordinates.lat,
            anchor_lng=search_location.coordinates.lng,
            property_address=property_address,
            max_results=max_results,
        )
    else:
        items = items[:max_results]

    rows: List[Dict[str, Any]] = []
    for item in items:
        title = (item.get("title") or item.get("name") or "").strip()
        if not title:
            continue
        row: Dict[str, Any] = {"name": title[:200]}
        addr = (item.get("address") or "").strip()
        if addr:
            row["location"] = addr[:500]
            row["address"] = addr[:500]
        rating = item.get("rating")
        if rating is not None:
            row["rating"] = rating
        reviews = item.get("reviews")
        if reviews is not None:
            row["reviews"] = reviews
        phone = (item.get("phone") or "").strip()
        if phone:
            row["phone"] = phone
            row["contact"] = phone
        dist = item.get("_distance_miles")
        if dist is not None:
            row["distance_miles"] = dist
        place_type = _maps_place_type(item)
        if place_type:
            row["place_type"] = place_type
        rows.append(row)
    return rows


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

    places = [
        _format_maps_item_line(item) for item in items if _format_maps_item_line(item)
    ]
    if places:
        return str(places)
    error = data.get("error")
    if error:
        return f"SerpAPI Maps error: {error}"
    return "No local results found."
