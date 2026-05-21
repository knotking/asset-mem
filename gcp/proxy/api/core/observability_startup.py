"""Initialize shared OpenTelemetry helpers on proxy startup (Phase 2.3)."""

from __future__ import annotations

import logging

from core.config import settings

logger = logging.getLogger(__name__)


def setup_proxy_observability() -> None:
    if not settings.OBSERVABILITY_ENABLE_TRACING and not settings.OBSERVABILITY_ENABLE_METRICS:
        logger.info(
            "Proxy observability: tracing and metrics disabled "
            "(set PROXY_OBSERVABILITY_TRACING/METRICS=true to enable)"
        )
        return

    try:
        from common.observability import initialize_observability

        initialize_observability(
            enable_tracing=settings.OBSERVABILITY_ENABLE_TRACING,
            enable_metrics=settings.OBSERVABILITY_ENABLE_METRICS,
        )
        logger.info(
            "Proxy observability initialized tracing=%s metrics=%s",
            settings.OBSERVABILITY_ENABLE_TRACING,
            settings.OBSERVABILITY_ENABLE_METRICS,
        )
    except Exception:
        logger.exception(
            "Failed to initialize observability (install opentelemetry exporter packages "
            "or disable PROXY_OBSERVABILITY_TRACING/METRICS)"
        )
