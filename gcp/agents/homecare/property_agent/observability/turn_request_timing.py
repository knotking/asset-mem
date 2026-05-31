"""Per-turn engine timing for ADK / Agent Engine latency breakdown (Cloud Logging)."""

from __future__ import annotations

import contextvars
import logging
import os
import time
from typing import Any, Mapping, Optional

logger = logging.getLogger(__name__)

# Same logger as vertex_app entrypoints — WARNING survives noisy INFO filters.
_ENTRYPOINT_LOG = logging.getLogger("property_agent.engine_entrypoint")

_TIMING_CTX: contextvars.ContextVar[Optional[dict[str, Any]]] = contextvars.ContextVar(
    "engine_turn_request_timing",
    default=None,
)

# Ordered phases for the summary line (delta from turn t0 unless noted).
_SUMMARY_PHASES = (
    "ensure_runner_ms",
    "set_up_ms",
    "wire_runner_ms",
    "adk_stream_start_ms",
    "adk_first_event_ms",
    "runner_exec_start_ms",
    "runner_first_event_ms",
    "before_model_ms",
    "resolve_ms",
    "executor_first_model_ms",
    "stream_complete_ms",
)


def turn_timing_enabled() -> bool:
    raw = os.getenv("HOMEAPP_ENGINE_TURN_TIMING", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def begin_turn(
    *,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    entrypoint: str = "async_stream_query",
    force: bool = False,
) -> None:
    """Start a turn timer (no-op when disabled)."""
    if not turn_timing_enabled():
        _TIMING_CTX.set(None)
        return
    if not force and _TIMING_CTX.get() is not None:
        return
    _TIMING_CTX.set(
        {
            "t0": time.monotonic(),
            "marks": {"stream_query_start": time.monotonic()},
            "durations": {},
            "session_id": (session_id or "")[:64] or None,
            "user_id": (user_id or "")[:64] or None,
            "entrypoint": entrypoint,
            "event_count": 0,
            "emitted": False,
        }
    )


def current_turn_timing() -> Optional[dict[str, Any]]:
    return _TIMING_CTX.get()


def mark(phase: str) -> None:
    """Record monotonic time for ``phase`` (first mark wins)."""
    data = _TIMING_CTX.get()
    if not data or not turn_timing_enabled():
        return
    marks: dict[str, float] = data.setdefault("marks", {})
    if phase not in marks:
        marks[phase] = time.monotonic()


def record_duration_ms(phase: str, duration_ms: float) -> None:
    """Store an explicit duration (e.g. resolve_turn_llm internal timing)."""
    data = _TIMING_CTX.get()
    if not data or not turn_timing_enabled():
        return
    data.setdefault("durations", {})[phase] = int(duration_ms)


def increment_event_count() -> None:
    data = _TIMING_CTX.get()
    if data is not None:
        data["event_count"] = int(data.get("event_count") or 0) + 1


def _ms_since_t0(ts: float, t0: float) -> int:
    return max(0, int((ts - t0) * 1000))


def _phase_ms(data: dict[str, Any], phase: str) -> Optional[int]:
    durations: Mapping[str, Any] = data.get("durations") or {}
    if phase in durations and durations[phase] is not None:
        return int(durations[phase])
    marks: Mapping[str, float] = data.get("marks") or {}
    t0 = data.get("t0")
    if not isinstance(t0, (int, float)):
        return None
    if phase == "before_model_ms":
        start = marks.get("before_model_start")
        end = marks.get("before_model_end")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            return _ms_since_t0(end, start)
        return None
    if phase == "set_up_ms":
        start = marks.get("set_up_start")
        end = marks.get("set_up_done")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            return _ms_since_t0(end, start)
        return None
    if phase == "resolve_ms":
        start = marks.get("resolve_start")
        end = marks.get("resolve_end")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            return _ms_since_t0(end, start)
        return None
    mark_key = {
        "ensure_runner_ms": "ensure_runner_done",
        "wire_runner_ms": "wire_runner_done",
        "adk_stream_start_ms": "adk_stream_start",
        "adk_first_event_ms": "adk_first_event",
        "runner_exec_start_ms": "runner_exec_start",
        "runner_first_event_ms": "runner_first_event",
        "executor_first_model_ms": "executor_first_model",
        "stream_complete_ms": "stream_complete",
    }.get(phase)
    if mark_key and mark_key in marks:
        return _ms_since_t0(float(marks[mark_key]), float(t0))
    return None


def build_summary_payload(
    data: dict[str, Any],
    *,
    reason: str,
    event_count: Optional[int] = None,
) -> dict[str, Any]:
    if event_count is not None:
        data["event_count"] = event_count
    marks: dict[str, float] = data.setdefault("marks", {})
    if "stream_complete" not in marks:
        marks["stream_complete"] = time.monotonic()
    payload: dict[str, Any] = {
        "reason": reason,
        "entrypoint": data.get("entrypoint"),
        "session_id": data.get("session_id"),
        "event_count": data.get("event_count"),
    }
    for phase in _SUMMARY_PHASES:
        payload[phase] = _phase_ms(data, phase)
    return payload


def format_summary_line(payload: Mapping[str, Any]) -> str:
    parts = [
        f"{key}={payload[key] if payload.get(key) is not None else '-'}"
        for key in _SUMMARY_PHASES
    ]
    extras = [
        f"reason={payload.get('reason') or '-'}",
        f"entrypoint={payload.get('entrypoint') or '-'}",
        f"session_id={payload.get('session_id') or '-'}",
        f"events={payload.get('event_count') if payload.get('event_count') is not None else '-'}",
    ]
    return "engine_turn_timing: " + " ".join(parts + extras)


def emit_summary(
    reason: str,
    *,
    event_count: Optional[int] = None,
    extra: Optional[Mapping[str, Any]] = None,
    entrypoint: Optional[str] = None,
) -> None:
    """Emit one structured timing line per turn (idempotent)."""
    if not turn_timing_enabled():
        return
    data = _TIMING_CTX.get()
    if not data or data.get("emitted"):
        return
    if entrypoint is not None and data.get("entrypoint") != entrypoint:
        return
    payload = build_summary_payload(data, reason=reason, event_count=event_count)
    if extra:
        payload = {**payload, **dict(extra)}
    line = format_summary_line(payload)
    logger.info(line)
    _ENTRYPOINT_LOG.warning("HOMEAPP_ENGINE_TURN_TIMING %s", line)
    data["emitted"] = True


def maybe_mark_first_stream_event(event: Any) -> None:
    """Mark first ADK stream event and first property_agent model completion."""
    data = _TIMING_CTX.get()
    if not data:
        return
    marks: dict[str, float] = data.setdefault("marks", {})
    if "adk_first_event" not in marks:
        mark("adk_first_event")
    author = _event_author(event)
    if author == "property_agent" and "executor_first_model" not in marks:
        mark("executor_first_model")


def _event_author(event: Any) -> str:
    if isinstance(event, dict):
        return str(event.get("author") or event.get("agent") or "").strip()
    return str(getattr(event, "author", None) or getattr(event, "agent", None) or "").strip()


def begin_turn_for_adk_web(
    *,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
    invocation_id: Optional[str] = None,
) -> None:
    """``adk web`` / ``/run_sse`` — timing owned by ``HomecareRunner`` (not ``HomecareAdkApp``)."""
    begin_turn(
        session_id=session_id,
        user_id=user_id,
        entrypoint="adk_web",
    )
    if invocation_id:
        mark("adk_stream_start")


def begin_turn_for_engine_stream(
    *,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> None:
    """Agent Engine ``stream_query`` — full stream including platform bootstrap."""
    begin_turn(
        session_id=session_id,
        user_id=user_id,
        entrypoint="async_stream_query",
        force=True,
    )
