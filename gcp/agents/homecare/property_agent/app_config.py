"""ADK ``App`` wrapper with post-invocation session event compaction."""

from __future__ import annotations

import logging
import os
from typing import Optional

from google.adk.apps.app import App, EventsCompactionConfig

from property_agent.agent import root_agent

logger = logging.getLogger(__name__)

# Sliding-window fields are required by ADK even when only token threshold is used.
_DEFAULT_COMPACTION_INTERVAL = 10_000
_DEFAULT_OVERLAP_SIZE = 1
_DEFAULT_TOKEN_THRESHOLD = 40_000
_DEFAULT_EVENT_RETENTION_SIZE = 40


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    return int(raw)


def _compaction_disabled() -> bool:
    return os.getenv("ADK_EVENTS_COMPACTION_DISABLED", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def build_events_compaction_config() -> Optional[EventsCompactionConfig]:
    """Build compaction config from env, or None when disabled."""
    if _compaction_disabled():
        logger.info(
            "ADK session event compaction disabled via ADK_EVENTS_COMPACTION_DISABLED"
        )
        return None

    config = EventsCompactionConfig(
        compaction_interval=_int_env(
            "ADK_COMPACTION_INTERVAL", _DEFAULT_COMPACTION_INTERVAL
        ),
        overlap_size=_int_env("ADK_COMPACTION_OVERLAP_SIZE", _DEFAULT_OVERLAP_SIZE),
        token_threshold=_int_env(
            "ADK_COMPACTION_TOKEN_THRESHOLD", _DEFAULT_TOKEN_THRESHOLD
        ),
        event_retention_size=_int_env(
            "ADK_COMPACTION_EVENT_RETENTION_SIZE", _DEFAULT_EVENT_RETENTION_SIZE
        ),
    )
    logger.info(
        "ADK session compaction enabled token_threshold=%s event_retention_size=%s",
        config.token_threshold,
        config.event_retention_size,
    )
    return config


def build_property_app() -> App:
    return App(
        name="property_agent",
        root_agent=root_agent,
        events_compaction_config=build_events_compaction_config(),
    )


property_app = build_property_app()
