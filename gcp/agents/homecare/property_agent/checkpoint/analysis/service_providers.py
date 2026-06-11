"""Structured SerpAPI Maps providers for the checkpoint service branch."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from property_agent.agents.service_agent.agent import fetch_serpapi_maps_providers
from property_agent.geo.address_parse import (
    _US_STATE_FULL,
    _city_state_from_us_address,
    city_region_from_us_address,
    looks_like_coordinate_pair,
)
from property_agent.geo.search_location_utils import market_label, parse_search_location

logger = logging.getLogger(__name__)

_NON_LOCAL_LOCATION_MARKERS = (
    "nationwide",
    "check website",
    "visit website",
    "1,800",
    "1800",
)


def service_maps_search_query(payload: Dict[str, Any]) -> str:
    """Trade-focused SerpAPI query for checkpoint service branch."""
    for key in ("checkpoint_service_trade_query", "checkpoint_retrieval_search_query"):
        raw = payload.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return (payload.get("user_query") or "").strip()


def market_region_label(
    *,
    property_address: Optional[str] = None,
    search_location: Any = None,
) -> Optional[str]:
    """City-level market string for web search locality (e.g. ``Brentwood, CA 94513``)."""
    pa = (property_address or "").strip() or None
    if pa:
        region = city_region_from_us_address(pa)
        if region:
            return region
    sl = parse_search_location(search_location)
    label = (market_label(sl, property_address=pa) or "").strip() or None
    if not label or looks_like_coordinate_pair(label):
        return None
    return city_region_from_us_address(label) or label


def local_google_search_query(
    *,
    trade_query: str,
    property_address: Optional[str] = None,
    search_location: Any = None,
) -> str:
    """Build a locality-aware web query when SerpAPI Maps is unavailable."""
    trade = (trade_query or "").strip() or "local repair professionals"
    market = market_region_label(
        property_address=property_address,
        search_location=search_location,
    )
    if market:
        return f"{trade} near {market}"
    return f"{trade} local repair professionals near me"


def local_google_search_query_from_payload(payload: Dict[str, Any]) -> str:
    return local_google_search_query(
        trade_query=service_maps_search_query(payload),
        property_address=(payload.get("property_address") or None),
        search_location=payload.get("search_location"),
    )


def local_google_search_query_from_tool_state(state: Any) -> Optional[str]:
    if state is None or not hasattr(state, "get"):
        return None
    cached = state.get("checkpoint_google_search_query")
    if isinstance(cached, str) and cached.strip():
        return cached.strip()
    trade = None
    for key in ("checkpoint_service_trade_query", "checkpoint_retrieval_search_query"):
        raw = state.get(key)
        if isinstance(raw, str) and raw.strip():
            trade = raw.strip()
            break
    if not trade:
        return None
    pa = state.get("property_address")
    property_address = pa.strip() if isinstance(pa, str) and pa.strip() else None
    return local_google_search_query(
        trade_query=trade,
        property_address=property_address,
        search_location=state.get("search_location"),
    )


def prefetch_service_maps_providers(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Ranked Maps provider rows; empty when query/location unavailable."""
    query = service_maps_search_query(payload)
    if not query:
        return []
    rows = fetch_serpapi_maps_providers(
        query,
        payload.get("search_location"),
        property_address=payload.get("property_address"),
    )
    if rows:
        logger.info(
            "service branch prefetch: maps providers=%d q_len=%d",
            len(rows),
            len(query),
        )
    return rows


def seed_service_branch_tool_state(
    tool_context: Any, payload: Dict[str, Any], *, prefetched: Optional[List[Dict[str, Any]]] = None
) -> None:
    """Expose branch search hints on session state for nested service_agent tools."""
    state = getattr(tool_context, "state", None)
    if state is None or not hasattr(state, "__setitem__"):
        return
    for key in (
        "checkpoint_service_trade_query",
        "checkpoint_retrieval_search_query",
        "checkpoint_google_search_query",
        "search_location",
        "property_address",
    ):
        val = payload.get(key)
        if val is not None:
            state[key] = val
    google_q = local_google_search_query_from_payload(payload)
    if google_q:
        state["checkpoint_google_search_query"] = google_q
    if prefetched:
        state["checkpoint_prefetched_serp_providers"] = prefetched


def provider_matches_property_market(
    row: Dict[str, Any],
    property_address: Optional[str],
) -> bool:
    """Reject obvious non-local google_search rows when property market is known."""
    if not property_address or not isinstance(row, dict):
        return True

    distance = row.get("distance_miles")
    if distance is not None:
        try:
            if float(distance) >= 0:
                return True
        except (TypeError, ValueError):
            pass

    location = str(row.get("location") or row.get("address") or "").strip().lower()
    if not location:
        return False

    if any(marker in location for marker in _NON_LOCAL_LOCATION_MARKERS):
        return False

    city, state_abbr = _city_state_from_us_address(property_address)
    city_hint = (city or "").strip().lower()
    state_abbr = (state_abbr or "").strip().upper()
    state_full = _US_STATE_FULL.get(state_abbr, "").lower()

    if city_hint and city_hint in location:
        return True
    if state_abbr and (
        f", {state_abbr.lower()}" in location
        or f" {state_abbr.lower()} " in f" {location} "
        or location.endswith(f" {state_abbr.lower()}")
    ):
        return True
    if state_full and state_full in location:
        return True
    return False


def filter_providers_by_property_market(
    rows: List[Dict[str, Any]],
    property_address: Optional[str],
) -> List[Dict[str, Any]]:
    if not property_address:
        return rows
    kept = [row for row in rows if provider_matches_property_market(row, property_address)]
    dropped = len(rows) - len(kept)
    if dropped:
        logger.info(
            "service providers: filtered non-local google rows dropped=%d kept=%d",
            dropped,
            len(kept),
        )
    return kept


def apply_prefetched_serp_to_branch_result(
    result_str: str,
    prefetched: List[Dict[str, Any]],
) -> str:
    """Replace LLM Serp/google blobs with deterministic Maps rows when prefetch succeeded."""
    if not prefetched:
        return result_str
    text = (result_str or "").strip()
    if not text or text == "SKIPPED" or text.startswith("SKIPPED:"):
        return result_str
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        return result_str
    if not isinstance(obj, dict):
        return result_str

    service = obj.get("serviceResults")
    if not isinstance(service, dict):
        service = {}
        obj["serviceResults"] = service
    local = service.get("localPros")
    if not isinstance(local, dict):
        local = {}
        service["localPros"] = local

    local["serpAPIResults"] = prefetched
    local["googleSearchResults"] = []
    service.pop("searchStatus", None)
    service.pop("searchError", None)
    return json.dumps(obj, ensure_ascii=False)
