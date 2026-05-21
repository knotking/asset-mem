"""Per-UID in-memory rate limiting for user-facing proxy routes (Phase 2.3)."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException

from core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RateLimitRule:
    max_requests: int
    window_seconds: int


class InMemoryRateLimiter:
    """Fixed-window counter per (uid, bucket). Suitable for single-instance or low scale."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._windows: dict[tuple[str, str], tuple[float, int]] = {}

    def check(self, uid: str, bucket: str, rule: RateLimitRule) -> tuple[bool, Optional[int]]:
        if rule.max_requests <= 0:
            return True, None

        key = (uid, bucket)
        now = time.monotonic()

        with self._lock:
            window_start, count = self._windows.get(key, (now, 0))
            if now - window_start >= rule.window_seconds:
                window_start, count = now, 0
            if count >= rule.max_requests:
                retry_after = max(
                    1,
                    int(rule.window_seconds - (now - window_start)),
                )
                return False, retry_after
            self._windows[key] = (window_start, count + 1)
            return True, None


_limiter = InMemoryRateLimiter()


def enforce_rate_limit(uid: str, bucket: str) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return

    rule = settings.rate_limit_rule(bucket)
    allowed, retry_after = _limiter.check(uid, bucket, rule)
    if allowed:
        return

    logger.warning(
        "Rate limit exceeded uid=%s bucket=%s max=%s window_s=%s",
        uid,
        bucket,
        rule.max_requests,
        rule.window_seconds,
    )
    headers = {"Retry-After": str(retry_after)} if retry_after else {}
    raise HTTPException(
        status_code=429,
        headers=headers,
        detail={
            "code": "RATE_LIMIT_EXCEEDED",
            "message": "Too many requests. Please try again shortly.",
            "bucket": bucket,
            "retry_after_seconds": retry_after,
        },
    )
