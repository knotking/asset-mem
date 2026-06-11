import logging
import os
from typing import Any, Dict, Optional

from google.adk.agents import Agent
from google.adk.tools import ToolContext, google_search
from dotenv import load_dotenv
from .prompts import service_agent_instructions
from property_agent.shared.inputs import DocsInput, SearchLocation
from ...model_config import GLOBAL_GEMINI_MODEL
from agent_framework.execution.thread_context import to_thread
from property_agent.geo.address_parse import (
    enrich_search_location_label,
    merge_search_location_sources,
    strip_embedded_geo_from_query,
)
from property_agent.geo.maps_results import (
    format_google_maps_results,
    maps_lat_lon_params,
    serp_maps_provider_rows,
)

logger = logging.getLogger(__name__)
load_dotenv()

_SERPAPI_FAILURE_MARKERS = (
    "SerpAPI Maps error:",
    "Service provider search not available",
)


def _retrieval_search_stem_from_context(
    tool_context: Optional[ToolContext], *, fallback_query: str
) -> str:
    stem = (fallback_query or "").strip()
    if tool_context is None:
        return stem
    state = getattr(tool_context, "state", None)
    if state is None or not hasattr(state, "get"):
        return stem
    sq = state.get("checkpoint_retrieval_search_query")
    if isinstance(sq, str) and sq.strip():
        return sq.strip()
    return stem


def _append_serpapi_fallback_hint(
    result: str, *, query: str, tool_context: Optional[ToolContext]
) -> str:
    if not any(marker in result for marker in _SERPAPI_FAILURE_MARKERS):
        return result
    state = tool_context.state if tool_context is not None else None
    from property_agent.checkpoint.analysis.service_providers import (
        local_google_search_query_from_tool_state,
    )

    google_q = local_google_search_query_from_tool_state(state)
    if not google_q:
        stem = _retrieval_search_stem_from_context(tool_context, fallback_query=query)
        if not stem:
            return result
        google_q = f"{stem} local repair professionals near me"
    return (
        f"{result}\n\n"
        "SERPAPI_FALLBACK_HINT: SerpAPI Maps failed. Call google_search using ONLY this "
        f'exact query: "{google_q}". '
        "Do NOT search for home inspection, property checkpoint audits, lease compliance, "
        "or generic property maintenance unless user_query explicitly requests those."
    )


def _serpapi_api_key() -> Optional[str]:
    return (os.environ.get("SERP_API_KEY") or "").strip() or None


def _resolve_search_location_from_property_address(
    property_address: str,
    state_sl: Any,
) -> Optional[SearchLocation]:
    """City-level coords via SerpAPI when proxy did not geocode property_address."""
    from property_agent.geo.serpapi_locations import search_location_from_property_address

    radius = 5
    if isinstance(state_sl, dict):
        raw_radius = state_sl.get("radius_miles")
        if isinstance(raw_radius, int):
            radius = raw_radius
    try:
        return search_location_from_property_address(
            property_address,
            radius_miles=radius,
        )
    except Exception as exc:
        logger.debug(
            "serpapi_search: property_address serpapi fallback failed: %s", exc
        )
        return None


def fetch_serpapi_maps_providers(
    query: str,
    search_location_raw: Any,
    property_address: Optional[str] = None,
) -> list[Dict[str, Any]]:
    """SerpAPI Google Maps as provider row objects; empty list on failure."""
    import serpapi

    api_key = _serpapi_api_key()
    if not api_key:
        return []

    if isinstance(search_location_raw, SearchLocation):
        search_location: SearchLocation | None = search_location_raw
    else:
        search_location = merge_search_location_sources(search_location_raw)

    clean_q = strip_embedded_geo_from_query(query) or (query or "").strip()
    if not clean_q:
        clean_q = "home repair service"

    if search_location is None:
        return []

    search_location = enrich_search_location_label(search_location, property_address)
    if search_location is None:
        return []

    params: Dict[str, Any] = {
        "engine": "google_maps",
        "type": "search",
        "q": clean_q,
        "api_key": api_key,
        "hl": "en",
    }
    params.update(maps_lat_lon_params(search_location))
    try:
        data = serpapi.GoogleSearch(params).get_dict()
    except Exception as exc:
        logger.warning(
            "fetch_serpapi_maps_providers failed (%s: %s)",
            type(exc).__name__,
            exc,
        )
        return []
    return serp_maps_provider_rows(
        data,
        search_location=search_location,
        property_address=property_address,
    )


def _run_serpapi_maps_search(
    query: str,
    search_location_raw: Any,
    property_address: Optional[str] = None,
) -> str:
    import serpapi

    api_key = _serpapi_api_key()
    if not api_key:
        return "Service provider search not available (missing API key)."

    if isinstance(search_location_raw, SearchLocation):
        search_location: SearchLocation | None = search_location_raw
    else:
        search_location = merge_search_location_sources(search_location_raw)

    clean_q = strip_embedded_geo_from_query(query) or (query or "").strip()
    if not clean_q:
        clean_q = "home repair service"

    if search_location is None:
        logger.warning(
            "serpapi_search: google_maps called without resolvable search_location"
        )
        return "Service provider search not available (missing location)."

    search_location = enrich_search_location_label(search_location, property_address)
    if search_location is None:
        return "Service provider search not available (missing location)."

    params: Dict[str, Any] = {
        "engine": "google_maps",
        "type": "search",
        "q": clean_q,
        "api_key": api_key,
        "hl": "en",
    }
    params.update(maps_lat_lon_params(search_location))
    logger.info(
        "serpapi_search: google_maps q=%r q_len=%d lat=%.4f lon=%.4f z=%s nearby=true source=%s",
        clean_q[:120],
        len(clean_q),
        search_location.coordinates.lat,
        search_location.coordinates.lng,
        params.get("z"),
        search_location.source,
    )

    data = serpapi.GoogleSearch(params).get_dict()
    return format_google_maps_results(
        data,
        search_location=search_location,
        property_address=property_address,
    )


def _run_serpapi_web_fallback(query: str) -> str:
    """Generic Google web search when no coordinates are available."""
    from langchain_community.utilities import SerpAPIWrapper

    api_key = _serpapi_api_key()
    if not api_key:
        return "Service provider search not available (missing API key)."
    wrapper = SerpAPIWrapper(serpapi_api_key=api_key)
    return wrapper.run(query)


def _resolve_maps_search_query(
    query: str,
    tool_context: ToolContext | None,
) -> str:
    """Prefer checkpoint trade/stem queries over LLM-supplied SerpAPI text."""
    if tool_context is not None:
        state = getattr(tool_context, "state", None)
        if state is not None and hasattr(state, "get"):
            trade = state.get("checkpoint_service_trade_query")
            if isinstance(trade, str) and trade.strip():
                return trade.strip()
            stem = state.get("checkpoint_retrieval_search_query")
            if isinstance(stem, str) and stem.strip():
                return stem.strip()
    return strip_embedded_geo_from_query(query) or (query or "").strip()


async def serpapi_search(
    query: str,
    search_location: Optional[dict] = None,
    tool_context: ToolContext | None = None,
) -> str:
    """Search local service providers via SerpAPI Google Maps (structured geo when available)."""
    state_sl: Any = None
    property_address: Optional[str] = None
    if tool_context is not None:
        state = getattr(tool_context, "state", None)
        if state is not None and hasattr(state, "get"):
            state_sl = state.get("search_location")
            pa = state.get("property_address")
            if isinstance(pa, str) and pa.strip():
                property_address = pa.strip()

    resolved = merge_search_location_sources(search_location, state_sl)
    if resolved is None and property_address:
        resolved = await to_thread(
            _resolve_search_location_from_property_address,
            property_address,
            state_sl,
        )
    maps_query = _resolve_maps_search_query(query, tool_context)
    if resolved is not None:
        maps_result = await to_thread(
            _run_serpapi_maps_search, maps_query, resolved, property_address
        )
        return _append_serpapi_fallback_hint(
            maps_result, query=maps_query, tool_context=tool_context
        )

    q = maps_query
    if not q:
        return "Service provider search not available (empty query)."
    logger.info("serpapi_search: web fallback q_len=%d (no coordinates)", len(q))
    web_result = await to_thread(_run_serpapi_web_fallback, q)
    return _append_serpapi_fallback_hint(
        web_result, query=query, tool_context=tool_context
    )


service_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="service_agent",
    description="Provides professional service recommendations, cost estimates, and service provider information.",
    instruction=service_agent_instructions(),
    tools=[
        serpapi_search,
        google_search,
    ],
    input_schema=DocsInput,
)

# ADK AgentEvaluator expects ``root_agent`` on ``*.agent`` modules.
root_agent = service_agent

__all__ = [
    "service_agent",
    "root_agent",
    "serpapi_search",
    "fetch_serpapi_maps_providers",
]
