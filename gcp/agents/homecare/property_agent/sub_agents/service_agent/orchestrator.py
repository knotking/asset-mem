"""Structured local service-provider pipeline (SerpAPI Google Maps, no LLM reformatting)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional

from dotenv import load_dotenv

from ...agent_inputs import SearchLocation
from ...search_location_utils import legacy_search_location_from_payload, market_label
from ...serpapi_geo import (
    build_maps_provider_records,
    enrich_search_location_label,
    maps_lat_lon_params,
    merge_search_location_sources,
    strip_embedded_geo_from_query,
)
from ...service_provider_records import normalize_service_results

logger = logging.getLogger(__name__)
load_dotenv()


def _serpapi_api_key() -> Optional[str]:
    return (os.environ.get("SERP_API_KEY") or "").strip() or None


def _service_search_query(
    user_query: str,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> str:
    seed = (checkpoint_retrieval_search_query or "").strip()
    branch_q = (user_query or "").strip()
    if seed and branch_q:
        return f"{branch_q} — {seed}"[:500]
    return seed or branch_q or "home repair service"


def _fetch_maps_provider_records(
    query: str,
    search_location: SearchLocation,
    property_address: Optional[str] = None,
    *,
    max_results: int = 10,
) -> list[Dict[str, Any]]:
    import serpapi

    api_key = _serpapi_api_key()
    if not api_key:
        logger.warning("run_service_pipeline: missing SERP_API_KEY")
        return []

    clean_q = strip_embedded_geo_from_query(query) or (query or "").strip()
    if not clean_q:
        clean_q = "home repair service"

    sl = enrich_search_location_label(search_location, property_address)
    if sl is None:
        logger.warning("run_service_pipeline: could not enrich search_location")
        return []

    params: Dict[str, Any] = {
        "engine": "google_maps",
        "type": "search",
        "q": clean_q,
        "api_key": api_key,
        "hl": "en",
    }
    params.update(maps_lat_lon_params(sl))
    logger.info(
        "run_service_pipeline: google_maps q_len=%d lat=%.4f lon=%.4f source=%s",
        len(clean_q),
        sl.coordinates.lat,
        sl.coordinates.lng,
        sl.source,
    )
    data = serpapi.GoogleSearch(params).get_dict()
    return build_maps_provider_records(
        data,
        search_location=sl,
        property_address=property_address,
        max_results=max_results,
    )


def run_service_pipeline_sync(
    user_query: str,
    property_address: Optional[str] = None,
    search_location: Optional[SearchLocation] = None,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> str:
    """Return JSON: {"serviceResults": {"localPros": {serpAPIResults, googleSearchResults}}}."""
    t0 = time.monotonic()
    query = _service_search_query(user_query, checkpoint_retrieval_search_query)
    sl = merge_search_location_sources(search_location)
    pa = (property_address or "").strip() or None

    serp_results: list[Dict[str, Any]] = []
    if sl is not None:
        serp_results = _fetch_maps_provider_records(query, sl, pa)
    else:
        label = market_label(None, property_address=pa)
        logger.warning(
            "run_service_pipeline: no coordinates; skipped maps search label=%r",
            label,
        )

    payload = normalize_service_results(
        {
            "localPros": {
                "serpAPIResults": serp_results,
                "googleSearchResults": [],
            }
        }
    )
    out = json.dumps({"serviceResults": payload}, ensure_ascii=False)
    logger.info(
        "run_service_pipeline: providers=%d duration_ms=%d query_len=%d",
        len(payload.get("localPros", {}).get("serpAPIResults") or []),
        int((time.monotonic() - t0) * 1000),
        len(query),
    )
    return out


async def run_service_pipeline(
    user_query: str,
    property_address: Optional[str] = None,
    search_location: Optional[SearchLocation] = None,
    checkpoint_retrieval_search_query: Optional[str] = None,
) -> str:
    """Async ADK tool entrypoint."""
    return await asyncio.to_thread(
        run_service_pipeline_sync,
        user_query,
        property_address,
        search_location,
        checkpoint_retrieval_search_query,
    )


def run_service_pipeline_from_payload(payload: Dict[str, Any]) -> str:
    """Checkpoint parallel-runner entry (dict payload from optional-agent orchestration)."""
    sl = legacy_search_location_from_payload(payload)
    seed = (payload.get("checkpoint_retrieval_search_query") or "").strip() or None
    return run_service_pipeline_sync(
        (payload.get("user_query") or "").strip(),
        property_address=(payload.get("property_address") or "").strip() or None,
        search_location=sl,
        checkpoint_retrieval_search_query=seed,
    )


__all__ = [
    "run_service_pipeline",
    "run_service_pipeline_sync",
    "run_service_pipeline_from_payload",
]
