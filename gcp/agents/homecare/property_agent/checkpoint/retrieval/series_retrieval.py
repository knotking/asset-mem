"""Series-aware checkpoint retrieval helpers."""

from __future__ import annotations

import re
from typing import Any, Dict, List

from common.checkpoint.series import pick_latest_captures_per_series

_HISTORY_PATTERNS = (
    r"\bchanged\b",
    r"\bchanges\b",
    r"\bchanging\b",
    r"over time",
    r"\bhistory\b",
    r"all captures",
    r"all checkpoints",
    r"\bevolution\b",
    r"\btimeline\b",
    r"how has .+ changed",
    r"what changed",
    r"compare .+ over",
)


def query_requests_series_history(user_query: str) -> bool:
    """True when the user asks for multi-capture / change-over-time context."""
    text = (user_query or "").strip().lower()
    if not text:
        return False
    return any(re.search(pattern, text) for pattern in _HISTORY_PATTERNS)


def maybe_collapse_to_latest_per_series(
    checkpoints: List[Dict[str, Any]],
    user_query: str,
    *,
    mode: str,
) -> List[Dict[str, Any]]:
    """
    Default agent retrieval to latest capture per series unless the query or
    mode explicitly needs full history.
    """
    if not checkpoints:
        return checkpoints
    if query_requests_series_history(user_query):
        return checkpoints
    if mode in ("inventory_recent", "date_range", "by_id"):
        return checkpoints
    return pick_latest_captures_per_series(checkpoints)


__all__ = [
    "maybe_collapse_to_latest_per_series",
    "query_requests_series_history",
]
