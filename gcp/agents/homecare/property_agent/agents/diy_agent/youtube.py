"""YouTube search helper for DIY flows (shared by agent and orchestrator)."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import requests

from property_agent.shared.inputs import SearchLocation
from property_agent.geo.youtube_geo import youtube_geo_params
from property_agent.agents.diy_agent.youtube_relevance import rank_youtube_videos_by_stem

logger = logging.getLogger(__name__)

_YOUTUBE_OVERFETCH_MAX = 15
_YOUTUBE_BACKEND_ENV = "DIY_YOUTUBE_SEARCH_BACKEND"

_YOUTUBE_DATA_API_SEARCH = "https://www.googleapis.com/youtube/v3/search"
_REQUEST_TIMEOUT_S = 15


def _normalize_serpapi_video_row(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Map SerpAPI ``video_results`` row to DIY ``youtubeSearch.videos`` shape."""
    if not isinstance(row, dict):
        return None
    link = str(row.get("link") or "").strip()
    if not link:
        return None
    title = str(row.get("title") or "").strip()
    description = str(row.get("description") or "").strip()
    if not description:
        channel = row.get("channel")
        if isinstance(channel, dict):
            description = str(channel.get("name") or "").strip()
    duration = str(row.get("length") or "").strip()
    return {
        "title": title,
        "url": link,
        "description": description,
        "duration": duration,
    }


def _youtube_search_serpapi(
    query: str,
    max_results: int,
    search_location: Optional[SearchLocation] = None,
) -> List[Dict[str, Any]]:
    """SerpAPI ``engine=youtube`` search (uses ``SERP_API_KEY``)."""
    import serpapi

    api_key = (os.getenv("SERP_API_KEY") or "").strip()
    if not api_key:
        return []

    _ = search_location  # YouTube engine uses gl/hl only (no Maps-style location).
    params: Dict[str, Any] = {
        "engine": "youtube",
        "search_query": query,
        "api_key": api_key,
        "gl": "us",
        "hl": "en",
    }

    try:
        search_results = serpapi.GoogleSearch(params).get_dict()
    except Exception:
        logger.exception("SerpAPI YouTube request failed for query: %s", query)
        return []

    if isinstance(search_results, dict) and search_results.get("error"):
        logger.warning(
            "SerpAPI YouTube error for query=%r: %s",
            query,
            search_results.get("error"),
        )
        return []

    rows = (
        search_results.get("video_results")
        if isinstance(search_results, dict)
        else None
    )
    if not isinstance(rows, list):
        logger.debug("SerpAPI YouTube: no video_results for query=%r", query)
        return []

    normalized: List[Dict[str, Any]] = []
    for row in rows:
        item = _normalize_serpapi_video_row(row)
        if item is None:
            continue
        normalized.append(item)
        if len(normalized) >= max_results:
            break
    return normalized


def _youtube_search_data_api(
    query: str,
    max_results: int,
    api_key: str,
    search_location: Optional[SearchLocation] = None,
) -> List[Dict[str, Any]]:
    """YouTube Data API v3 search (requires API key + quota)."""
    params: Dict[str, Any] = {
        "part": "snippet",
        "type": "video",
        "maxResults": max_results,
        "q": query,
        "key": api_key,
    }
    params.update(youtube_geo_params(search_location))
    try:
        resp = requests.get(
            _YOUTUBE_DATA_API_SEARCH,
            params=params,
            timeout=_REQUEST_TIMEOUT_S,
        )
    except requests.RequestException:
        logger.exception("YouTube Data API request failed for query: %s", query)
        return []

    if not resp.ok:
        logger.warning(
            "YouTube Data API HTTP %s for query=%r body=%s",
            resp.status_code,
            query,
            (resp.text or "")[:500],
        )
        return []

    try:
        body = resp.json()
    except ValueError:
        logger.warning("YouTube Data API returned non-JSON for query=%r", query)
        return []

    if isinstance(body, dict) and body.get("error"):
        logger.warning(
            "YouTube Data API error payload for query=%r: %s", query, body.get("error")
        )
        return []

    items = body.get("items") if isinstance(body, dict) else None
    if not isinstance(items, list):
        logger.debug(
            "YouTube Data API: no items list (items_type=%s query=%r)",
            type(items).__name__,
            query,
        )
        return []

    normalized: List[Dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        vid = item.get("id")
        if not isinstance(vid, dict) or vid.get("kind") != "youtube#video":
            continue
        video_id = vid.get("videoId")
        if not isinstance(video_id, str) or not video_id.strip():
            continue
        snip = item.get("snippet")
        if not isinstance(snip, dict):
            snip = {}
        title = (snip.get("title") or "") or ""
        description = (snip.get("description") or "") or ""
        channel_title = (snip.get("channelTitle") or "") or ""
        if not description and channel_title:
            description = channel_title
        normalized.append(
            {
                "title": title,
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "description": description,
                "duration": "",
            }
        )
    if not normalized and items:
        kinds: List[str] = []
        for item in items[:10]:
            if isinstance(item, dict):
                vid = item.get("id")
                if isinstance(vid, dict):
                    kinds.append(str(vid.get("kind", "")))
        logger.debug(
            "YouTube Data API: %d item(s) but none usable as youtube#video (kinds=%s query=%r)",
            len(items),
            kinds or ["(none)"],
            query,
        )
    elif not normalized:
        page = body.get("pageInfo") if isinstance(body, dict) else None
        total = page.get("totalResults") if isinstance(page, dict) else None
        logger.debug(
            "YouTube Data API: zero videos (items=0 totalResults=%s query=%r)",
            total,
            query,
        )
    return normalized


def _youtube_backend_preference() -> str:
    """
    ``DIY_YOUTUBE_SEARCH_BACKEND``: ``data_api`` | ``serpapi`` | ``auto`` (default).

    * ``data_api`` — YouTube Data API v3 first (``YOUTUBE_API_KEY``), SerpAPI fallback
    * ``serpapi`` / ``auto`` — SerpAPI first (``SERP_API_KEY``), Data API fallback
    """
    raw = (os.getenv(_YOUTUBE_BACKEND_ENV) or "auto").strip().casefold()
    if raw in ("data_api", "data-api", "youtube", "youtube_data_api", "auto"):
        return "data_api"
    if raw in ("serpapi", "serp", ""):
        return "serpapi"
    logger.warning(
        "youtube_search: unknown %s=%r; using serpapi-first",
        _YOUTUBE_BACKEND_ENV,
        raw,
    )
    return "serpapi"


def _youtube_backend_attempt_order(preference: str) -> List[str]:
    if preference == "data_api":
        return ["data_api", "serpapi"]
    return ["serpapi", "data_api"]


def _fetch_youtube_via_backend(
    backend: str,
    query: str,
    fetch_count: int,
    search_location: Optional[SearchLocation],
) -> List[Dict[str, Any]]:
    if backend == "data_api":
        api_key = (os.getenv("YOUTUBE_API_KEY") or "").strip()
        if not api_key:
            return []
        return _youtube_search_data_api(query, fetch_count, api_key, search_location)
    if backend == "serpapi":
        if not (os.getenv("SERP_API_KEY") or "").strip():
            return []
        return _youtube_search_serpapi(query, fetch_count, search_location)
    return []


def youtube_search(
    query: str,
    max_results: int = 5,
    search_location: Optional[SearchLocation] = None,
    *,
    relevance_stem: Optional[str] = None,
    rank_search_query: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Search YouTube tutorials for DIY flows.

    Backend order is controlled by ``DIY_YOUTUBE_SEARCH_BACKEND``:

    * ``data_api`` — YouTube Data API v3 first (``YOUTUBE_API_KEY``), SerpAPI fallback
    * ``serpapi`` / ``auto`` (default) — SerpAPI first, Data API fallback

    When ``relevance_stem`` is set, over-fetches candidates then re-ranks by token
    overlap with the stem/query (demotes off-topic results without domain blocklists).
    """
    t0 = time.monotonic()

    def _elapsed_ms() -> int:
        return int((time.monotonic() - t0) * 1000)

    if not query or not query.strip():
        logger.debug("youtube_search: empty query, returning 0 videos")
        return []

    safe_max_results = max(1, min(int(max_results), 10))
    q = query.strip()
    stem = (relevance_stem or "").strip()
    fetch_count = safe_max_results
    if stem:
        fetch_count = min(
            _YOUTUBE_OVERFETCH_MAX,
            max(safe_max_results * 3, 10),
        )

    def _maybe_rank(videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not stem or not videos:
            return videos[:safe_max_results]
        return rank_youtube_videos_by_stem(
            videos,
            stem,
            search_query=rank_search_query or q,
            max_results=safe_max_results,
        )

    preference = _youtube_backend_preference()
    order = _youtube_backend_attempt_order(preference)
    serp_key = (os.getenv("SERP_API_KEY") or "").strip()
    yt_key = (os.getenv("YOUTUBE_API_KEY") or "").strip()
    if not serp_key and not yt_key:
        logger.warning(
            "youtube_search: no SERP_API_KEY or YOUTUBE_API_KEY; skipping search (query_len=%d)",
            len(q),
        )
        return []

    for backend in order:
        if backend == "serpapi" and not serp_key:
            continue
        if backend == "data_api" and not yt_key:
            continue
        raw = _fetch_youtube_via_backend(backend, q, fetch_count, search_location)
        out = _maybe_rank(raw)
        geo = bool(youtube_geo_params(search_location)) if backend == "data_api" else False
        logger.info(
            "youtube_search: backend=%s preference=%s max_results=%d fetch=%d "
            "query_len=%d videos=%d ranked=%s duration_ms=%d geo=%s",
            backend,
            preference,
            safe_max_results,
            fetch_count,
            len(q),
            len(out),
            bool(stem),
            _elapsed_ms(),
            geo,
        )
        logger.debug(
            "youtube_search: full_results=%s",
            json.dumps(out, ensure_ascii=False),
        )
        if out:
            return out
        logger.info(
            "youtube_search: %s returned 0 videos; trying next backend",
            backend,
        )

    logger.warning(
        "youtube_search: all backends exhausted preference=%s query_len=%d",
        preference,
        len(q),
    )
    return []
