"""Tests for lifecycle event helpers."""

from __future__ import annotations

import json

from common.lifecycle.events import (
    LIFECYCLE_EVENT_AUTHOR,
    LIFECYCLE_SSE_PREFIX,
    LIFECYCLE_STATE_DELTA_KEY,
    PHASE_PROXY_ENGINE_INVOKE,
    PHASE_PROXY_REQUEST_ACCEPTED,
    build_lifecycle_payload,
    extract_lifecycle_payload,
    format_lifecycle_sse_line,
    is_lifecycle_stream_event,
    parse_lifecycle_sse_chunk,
)


def test_format_and_parse_sse_roundtrip() -> None:
    payload = build_lifecycle_payload(
        PHASE_PROXY_REQUEST_ACCEPTED,
        elapsed_ms=0,
        correlation_id="corr-1",
        session_id="sess-1",
    )
    line = format_lifecycle_sse_line(payload)
    assert line.startswith(LIFECYCLE_SSE_PREFIX)
    parsed = parse_lifecycle_sse_chunk(line)
    assert parsed is not None
    assert parsed["phase"] == PHASE_PROXY_REQUEST_ACCEPTED
    assert parsed["correlation_id"] == "corr-1"


def test_extract_lifecycle_from_engine_event() -> None:
    payload = build_lifecycle_payload(PHASE_PROXY_REQUEST_ACCEPTED, elapsed_ms=12)
    event = {
        "author": LIFECYCLE_EVENT_AUTHOR,
        "actions": {"state_delta": {LIFECYCLE_STATE_DELTA_KEY: payload}},
    }
    assert is_lifecycle_stream_event(event)
    assert extract_lifecycle_payload(event) == payload


def test_sse_line_is_valid_json_suffix() -> None:
    payload = build_lifecycle_payload(PHASE_PROXY_REQUEST_ACCEPTED)
    line = format_lifecycle_sse_line(payload)
    body = line[len(LIFECYCLE_SSE_PREFIX) :].strip()
    data = json.loads(body)
    assert data["v"] == 1


def test_static_message_per_phase() -> None:
    payload = build_lifecycle_payload(
        PHASE_PROXY_ENGINE_INVOKE,
        checkpoint_ids=["cp-1"],
        checkpoint_optional_agents=["service"],
        primary_agent="checkpoint",
    )
    assert payload["message"] == "Setting things up..."
