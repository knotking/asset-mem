"""YouTube search helper for DIY flows (shared by agent and orchestrator)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List

import requests
from youtubesearchpython import VideosSearch

logger = logging.getLogger(__name__)

_YOUTUBE_DATA_API_SEARCH = "https://www.googleapis.com/youtube/v3/search"
_REQUEST_TIMEOUT_S = 15


def _snippet_to_text(snippet: object) -> str:
    if not snippet:
        return ""
    if isinstance(snippet, str):
        return snippet
    if isinstance(snippet, list):
        parts: List[str] = []
        for seg in snippet:
            if isinstance(seg, dict) and "text" in seg:
                parts.append(str(seg.get("text", "")))
            elif isinstance(seg, str):
                parts.append(seg)
        return "".join(parts)
    return ""


def _youtube_search_data_api(query: str, max_results: int, api_key: str) -> List[Dict[str, Any]]:
    """Official YouTube Data API v3 search (reliable from GCP; requires API key + quota)."""
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
        logger.info(
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
        logger.info(
            "YouTube Data API: %d item(s) but none usable as youtube#video (kinds=%s query=%r)",
            len(items),
            kinds or ["(none)"],
            query,
        )
    elif not normalized:
        page = body.get("pageInfo") if isinstance(body, dict) else None
        total = page.get("totalResults") if isinstance(page, dict) else None
        logger.info(
            "YouTube Data API: zero videos (items=0 totalResults=%s query=%r)",
            total,
            query,
        )
    return normalized


def _youtube_search_innertube(query: str, max_results: int) -> List[Dict[str, Any]]:
    """Legacy path via yt-search-python / InnerTube (often 403 from cloud IPs)."""
    try:
        payload = VideosSearch(query, limit=max_results).result()
    except Exception:
        logger.exception("YouTube InnerTube search failed for query: %s", query)
        return []

    raw_list = payload.get("result") if isinstance(payload, dict) else None
    if not isinstance(raw_list, list):
        logger.info(
            "YouTube InnerTube: unexpected payload (result_type=%s query=%r)",
            type(raw_list).__name__,
            query,
        )
        return []

    if not raw_list:
        logger.info("YouTube InnerTube: empty result list (query=%r)", query)
        return []

    normalized_results: List[Dict[str, Any]] = []
    for item in raw_list:
        if not isinstance(item, dict) or item.get("type") != "video":
            continue
        title = item.get("title", "") or ""
        url = item.get("link", "") or ""
        description = _snippet_to_text(item.get("descriptionSnippet"))
        channel = item.get("channel")
        if not description and isinstance(channel, dict):
            description = channel.get("name", "") or ""
        normalized_results.append(
            {
                "title": title,
                "url": url,
                "description": description,
                "duration": item.get("duration", "") or "",
            }
        )
    if not normalized_results and raw_list:
        types = [str(x.get("type")) for x in raw_list if isinstance(x, dict)][:8]
        logger.info(
            "YouTube InnerTube: %d raw row(s) but none type=video (types=%s query=%r)",
            len(raw_list),
            types or ["(none)"],
            query,
        )
    return normalized_results


def youtube_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Searches YouTube videos using plain text query input.

    When ``YOUTUBE_API_KEY`` is set, uses YouTube Data API v3 (recommended for
    Vertex / server environments). Otherwise falls back to InnerTube via
    ``yt-search-python``, which is often blocked with HTTP 403 from datacenter IPs.
    """
    if not query or not query.strip():
        logger.info("youtube_search: empty query, returning 0 videos")
        return []

    safe_max_results = max(1, min(int(max_results), 10))
    q = query.strip()

    api_key = (os.getenv("YOUTUBE_API_KEY") or "").strip()
    if api_key:
        logger.info(
            "youtube_search: path=data_api max_results=%d query=%r",
            safe_max_results,
            q,
        )
        out = _youtube_search_data_api(q, safe_max_results, api_key)
        logger.debug(
            "youtube_search: data_api done videos=%d full_results=%s",
            len(out),
            json.dumps(out, ensure_ascii=False),
        )
        return out

    logger.info(
        "youtube_search: path=innertube (YOUTUBE_API_KEY unset) max_results=%d query=%r",
        safe_max_results,
        q,
    )
    out = _youtube_search_innertube(q, safe_max_results)
    logger.debug(
        "youtube_search: innertube done videos=%d full_results=%s",
        len(out),
        json.dumps(out, ensure_ascii=False),
    )
    return out
