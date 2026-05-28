"""OpenTelemetry metrics for checkpoint analysis phase timings.

Mirrors fields logged by ``checkpoint_request_timing`` so Cloud Monitoring /
ADK OTel export can chart phase latency without parsing logs.

Deployed Agent Engine packages only ``property_agent``; metric names align with
``gcp/common/observability/constants.py`` (``checkpoint.*`` prefix).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Mapping

logger = logging.getLogger(__name__)

# Histogram: value = milliseconds, attribute phase = retrieval | parallel | ...
METRIC_PHASE_DURATION_MS = "checkpoint.agent.phase.duration_ms"
# Histogram: final response size for the request
METRIC_RESPONSE_CHARS = "checkpoint.agent.response.chars"

_PHASE_KEYS = (
    "retrieval_ms",
    "parallel_ms",
    "diy_ms",
    "synthesis_ms",
    "executor_ms",
    "total_ms",
)

_METRICS_ENABLED = os.getenv("CHECKPOINT_TIMING_METRICS", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)

_histogram_cache: dict[str, Any] = {}


def metrics_enabled() -> bool:
    return _METRICS_ENABLED


def _get_histogram(name: str, *, unit: str, description: str):
    if name in _histogram_cache:
        return _histogram_cache[name]
    try:
        from opentelemetry import metrics as otel_metrics
    except ImportError:
        return None
    meter = otel_metrics.get_meter("property_agent.checkpoint")
    instrument = meter.create_histogram(
        name=name,
        description=description,
        unit=unit,
    )
    _histogram_cache[name] = instrument
    return instrument


def _base_attributes(*, source: str, state: Any = None) -> dict[str, str]:
    from agent_framework.observability.logging_context import get_correlation_id

    attrs: dict[str, str] = {
        "source": source,
        "component": "property_agent",
    }
    correlation_id = get_correlation_id()
    if correlation_id:
        attrs["correlation_id"] = correlation_id
    if state is not None and hasattr(state, "get"):
        property_id = state.get("property_id")
        if isinstance(property_id, str) and property_id.strip():
            attrs["property_id"] = property_id.strip()[:128]
    return attrs


def emit_checkpoint_timing_metrics(
    payload: Mapping[str, Any],
    *,
    source: str,
    state: Any = None,
) -> None:
    """Record phase durations and response size to OTel (no-op if disabled or OTel missing)."""
    if not _METRICS_ENABLED:
        return

    try:
        phase_hist = _get_histogram(
            METRIC_PHASE_DURATION_MS,
            unit="ms",
            description="Checkpoint analysis phase duration in milliseconds",
        )
        chars_hist = _get_histogram(
            METRIC_RESPONSE_CHARS,
            unit="1",
            description="Checkpoint analysis response character count",
        )
    except Exception as exc:
        logger.debug("checkpoint timing metrics: instrument setup skipped: %s", exc)
        return

    if phase_hist is None and chars_hist is None:
        return

    base_attrs = _base_attributes(source=source, state=state)

    if phase_hist is not None:
        for key in _PHASE_KEYS:
            raw = payload.get(key)
            if not isinstance(raw, int) or raw < 0:
                continue
            phase = key[: -len("_ms")]
            try:
                phase_hist.record(
                    float(raw),
                    attributes={**base_attrs, "phase": phase},
                )
            except Exception as exc:
                logger.debug(
                    "checkpoint timing metrics: record phase=%s failed: %s",
                    phase,
                    exc,
                )

    return_chars = payload.get("return_chars")
    if chars_hist is not None and isinstance(return_chars, int) and return_chars >= 0:
        try:
            chars_hist.record(float(return_chars), attributes=base_attrs)
        except Exception as exc:
            logger.debug("checkpoint timing metrics: record chars failed: %s", exc)
