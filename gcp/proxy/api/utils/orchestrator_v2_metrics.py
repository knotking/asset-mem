"""Orchestrator V2 proxy message persist observability."""

from __future__ import annotations

import logging
import os
import time

logger = logging.getLogger(__name__)

_METRICS_ENABLED = os.getenv("ORCHESTRATOR_V2_METRICS", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)

METRIC_STALE_REVISION_REJECTS = "orchestrator.v2.message.stale_revision_rejects"
METRIC_PATCH_APPLIES = "orchestrator.v2.message.patch_applies"
METRIC_FENCE_STRIPS = "orchestrator.v2.message.fence_strips"
METRIC_TTF_STRUCTURED_PATCH_MS = "orchestrator.v2.message.ttf_structured_patch_ms"


class StreamPatchTracker:
    """Per-stream counters for structured patch timing and persist rate."""

    __slots__ = ("_stream_started_at", "_first_structured_patch_at", "patch_applies")

    def __init__(self) -> None:
        self._stream_started_at = time.monotonic()
        self._first_structured_patch_at: float | None = None
        self.patch_applies = 0

    def note_structured_patch(self) -> None:
        if self._first_structured_patch_at is None:
            self._first_structured_patch_at = time.monotonic()

    def ttf_structured_patch_ms(self) -> float | None:
        if self._first_structured_patch_at is None:
            return None
        return (self._first_structured_patch_at - self._stream_started_at) * 1000.0


def metrics_enabled() -> bool:
    return _METRICS_ENABLED


def record_stale_revision_reject(*, incoming_revision: int, stored_revision: int) -> None:
    logger.info(
        "orchestrator_v2_stale_revision incoming=%s stored=%s",
        incoming_revision,
        stored_revision,
    )
    if not _METRICS_ENABLED:
        return
    try:
        from common.observability.metrics_helper import record_counter
    except ImportError:
        return
    record_counter(
        METRIC_STALE_REVISION_REJECTS,
        1,
        description="Firestore assistant patch rejected as stale",
    )


def record_patch_apply(*, revision: int, has_content_json: bool) -> None:
    if not _METRICS_ENABLED:
        return
    try:
        from common.observability.metrics_helper import record_counter
    except ImportError:
        return
    record_counter(
        METRIC_PATCH_APPLIES,
        1,
        attributes={"has_content_json": "true" if has_content_json else "false"},
        description="Assistant message patch applied to Firestore",
    )


def record_fence_strip(*, chars_removed: int) -> None:
    if chars_removed <= 0:
        return
    logger.info("orchestrator_v2_fence_strip chars_removed=%s", chars_removed)
    if not _METRICS_ENABLED:
        return
    try:
        from common.observability.metrics_helper import record_counter, record_histogram
    except ImportError:
        return
    record_counter(
        METRIC_FENCE_STRIPS,
        1,
        description="Accidental JSON fence stripped from contentMarkdown",
    )
    record_histogram(
        METRIC_FENCE_STRIPS + ".chars",
        float(chars_removed),
        unit="1",
        description="Characters removed by fence strip",
    )


def record_ttf_structured_patch_ms(ms: float) -> None:
    logger.info("orchestrator_v2_ttf_structured_patch_ms=%.0f", ms)
    if not _METRICS_ENABLED:
        return
    try:
        from common.observability.metrics_helper import record_histogram
    except ImportError:
        return
    record_histogram(
        METRIC_TTF_STRUCTURED_PATCH_MS,
        ms,
        unit="ms",
        description="Stream time to first contentJson patch",
    )
