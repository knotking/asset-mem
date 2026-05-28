"""TTL caches for SerpAPI geo lookups."""

from __future__ import annotations

import os
import time
from typing import Any, Dict, Optional, Tuple

_GEO_CACHE_MAX_ENTRIES = 256


def _geo_cache_ttl_seconds() -> float:
    raw = os.getenv("SERPAPI_GEO_CACHE_TTL_SECONDS", "86400").strip()
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 86400.0


class _TtlCache:
    """In-process TTL cache (disabled when ttl_seconds is 0)."""

    def __init__(
        self, ttl_seconds: float, *, max_size: int = _GEO_CACHE_MAX_ENTRIES
    ) -> None:
        self._ttl = ttl_seconds
        self._max_size = max_size
        self._entries: Dict[Any, Tuple[Any, float]] = {}

    def clear(self) -> None:
        self._entries.clear()

    def get(self, key: Any) -> Optional[Any]:
        if self._ttl <= 0:
            return None
        entry = self._entries.get(key)
        if entry is None:
            return None
        value, expires = entry
        if time.monotonic() > expires:
            self._entries.pop(key, None)
            return None
        return value

    def set(self, key: Any, value: Any) -> None:
        if self._ttl <= 0:
            return
        if len(self._entries) >= self._max_size:
            self._entries.pop(next(iter(self._entries)))
        self._entries[key] = (value, time.monotonic() + self._ttl)


_reverse_geocode_cache = _TtlCache(_geo_cache_ttl_seconds())
_serpapi_locations_cache = _TtlCache(_geo_cache_ttl_seconds())


def clear_geo_caches() -> None:
    """Clear SerpAPI / reverse-geocode caches (tests)."""
    _reverse_geocode_cache.clear()
    _serpapi_locations_cache.clear()
