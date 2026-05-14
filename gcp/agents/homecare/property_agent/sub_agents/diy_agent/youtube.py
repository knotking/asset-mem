"""YouTube search helper for DIY flows (shared by agent and orchestrator)."""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Dict, List

import requests

logger = logging.getLogger(__name__)

_YOUTUBE_DATA_API_SEARCH = "https://www.googleapis.com/youtube/v3/search"
_REQUEST_TIMEOUT_S = 15


def _youtube_search_data_api(query: str, max_results: int, api_key: str) -> List[Dict[str, Any]]:
    """YouTube Data API v3 search (requires API key + quota)."""
    try:
        resp = requests.get(
            _YOUTUBE_DATA_API_SEARCH,
            params={
                "part": "snippet",
                "type": "video",
                "maxResults": max_results,
                "q": query,
                "key": api_key,
            },
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
        logger.warning("YouTube Data API error payload for query=%r: %s", query, body.get("error"))
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


def youtube_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Searches YouTube videos using plain text query input via YouTube Data API v3.

    Requires ``YOUTUBE_API_KEY``. Returns an empty list when the key is missing.
    """
    t0 = time.monotonic()

    def _elapsed_ms() -> int:
        return int((time.monotonic() - t0) * 1000)

    if not query or not query.strip():
        logger.debug("youtube_search: empty query, returning 0 videos")
        return []

    safe_max_results = max(1, min(int(max_results), 10))
    q = query.strip()

    api_key = (os.getenv("YOUTUBE_API_KEY") or "").strip()
    if not api_key:
        logger.warning(
            "youtube_search: YOUTUBE_API_KEY is not set; skipping search (query_len=%d)",
            len(q),
        )
        return []

    logger.debug("youtube_search: query=%r", q)
    out = _youtube_search_data_api(q, safe_max_results, api_key)
    logger.info(
        "youtube_search: max_results=%d query_len=%d videos=%d duration_ms=%d",
        safe_max_results,
        len(q),
        len(out),
        _elapsed_ms(),
    )
    logger.debug(
        "youtube_search: full_results=%s",
        json.dumps(out, ensure_ascii=False),
    )
    return out
