"""ADK ``App`` wrapper with post-invocation session event compaction."""

from __future__ import annotations

from typing import Optional

from google.adk.apps.app import App, EventsCompactionConfig

from agent_framework.runtime.compaction_config import build_events_compaction_config_from_env
from property_agent.runtime.session_diet import (
    g4_compaction_event_retention_size,
    g4_compaction_token_threshold,
)

_DEFAULT_TOKEN_THRESHOLD = 40_000
_DEFAULT_EVENT_RETENTION_SIZE = 40
_BASE_TOKEN_THRESHOLD = _DEFAULT_TOKEN_THRESHOLD
_BASE_EVENT_RETENTION_SIZE = _DEFAULT_EVENT_RETENTION_SIZE


def build_events_compaction_config() -> Optional[EventsCompactionConfig]:
    """Build compaction config from env, or None when disabled."""
    return build_events_compaction_config_from_env(
        base_token_threshold=_BASE_TOKEN_THRESHOLD,
        base_event_retention_size=_BASE_EVENT_RETENTION_SIZE,
        token_threshold_fn=g4_compaction_token_threshold,
        event_retention_fn=g4_compaction_event_retention_size,
    )


def build_property_app() -> App:
    from property_agent.runtime.agent import root_agent
    from property_agent.runtime.conformance_plugins import load_conformance_plugins

    return App(
        name="property_agent",
        root_agent=root_agent,
        events_compaction_config=build_events_compaction_config(),
        plugins=load_conformance_plugins(),
    )


property_app = build_property_app()
