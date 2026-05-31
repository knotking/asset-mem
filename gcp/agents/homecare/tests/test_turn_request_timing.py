"""Tests for engine turn request timing."""

from __future__ import annotations

import time

import pytest

from property_agent.observability import turn_request_timing as trt


@pytest.fixture(autouse=True)
def _enable_timing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HOMEAPP_ENGINE_TURN_TIMING", "1")


def test_format_summary_line_uses_dash_for_missing() -> None:
    line = trt.format_summary_line(
        {
            "ensure_runner_ms": 12,
            "set_up_ms": None,
            "wire_runner_ms": None,
            "adk_stream_start_ms": 15,
            "adk_first_event_ms": 3400,
            "runner_exec_start_ms": None,
            "runner_first_event_ms": None,
            "before_model_ms": 800,
            "resolve_ms": 950,
            "executor_first_model_ms": 5100,
            "stream_complete_ms": 12000,
            "reason": "stream_complete",
            "entrypoint": "async_stream_query",
            "session_id": "sess-1",
            "event_count": 9,
        }
    )
    assert line.startswith("engine_turn_timing:")
    assert "ensure_runner_ms=12" in line
    assert "set_up_ms=-" in line
    assert "resolve_ms=950" in line
    assert "session_id=sess-1" in line
    assert "events=9" in line


def test_emit_summary_idempotent(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level("INFO")
    trt.begin_turn(session_id="s1", user_id="u1")
    trt.mark("ensure_runner_done")
    trt.emit_summary("stream_complete", event_count=3)
    trt.emit_summary("stream_complete", event_count=99)
    assert (
        sum(
            1
            for r in caplog.records
            if r.name == "property_agent.engine_entrypoint"
            and "HOMEAPP_ENGINE_TURN_TIMING" in r.message
        )
        == 1
    )


def test_before_model_and_resolve_durations() -> None:
    trt.begin_turn()
    t0 = time.monotonic()
    trt.mark("before_model_start")
    trt.mark("before_model_end")
    trt.mark("resolve_start")
    trt.mark("resolve_end")
    data = trt.current_turn_timing()
    assert data is not None
    payload = trt.build_summary_payload(data, reason="test")
    assert payload["before_model_ms"] is not None
    assert payload["before_model_ms"] >= 0
    assert payload["resolve_ms"] is not None
    _ = t0


def test_disabled_is_noop(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HOMEAPP_ENGINE_TURN_TIMING", "0")
    trt.begin_turn()
    trt.mark("ensure_runner_done")
    assert trt.current_turn_timing() is None
