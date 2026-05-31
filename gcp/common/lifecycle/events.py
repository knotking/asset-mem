"""Lifecycle SSE payloads (proxy and Agent Engine stream)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Sequence

logger = logging.getLogger(__name__)

LIFECYCLE_SCHEMA_VERSION = 1
LIFECYCLE_SSE_PREFIX = "HOMEAPP_LIFECYCLE:"
LIFECYCLE_EVENT_AUTHOR = "homeapp_lifecycle"
LIFECYCLE_STATE_DELTA_KEY = "homeappLifecycle"

PHASE_PROXY_REQUEST_ACCEPTED = "proxy.request_accepted"
PHASE_PROXY_ENGINE_INVOKE = "proxy.engine_invoke"
PHASE_ENGINE_TURN_STARTED = "engine.turn_started"
PHASE_ENGINE_RUNNER_EXEC = "engine.runner_exec"
PHASE_ENGINE_BEFORE_MODEL = "engine.before_model"

_DEFAULT_MESSAGES: dict[str, str] = {
    PHASE_PROXY_REQUEST_ACCEPTED: "On it...",
    PHASE_PROXY_ENGINE_INVOKE: "Setting things up...",
    PHASE_ENGINE_TURN_STARTED: "Reviewing details...",
    PHASE_ENGINE_RUNNER_EXEC: "Working on it...",
    PHASE_ENGINE_BEFORE_MODEL: "Planning next moves...",
}


def _non_empty_str_list(values: Optional[Sequence[str]]) -> list[str]:
    if not values:
        return []
    return [str(v).strip() for v in values if str(v).strip()]


def default_message_for_phase(phase: str) -> str:
    return _DEFAULT_MESSAGES.get(phase, "Working…")


def build_lifecycle_payload(
    phase: str,
    *,
    elapsed_ms: Optional[int] = None,
    correlation_id: Optional[str] = None,
    session_id: Optional[str] = None,
    invocation_id: Optional[str] = None,
    primary_agent: Optional[str] = None,
    checkpoint_ids: Optional[Sequence[str]] = None,
    checkpoint_optional_agents: Optional[Sequence[str]] = None,
    context_doc_uris: Optional[Sequence[str]] = None,
    message: Optional[str] = None,
) -> dict[str, Any]:
    """Build a versioned lifecycle JSON object."""
    doc_uris = _non_empty_str_list(context_doc_uris)
    return {
        "v": LIFECYCLE_SCHEMA_VERSION,
        "phase": phase,
        "ts": datetime.now(timezone.utc).isoformat(),
        "elapsed_ms": elapsed_ms,
        "correlation_id": correlation_id,
        "session_id": session_id,
        "invocation_id": invocation_id,
        "primary_agent": primary_agent,
        "checkpoint_ids": _non_empty_str_list(checkpoint_ids),
        "checkpoint_optional_agents": _non_empty_str_list(checkpoint_optional_agents),
        "context_doc_count": len(doc_uris),
        "message": message or default_message_for_phase(phase),
    }


def format_lifecycle_sse_line(payload: Mapping[str, Any]) -> str:
    """Single SSE chunk line (no trailing newline required by callers)."""
    return f"{LIFECYCLE_SSE_PREFIX}{json.dumps(payload, separators=(',', ':'))}\n"


def is_lifecycle_author(author: Any) -> bool:
    return isinstance(author, str) and author == LIFECYCLE_EVENT_AUTHOR


def extract_lifecycle_payload(event: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    """Read lifecycle payload from an Agent Engine stream event dict."""
    if not is_lifecycle_author(event.get("author")):
        return None
    actions = event.get("actions")
    if not isinstance(actions, dict):
        return None
    delta = actions.get("state_delta") or actions.get("stateDelta")
    if not isinstance(delta, dict):
        return None
    payload = delta.get(LIFECYCLE_STATE_DELTA_KEY)
    if isinstance(payload, dict):
        return dict(payload)
    return None


def is_lifecycle_stream_event(event: Mapping[str, Any]) -> bool:
    return extract_lifecycle_payload(event) is not None


def log_lifecycle_payload(payload: Mapping[str, Any]) -> None:
    logger.info(
        "HOMEAPP_LIFECYCLE phase=%s message=%r elapsed_ms=%s correlation_id=%s",
        payload.get("phase"),
        payload.get("message"),
        payload.get("elapsed_ms"),
        payload.get("correlation_id") or "-",
    )


def parse_lifecycle_sse_chunk(raw: str) -> Optional[dict[str, Any]]:
    """Parse a client SSE chunk if it is a lifecycle line."""
    text = raw.strip()
    if not text.startswith(LIFECYCLE_SSE_PREFIX):
        return None
    try:
        data = json.loads(text[len(LIFECYCLE_SSE_PREFIX) :])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None
