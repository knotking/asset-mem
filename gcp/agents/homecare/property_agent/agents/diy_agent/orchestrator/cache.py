"""DIY orchestrator response cache."""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from typing import Dict, Optional, Tuple


_CACHE_LOCK = threading.Lock()
_DIY_CACHE: Dict[str, Tuple[float, str]] = {}
_CACHE_MAX = 200


def _cache_ttl_seconds() -> float:
    raw = os.getenv("DIY_ORCHESTRATOR_CACHE_TTL_SECONDS", "300").strip()
    try:
        v = float(raw)
    except ValueError:
        return 300.0
    return max(0.0, v)


def _cache_key(
    user_query: str,
    property_address: Optional[str],
    *,
    checkpoint_retrieval_search_query: Optional[str] = None,
    branch_search_intents: Optional[dict] = None,
) -> str:
    payload = json.dumps(
        {
            "q": user_query.strip(),
            "a": (property_address or "").strip(),
            "r": checkpoint_retrieval_search_query,
            "i": branch_search_intents,
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _prune_cache_unlocked() -> None:
    if len(_DIY_CACHE) <= _CACHE_MAX:
        return
    # Drop oldest ~20% by timestamp
    items = sorted(_DIY_CACHE.items(), key=lambda kv: kv[1][0])
    for k, _ in items[: max(1, len(items) // 5)]:
        _DIY_CACHE.pop(k, None)

