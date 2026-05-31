"""Tests for lifecycle Firestore persistence in vertex_service."""

from unittest.mock import MagicMock

from services.vertex_service import (
    _agent_lifecycle_firestore_doc,
    _persist_agent_lifecycle_to_message,
    _persist_proxy_lifecycle,
    extract_lifecycle_payload,
    is_lifecycle_stream_event,
)
from common.lifecycle.events import PHASE_PROXY_REQUEST_ACCEPTED


def test_agent_lifecycle_firestore_doc() -> None:
    doc = _agent_lifecycle_firestore_doc(
        {
            "phase": "proxy.request_accepted",
            "message": "On it...",
            "ts": "2026-01-01T00:00:00Z",
            "elapsed_ms": 42,
        }
    )
    assert doc == {
        "phase": "proxy.request_accepted",
        "message": "On it...",
        "ts": "2026-01-01T00:00:00Z",
    }


def test_persist_agent_lifecycle_to_message() -> None:
    ref = MagicMock()
    _persist_agent_lifecycle_to_message(
        ref,
        {
            "phase": PHASE_PROXY_REQUEST_ACCEPTED,
            "message": "On it...",
            "ts": "2026-01-01T00:00:00Z",
        },
    )
    ref.set.assert_called_once()
    payload = ref.set.call_args[0][0]
    assert payload["agentLifecycle"]["phase"] == PHASE_PROXY_REQUEST_ACCEPTED
    assert payload["agentLifecycle"]["message"] == "On it..."


def test_persist_proxy_lifecycle_skips_when_agent_steps_present() -> None:
    ref = MagicMock()
    _persist_proxy_lifecycle(
        phase=PHASE_PROXY_REQUEST_ACCEPTED,
        stream_started_at=0.0,
        correlation_id="c1",
        session_id="s1",
        primary_agent="checkpoint",
        checkpoint_ids=[],
        checkpoint_optional_agents=[],
        context_doc_uris=[],
        assistant_message_ref=ref,
        agent_steps_by_name={"run_checkpoint_pipeline": {"name": "run_checkpoint_pipeline", "status": "executing"}},
    )
    ref.set.assert_not_called()


def test_engine_lifecycle_event_detected() -> None:
    event = {
        "author": "homeapp_lifecycle",
        "actions": {
            "state_delta": {
                "homeappLifecycle": {
                    "v": 1,
                    "phase": "engine.turn_started",
                    "message": "Reviewing details...",
                    "ts": "2026-01-01T00:00:00Z",
                }
            }
        },
    }
    assert is_lifecycle_stream_event(event)
    payload = extract_lifecycle_payload(event)
    assert payload is not None
    assert payload["phase"] == "engine.turn_started"
