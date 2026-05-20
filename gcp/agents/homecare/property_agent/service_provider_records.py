"""Normalize service-provider payloads for agents, synthesis, and clients."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

VERTEX_GROUNDING_REDIRECT_RE = re.compile(
    r"vertexaisearch\.cloud\.google\.com/grounding-api-redirect",
    re.I,
)
VERTEX_GROUNDING_URL_IN_TEXT_RE = re.compile(
    r"https?://vertexaisearch\.cloud\.google\.com/grounding-api-redirect/\S+",
    re.I,
)
GENERIC_PROVIDER_NAMES = frozenset(
    {
        "provider",
        "search guidance",
        "business",
        "local business",
        "unknown",
    }
)
PHONE_RE = re.compile(r"(?:Phone:\s*)?(\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4})\b")
RATING_RE = re.compile(r"(\d+(?:\.\d+)?)\s*Rating\s*\((\d+)\s*reviews?\)", re.I)
MAPS_RATING_RE = re.compile(r"\brating\s+(\d+(?:\.\d+)?)", re.I)
MAPS_REVIEWS_RE = re.compile(r"\breviews\s+(\d+)", re.I)
DISTANCE_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*mi\b", re.I)


def is_vertex_grounding_redirect_url(value: str) -> bool:
    return bool(VERTEX_GROUNDING_REDIRECT_RE.search(value or ""))


def strip_vertex_grounding_urls(text: str) -> str:
    cleaned = VERTEX_GROUNDING_URL_IN_TEXT_RE.sub("", text or "")
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _pick_string(*values: Any) -> Optional[str]:
    for value in values:
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed:
                return trimmed
    return None


def _has_useful_field(value: Any) -> bool:
    if value is None:
        return False
    s = str(value).strip()
    if not s:
        return False
    lower = s.lower()
    return lower not in {
        "n/a",
        "not available",
        "none",
        "null",
        "no additional information available.",
    }


def _sanitize_url_field(value: Any) -> Optional[str]:
    s = _pick_string(value)
    if not s or is_vertex_grounding_redirect_url(s):
        return None
    return s


def _cleanse_text_field(value: Any) -> Optional[str]:
    s = _pick_string(value)
    if not s:
        return None
    cleaned = strip_vertex_grounding_urls(s)
    if not cleaned or is_vertex_grounding_redirect_url(cleaned):
        return None
    return cleaned


def _is_meaningless_provider_name(name: str) -> bool:
    t = name.strip()
    if not t:
        return True
    if t.lower() in GENERIC_PROVIDER_NAMES:
        return True
    if is_vertex_grounding_redirect_url(t):
        return True
    if re.match(r"^https?://", t, re.I):
        return True
    return False


def is_displayable_service_provider(provider: Any) -> bool:
    if not isinstance(provider, dict):
        return False
    name = _pick_string(
        provider.get("name"),
        provider.get("business_name"),
        provider.get("businessName"),
        provider.get("title"),
        provider.get("company"),
        provider.get("provider"),
        provider.get("store"),
    )
    if not name or _is_meaningless_provider_name(name):
        return False

    contact = _pick_string(
        provider.get("contact_info"),
        provider.get("phone"),
        provider.get("phoneNumber"),
        provider.get("contact"),
        provider.get("contactInfo"),
    )
    location = _pick_string(
        provider.get("location"),
        provider.get("address"),
        provider.get("address_line"),
    )
    ratings = _pick_string(provider.get("ratings"), provider.get("rating"))
    reviews = _pick_string(
        provider.get("reviews"),
        provider.get("review_count"),
        provider.get("reviewCount"),
    )
    distance = provider.get("distance_miles")
    if distance is None:
        distance = provider.get("_distance_miles")
    if distance is None:
        distance = provider.get("distance")
    specialties = _pick_string(provider.get("specialties"), provider.get("services"))
    additional = _cleanse_text_field(
        _pick_string(
            provider.get("additional_information"),
            provider.get("description"),
            provider.get("about"),
        )
    )
    website = _sanitize_url_field(
        _pick_string(provider.get("website"), provider.get("url"), provider.get("link"))
    )
    link = _sanitize_url_field(
        _pick_string(provider.get("link"), provider.get("url"), provider.get("website"))
    )
    directions = _sanitize_url_field(
        _pick_string(
            provider.get("directions"),
            provider.get("directions_url"),
            provider.get("map_link"),
        )
    )

    if _has_useful_field(contact) or _has_useful_field(location) or _has_useful_field(ratings):
        return True
    if _has_useful_field(reviews) or _has_useful_field(specialties):
        return True
    if distance is not None and str(distance).strip():
        return True
    if website or link or directions:
        return True
    if additional and len(additional) <= 240:
        return True
    return (
        len(name) >= 3
        and re.search(r"[a-z]", name, re.I) is not None
        and name.lower() not in GENERIC_PROVIDER_NAMES
    )


def _compact_record(record: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for key, value in record.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        out[key] = value
    return out


def maps_item_to_provider_record(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map a SerpAPI Google Maps local result to the canonical provider object."""
    if not isinstance(item, dict):
        return None
    name = _pick_string(item.get("title"), item.get("name"))
    if not name or _is_meaningless_provider_name(name):
        return None

    record: Dict[str, Any] = {"name": name}
    location = _pick_string(item.get("address"), item.get("location"))
    if location:
        record["location"] = location
    phone = _pick_string(item.get("phone"), item.get("contact_info"))
    if phone:
        record["contact_info"] = phone
    rating = item.get("rating")
    if rating is not None and str(rating).strip():
        record["ratings"] = str(rating)
    reviews = item.get("reviews")
    if reviews is not None and str(reviews).strip():
        record["reviews"] = str(reviews)
    dist = item.get("_distance_miles")
    if dist is None:
        dist = item.get("distance_miles")
    if dist is not None and str(dist).strip():
        record["distance_miles"] = str(dist)
    website = _sanitize_url_field(
        _pick_string(item.get("website"), item.get("link"), item.get("url"))
    )
    if website:
        record["website"] = website
        record["link"] = website
    types = item.get("type") or item.get("types")
    if isinstance(types, str) and types.strip():
        record["specialties"] = types.strip()
    elif isinstance(types, list) and types:
        record["specialties"] = ", ".join(str(t).strip() for t in types[:4] if str(t).strip())

    normalized = normalize_provider_entry(record)
    return normalized


def _provider_from_freeform_line(line: str) -> Optional[Dict[str, Any]]:
    trimmed = line.strip()
    if not trimmed:
        return None
    if is_vertex_grounding_redirect_url(trimmed):
        return None
    if re.match(r"^https?://\S+$", trimmed, re.I):
        return None

    rating_match = RATING_RE.search(trimmed)
    maps_rating_match = MAPS_RATING_RE.search(trimmed)
    maps_reviews_match = MAPS_REVIEWS_RE.search(trimmed)
    distance_match = DISTANCE_RE.search(trimmed)
    phone_match = PHONE_RE.search(trimmed)
    looks_like_listing = bool(
        rating_match or maps_rating_match or phone_match or distance_match
    )
    if not looks_like_listing and len(trimmed) > 120:
        return None

    name = trimmed
    rating_idx = re.search(r"\d+(?:\.\d+)?\s*Rating", trimmed, re.I)
    if rating_idx and rating_idx.start() > 0:
        name = trimmed[: rating_idx.start()].replace(" -", "").strip()
    if not name:
        name = trimmed[:69] + "…" if len(trimmed) > 72 else trimmed

    location_match = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", name)
    location: Optional[str] = None
    if location_match and re.search(r",\s*[A-Za-z]", location_match.group(2)):
        name = location_match.group(1).strip()
        location = location_match.group(2).strip()

    name = strip_vertex_grounding_urls(name)
    if not name or _is_meaningless_provider_name(name):
        return None

    record: Dict[str, Any] = {"name": name}
    if location:
        record["location"] = location
    if rating_match:
        record["ratings"] = rating_match.group(1)
        record["reviews"] = rating_match.group(2)
    elif maps_rating_match:
        record["ratings"] = maps_rating_match.group(1)
        if maps_reviews_match:
            record["reviews"] = maps_reviews_match.group(1)
    if distance_match:
        record["distance_miles"] = distance_match.group(1)
    if phone_match:
        record["contact_info"] = phone_match.group(1).strip()
    return normalize_provider_entry(record)


def normalize_provider_entry(raw: Any) -> Optional[Dict[str, Any]]:
    if raw is None:
        return None
    if isinstance(raw, str):
        trimmed = raw.strip()
        if is_vertex_grounding_redirect_url(trimmed) or re.match(
            r"^https?://\S+$", trimmed, re.I
        ):
            return None
        try:
            parsed = json.loads(trimmed)
            return normalize_provider_entry(parsed)
        except json.JSONDecodeError:
            return _provider_from_freeform_line(trimmed)

    if not isinstance(raw, dict):
        return None

    scrubbed = dict(raw)
    for key in list(scrubbed.keys()):
        val = scrubbed[key]
        if isinstance(val, str):
            cleaned = _cleanse_text_field(val)
            if cleaned is None and key in {
                "website",
                "link",
                "url",
                "directions",
                "directions_url",
                "map_link",
                "additional_information",
                "description",
                "about",
                "name",
                "title",
            }:
                scrubbed.pop(key, None)
            elif cleaned is not None and cleaned != val:
                scrubbed[key] = cleaned

    name = _pick_string(
        scrubbed.get("name"),
        scrubbed.get("business_name"),
        scrubbed.get("businessName"),
        scrubbed.get("title"),
        scrubbed.get("company"),
        scrubbed.get("provider"),
        scrubbed.get("store"),
    )
    if not name:
        alt = _cleanse_text_field(_pick_string(scrubbed.get("snippet"), scrubbed.get("summary")))
        if not alt or _is_meaningless_provider_name(alt):
            return None
        name = alt
    elif _is_meaningless_provider_name(name):
        alt = _cleanse_text_field(_pick_string(scrubbed.get("snippet"), scrubbed.get("summary")))
        if not alt or _is_meaningless_provider_name(alt):
            return None
        name = alt

    record: Dict[str, Any] = {"name": name}
    location = _pick_string(
        scrubbed.get("location"),
        scrubbed.get("address"),
        scrubbed.get("address_line"),
    )
    if location:
        record["location"] = location
    contact = _pick_string(
        scrubbed.get("contact_info"),
        scrubbed.get("phone"),
        scrubbed.get("phoneNumber"),
        scrubbed.get("contact"),
        scrubbed.get("contactInfo"),
    )
    if contact:
        record["contact_info"] = contact
    ratings = _pick_string(scrubbed.get("ratings"), scrubbed.get("rating"))
    if ratings:
        record["ratings"] = ratings
    reviews = _pick_string(
        scrubbed.get("reviews"),
        scrubbed.get("review_count"),
        scrubbed.get("reviewCount"),
    )
    if reviews:
        record["reviews"] = reviews
    dist = scrubbed.get("distance_miles")
    if dist is None:
        dist = scrubbed.get("_distance_miles")
    if dist is None:
        dist = scrubbed.get("distance")
    if dist is not None and str(dist).strip():
        record["distance_miles"] = str(dist)
    specialties = _pick_string(scrubbed.get("specialties"), scrubbed.get("services"))
    if specialties:
        record["specialties"] = specialties
    additional = _cleanse_text_field(
        _pick_string(
            scrubbed.get("additional_information"),
            scrubbed.get("description"),
            scrubbed.get("about"),
        )
    )
    if additional and len(additional) <= 240:
        record["additional_information"] = additional
    website = _sanitize_url_field(
        _pick_string(scrubbed.get("website"), scrubbed.get("url"), scrubbed.get("link"))
    )
    if website:
        record["website"] = website
        record["link"] = website

    if not is_displayable_service_provider(record):
        return None
    return _compact_record(record)


def normalize_provider_list(raw: Any, *, max_items: int = 10) -> List[Dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, str):
        trimmed = raw.strip()
        if is_vertex_grounding_redirect_url(trimmed) or re.match(
            r"^https?://\S+$", trimmed, re.I
        ):
            return []
        try:
            parsed = json.loads(trimmed)
            return normalize_provider_list(parsed, max_items=max_items)
        except json.JSONDecodeError:
            one = _provider_from_freeform_line(trimmed)
            return [one] if one else []

    items: List[Any]
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = []
        for key in ("providers", "results", "items", "pros", "list"):
            inner = raw.get(key)
            if isinstance(inner, list):
                items = inner
                break
        if not items:
            one = normalize_provider_entry(raw)
            return [one] if one else []
    else:
        return []

    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for item in items:
        rec = normalize_provider_entry(item)
        if not rec:
            continue
        dedupe_key = "|".join(
            (
                rec.get("name", "").lower(),
                rec.get("contact_info", "").lower(),
                rec.get("location", "").lower(),
            )
        )
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        out.append(rec)
        if len(out) >= max_items:
            break
    return out


def normalize_local_pros(local_pros: Any, *, max_items: int = 10) -> Dict[str, Any]:
    base = local_pros if isinstance(local_pros, dict) else {}
    return {
        "serpAPIResults": normalize_provider_list(
            base.get("serpAPIResults"), max_items=max_items
        ),
        "googleSearchResults": normalize_provider_list(
            base.get("googleSearchResults"), max_items=max_items
        ),
    }


def normalize_service_results(service_results: Any, *, max_items: int = 10) -> Dict[str, Any]:
    if not isinstance(service_results, dict):
        return {"localPros": normalize_local_pros(None, max_items=max_items)}
    local = service_results.get("localPros")
    normalized = {"localPros": normalize_local_pros(local, max_items=max_items)}
    for key, value in service_results.items():
        if key != "localPros":
            normalized[key] = value
    return normalized


__all__ = [
    "is_vertex_grounding_redirect_url",
    "strip_vertex_grounding_urls",
    "is_displayable_service_provider",
    "maps_item_to_provider_record",
    "normalize_provider_entry",
    "normalize_provider_list",
    "normalize_local_pros",
    "normalize_service_results",
]
