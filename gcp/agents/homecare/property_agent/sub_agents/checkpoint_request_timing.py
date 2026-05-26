"""Structured per-request timing for checkpoint analysis flows."""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

CHECKPOINT_REQUEST_TIMING_STATE_KEY = "checkpoint_request_timing"

_TIMING_FIELDS = (
    "retrieval_ms",
    "parallel_ms",
    "diy_ms",
    "synthesis_ms",
    "executor_ms",
    "total_ms",
    "return_chars",
)


def _state_dict(state: Any) -> Dict[str, Any]:
    if not hasattr(state, "get"):
        return {}
    raw = state.get(CHECKPOINT_REQUEST_TIMING_STATE_KEY)
    if isinstance(raw, dict):
        return raw
    return {}


def _write_state(state: Any, data: Dict[str, Any]) -> None:
    if hasattr(state, "__setitem__"):
        state[CHECKPOINT_REQUEST_TIMING_STATE_KEY] = data


def begin_checkpoint_request(state: Any) -> None:
    """Start wall-clock timer for an end-to-end checkpoint analysis request."""
    data = _state_dict(state)
    if data.get("started_at") is not None:
        return
    data = {
        "started_at": time.monotonic(),
        "emitted": False,
        "retrieval_ms": None,
        "parallel_ms": None,
        "diy_ms": None,
        "synthesis_ms": None,
        "synthesis_started_at": None,
        "executor_started_at": None,
        "executor_ms": None,
        "return_chars": None,
    }
    _write_state(state, data)


def record_retrieval_ms(state: Any, duration_ms: int) -> None:
    data = _state_dict(state)
    if not data:
        begin_checkpoint_request(state)
        data = _state_dict(state)
    data["retrieval_ms"] = int(duration_ms)
    _write_state(state, data)


def record_parallel_ms(state: Any, duration_ms: int) -> None:
    data = _state_dict(state)
    if not data:
        begin_checkpoint_request(state)
        data = _state_dict(state)
    data["parallel_ms"] = int(duration_ms)
    if data.get("synthesis_started_at") is None:
        data["synthesis_started_at"] = time.monotonic()
    _write_state(state, data)


def record_diy_ms(state: Any, duration_ms: int) -> None:
    data = _state_dict(state)
    if not data:
        begin_checkpoint_request(state)
        data = _state_dict(state)
    data["diy_ms"] = int(duration_ms)
    _write_state(state, data)


def mark_synthesis_started(state: Any) -> None:
    data = _state_dict(state)
    if not data:
        begin_checkpoint_request(state)
        data = _state_dict(state)
    if data.get("synthesis_started_at") is None:
        data["synthesis_started_at"] = time.monotonic()
    _write_state(state, data)


def record_synthesis_ms(state: Any, duration_ms: Optional[int] = None) -> None:
    data = _state_dict(state)
    if not data:
        begin_checkpoint_request(state)
        data = _state_dict(state)
    if duration_ms is not None:
        data["synthesis_ms"] = int(duration_ms)
    else:
        started = data.get("synthesis_started_at")
        if isinstance(started, (int, float)):
            data["synthesis_ms"] = int((time.monotonic() - float(started)) * 1000)
    _write_state(state, data)


def begin_executor_phase(state: Any) -> None:
    data = _state_dict(state)
    if not data:
        begin_checkpoint_request(state)
        data = _state_dict(state)
    if data.get("executor_started_at") is None:
        data["executor_started_at"] = time.monotonic()
    _write_state(state, data)


def record_executor_ms(state: Any, duration_ms: Optional[int] = None) -> None:
    data = _state_dict(state)
    if not data:
        return
    if duration_ms is not None:
        data["executor_ms"] = int(duration_ms)
    else:
        started = data.get("executor_started_at")
        if isinstance(started, (int, float)):
            data["executor_ms"] = int((time.monotonic() - float(started)) * 1000)
    _write_state(state, data)


def set_return_chars(state: Any, return_chars: int) -> None:
    data = _state_dict(state)
    if not data:
        begin_checkpoint_request(state)
        data = _state_dict(state)
    data["return_chars"] = int(return_chars)
    _write_state(state, data)


def timing_already_emitted(state: Any) -> bool:
    data = _state_dict(state)
    return bool(data.get("emitted"))


def emit_checkpoint_request_timing(
    state: Any,
    *,
    return_chars: Optional[int] = None,
    source: str = "unknown",
) -> None:
    """Log one structured INFO line; no-op if already emitted for this request."""
    data = _state_dict(state)
    if not data or data.get("emitted"):
        return

    started = data.get("started_at")
    if not isinstance(started, (int, float)):
        return

    if return_chars is not None:
        data["return_chars"] = int(return_chars)

    total_ms = int((time.monotonic() - float(started)) * 1000)
    data["total_ms"] = total_ms
    data["emitted"] = True
    _write_state(state, data)

    payload = {
        "retrieval_ms": data.get("retrieval_ms"),
        "parallel_ms": data.get("parallel_ms"),
        "diy_ms": data.get("diy_ms"),
        "synthesis_ms": data.get("synthesis_ms"),
        "executor_ms": data.get("executor_ms"),
        "total_ms": total_ms,
        "return_chars": data.get("return_chars"),
        "source": source,
    }

    parts = [
        f"{key}={payload[key] if payload[key] is not None else '-'}"
        for key in _TIMING_FIELDS
    ]
    logger.info(
        "checkpoint_request_timing: %s source=%s",
        " ".join(parts),
        source,
    )

    from ..checkpoint_timing_metrics import emit_checkpoint_timing_metrics

    emit_checkpoint_timing_metrics(payload, source=source, state=state)
