"""Throttle Firestore chat message persistence during Vertex stream events."""

from __future__ import annotations

import time


class StreamPersistThrottle:
    """Limit how often stream persistence runs; always allow finalize."""

    def __init__(self, interval_ms: float = 200) -> None:
        self.interval_ms = interval_ms
        self._last_persist_ms = 0.0
        self.skipped_since_last_persist = 0

    def should_persist(self, *, finalize: bool = False) -> bool:
        if finalize:
            self.skipped_since_last_persist = 0
            self._last_persist_ms = time.monotonic() * 1000
            return True

        now_ms = time.monotonic() * 1000
        if self._last_persist_ms == 0 or now_ms - self._last_persist_ms >= self.interval_ms:
            self._last_persist_ms = now_ms
            self.skipped_since_last_persist = 0
            return True

        self.skipped_since_last_persist += 1
        return False
