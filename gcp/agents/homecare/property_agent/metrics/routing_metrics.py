"""Orchestrator routing observability (deterministic + chip paths)."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_METRICS_ENABLED = os.getenv("ORCHESTRATOR_V2_METRICS", "1").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)

METRIC_RESOLVE_CALLS = "orchestrator.v2.routing.resolve_calls"
METRIC_RESOLVE_PROMPT_TOKENS = "orchestrator.v2.routing.resolve_prompt_tokens"
METRIC_EXECUTOR_SKIPPED = "orchestrator.v2.routing.executor_skipped"


def metrics_enabled() -> bool:
    return _METRICS_ENABLED


def _estimate_tokens(text: str) -> int:
    # Rough heuristic (~4 chars/token) for log/metric baselines; not billing-grade.
    stripped = (text or "").strip()
    if not stripped:
        return 0
    return max(1, len(stripped) // 4)


def record_routing_turn(
    *,
    intent: str,
    route: str,
    prompt_text: str,
    elapsed_ms: float,
    executor_skipped: bool,
) -> None:
    prompt_tokens = _estimate_tokens(prompt_text)
    logger.info(
        "orchestrator_routing intent=%s route=%s routing_prompt_tokens=%s "
        "elapsed_ms=%.0f executor_skipped=%s",
        intent,
        route,
        prompt_tokens,
        elapsed_ms,
        executor_skipped,
    )
    if not _METRICS_ENABLED:
        return
    try:
        from common.observability.metrics_helper import record_counter, record_histogram
    except ImportError:
        return

    attrs = {"intent": intent, "route": route}
    record_counter(
        METRIC_RESOLVE_CALLS,
        1,
        attributes=attrs,
        description="Orchestrator routing decisions per turn (chip or legacy resolve)",
    )
    record_histogram(
        METRIC_RESOLVE_PROMPT_TOKENS,
        float(prompt_tokens),
        attributes=attrs,
        description="Estimated routing prompt tokens (0 for chip/deterministic)",
        unit="1",
    )
    record_histogram(
        "orchestrator.v2.routing.resolve_duration_ms",
        elapsed_ms,
        attributes=attrs,
        description="Routing decision latency",
        unit="ms",
    )
    if executor_skipped:
        record_counter(
            METRIC_EXECUTOR_SKIPPED,
            1,
            attributes=attrs,
            description="Casual routing short-circuits (executor not invoked)",
        )


# Back-compat alias for any external importers.
record_resolve_turn = record_routing_turn
