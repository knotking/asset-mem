"""Tests for lifecycle event builders."""

from __future__ import annotations

from property_agent.observability.lifecycle_events import (
    LIFECYCLE_STATE_DELTA_KEY,
    PHASE_ENGINE_TURN_STARTED,
    build_lifecycle_engine_dict,
    context_fields_from_stream_message,
)


def test_context_fields_from_message_dict() -> None:
    fields = context_fields_from_stream_message(
        {
            "correlation_id": "corr-9",
            "primary_agent": "checkpoint",
            "checkpoint_optional_agents": ["diy", "service"],
        }
    )
    assert fields["correlation_id"] == "corr-9"
    assert fields["primary_agent"] == "checkpoint"
    assert fields["checkpoint_optional_agents"] == ["diy", "service"]


def test_build_lifecycle_engine_dict() -> None:
    event = build_lifecycle_engine_dict(
        phase=PHASE_ENGINE_TURN_STARTED,
        session_id="sess-1",
        correlation_id="corr-1",
    )
    assert event["author"] == "homeapp_lifecycle"
    payload = event["actions"]["state_delta"][LIFECYCLE_STATE_DELTA_KEY]
    assert payload["phase"] == PHASE_ENGINE_TURN_STARTED
    assert payload["session_id"] == "sess-1"
