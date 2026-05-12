"""YouTube search helper for DIY flows (shared by agent and orchestrator)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from youtube_search import YoutubeSearch

logger = logging.getLogger(__name__)


def youtube_search(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Searches YouTube videos using plain text query input.
    Avoids the fragile comma-delimited parsing behavior of LangChain's YouTubeSearchTool.
    """
    if not query or not query.strip():
        return []

    safe_max_results = max(1, min(int(max_results), 10))

    try:
        results = YoutubeSearch(query.strip(), max_results=safe_max_results).to_dict()
    except Exception:
        logger.exception("YouTube search failed for query: %s", query)
        return []

    normalized_results: List[Dict[str, Any]] = []
    for item in results:
        url_suffix = item.get("url_suffix", "") or ""
        normalized_results.append(
            {
                "title": item.get("title", ""),
                "url": f"https://www.youtube.com{url_suffix}" if url_suffix else "",
                "description": item.get("long_desc", "") or item.get("channel", ""),
                "duration": item.get("duration", ""),
            }
        )
    return normalized_results
