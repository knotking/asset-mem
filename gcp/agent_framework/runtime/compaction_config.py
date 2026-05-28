"""Build ADK ``EventsCompactionConfig`` from environment variables."""

from __future__ import annotations

import logging
import os
from typing import Callable, Optional

from google.adk.apps.app import EventsCompactionConfig

logger = logging.getLogger(__name__)

_DEFAULT_COMPACTION_INTERVAL = 10_000
_DEFAULT_OVERLAP_SIZE = 1


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    return int(raw)


def compaction_disabled() -> bool:
    return os.getenv("ADK_EVENTS_COMPACTION_DISABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def build_events_compaction_config_from_env(
    *,
    base_token_threshold: int,
    base_event_retention_size: int,
    token_threshold_fn: Callable[[int], int] | None = None,
    event_retention_fn: Callable[[int], int] | None = None,
) -> Optional[EventsCompactionConfig]:
    """Build compaction config from env, or None when disabled."""
    if compaction_disabled():
        logger.info(
            "ADK session event compaction disabled via ADK_EVENTS_COMPACTION_DISABLED"
        )
        return None

    token_threshold = _int_env("ADK_COMPACTION_TOKEN_THRESHOLD", base_token_threshold)
    event_retention_size = _int_env(
        "ADK_COMPACTION_EVENT_RETENTION_SIZE", base_event_retention_size
    )
    if token_threshold_fn is not None:
        token_threshold = token_threshold_fn(token_threshold)
    if event_retention_fn is not None:
        event_retention_size = event_retention_fn(event_retention_size)

    config = EventsCompactionConfig(
        compaction_interval=_int_env(
            "ADK_COMPACTION_INTERVAL", _DEFAULT_COMPACTION_INTERVAL
        ),
        overlap_size=_int_env("ADK_COMPACTION_OVERLAP_SIZE", _DEFAULT_OVERLAP_SIZE),
        token_threshold=token_threshold,
        event_retention_size=event_retention_size,
    )
    logger.info(
        "ADK session compaction enabled token_threshold=%s event_retention_size=%s",
        config.token_threshold,
        config.event_retention_size,
    )
    return config
