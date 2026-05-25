"""CORS allowlist for browser clients calling the proxy (Phase 2.2)."""

from __future__ import annotations

import logging
import os
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Origins used when PROXY_CORS_ORIGINS is unset (no trailing slashes).
DEFAULT_CORS_ORIGINS: tuple[str, ...] = (
    # Webapp local dev (see apps/webapp package.json dev port)
    "http://localhost:9002",
    "http://127.0.0.1:9002",
    # Production / marketing domains
    "https://asset-mem.com",
    "https://www.asset-mem.com",
    # Firebase App Hosting default URLs (GCP project IDs remain homegeek-*)
    "https://staging--homegeek-staging.us-central1.hosted.app",
    "https://prod--homegeek-prod.us-central1.hosted.app",
)


def _normalize_origin(value: str) -> str | None:
    """Return origin (scheme + host + port) or None if invalid."""
    raw = value.strip()
    if not raw:
        return None
    # urlparse needs a scheme
    if "://" not in raw:
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return origin.rstrip("/")


def parse_cors_origins(env_value: str | None = None) -> list[str]:
    """
    Resolve allowed CORS origins.

    - If PROXY_CORS_ORIGINS is set (comma-separated), use only those values.
    - Otherwise use DEFAULT_CORS_ORIGINS.
    """
    raw = env_value if env_value is not None else os.environ.get("PROXY_CORS_ORIGINS")
    if raw is None or not str(raw).strip():
        return list(DEFAULT_CORS_ORIGINS)

    seen: set[str] = set()
    origins: list[str] = []
    for part in str(raw).split(","):
        origin = _normalize_origin(part)
        if origin and origin not in seen:
            seen.add(origin)
            origins.append(origin)

    if not origins:
        logger.warning(
            "PROXY_CORS_ORIGINS produced no valid origins; falling back to defaults"
        )
        return list(DEFAULT_CORS_ORIGINS)

    return origins
