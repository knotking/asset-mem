"""Lifecycle stream events for Agent Engine / ADK (keep phases aligned with ``gcp/common/lifecycle``)."""

from __future__ import annotations

import logging
from typing import Any, Mapping, Optional

from google.adk.events.event import Event
from google.adk.events.event_actions import EventActions
from google.genai import types

from property_agent.observability.turn_request_timing import current_turn_timing

logger = logging.getLogger(__name__)

LIFECYCLE_SCHEMA_VERSION = 1
LIFECYCLE_EVENT_AUTHOR = "homeapp_lifecycle"
LIFECYCLE_STATE_DELTA_KEY = "homeappLifecycle"

PHASE_PROXY_REQUEST_ACCEPTED = "proxy.request_accepted"
PHASE_PROXY_ENGINE_INVOKE = "proxy.engine_invoke"
PHASE_ENGINE_TURN_STARTED = "engine.turn_started"
PHASE_ENGINE_RUNNER_EXEC = "engine.runner_exec"
PHASE_ENGINE_BEFORE_MODEL = "engine.before_model"

# Keep phase strings and default copy in sync with ``gcp/common/lifecycle/events.py``.

_DEFAULT_MESSAGES: dict[str, str] = {
    PHASE_PROXY_REQUEST_ACCEPTED: "On it...",
    PHASE_PROXY_ENGINE_INVOKE: "Setting things up...",
    PHASE_ENGINE_TURN_STARTED: "Reviewing details...",
    PHASE_ENGINE_RUNNER_EXEC: "Working on it...",
    PHASE_ENGINE_BEFORE_MODEL: "Planning next moves...",
}


def _non_empty_str_list(values: Optional[list[str]]) -> list[str]:
    if not values:
        return []
    return [str(v).strip() for v in values if str(v).strip()]


def _default_message(phase: str) -> str:
    return _DEFAULT_MESSAGES.get(phase, "Working…")


def lifecycle_elapsed_ms() -> Optional[int]:
    """Ms since engine turn t0 when timing context is active."""
    data = current_turn_timing()
    if not data:
        return None
    t0 = data.get("t0")
    if not isinstance(t0, (int, float)):
        return None
    import time

    return int((time.monotonic() - t0) * 1000)


def build_lifecycle_payload(
    phase: str,
    *,
    elapsed_ms: Optional[int] = None,
    correlation_id: Optional[str] = None,
    session_id: Optional[str] = None,
    invocation_id: Optional[str] = None,
    primary_agent: Optional[str] = None,
    checkpoint_ids: Optional[list[str]] = None,
    checkpoint_optional_agents: Optional[list[str]] = None,
    context_doc_uris: Optional[list[str]] = None,
    message: Optional[str] = None,
) -> dict[str, Any]:
    from datetime import datetime, timezone

    doc_uris = _non_empty_str_list(context_doc_uris)
    resolved_message = message or _default_message(phase)
    return {
        "v": LIFECYCLE_SCHEMA_VERSION,
        "phase": phase,
        "ts": datetime.now(timezone.utc).isoformat(),
        "elapsed_ms": elapsed_ms if elapsed_ms is not None else lifecycle_elapsed_ms(),
        "correlation_id": correlation_id,
        "session_id": session_id,
        "invocation_id": invocation_id,
        "primary_agent": primary_agent,
        "checkpoint_ids": _non_empty_str_list(checkpoint_ids),
        "checkpoint_optional_agents": _non_empty_str_list(checkpoint_optional_agents),
        "context_doc_count": len(doc_uris),
        "message": resolved_message,
    }


def build_lifecycle_adk_event(
    *,
    phase: str,
    invocation_id: str = "",
    session_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    primary_agent: Optional[str] = None,
    checkpoint_ids: Optional[list[str]] = None,
    checkpoint_optional_agents: Optional[list[str]] = None,
    context_doc_uris: Optional[list[str]] = None,
    branch: Optional[str] = None,
) -> Event:
    """ADK ``Event`` for multiplex / runner yield."""
    payload = build_lifecycle_payload(
        phase,
        session_id=session_id,
        correlation_id=correlation_id,
        invocation_id=invocation_id or None,
        primary_agent=primary_agent,
        checkpoint_ids=checkpoint_ids,
        checkpoint_optional_agents=checkpoint_optional_agents,
        context_doc_uris=context_doc_uris,
    )
    message = str(payload.get("message") or "")
    return Event(
        invocation_id=invocation_id,
        author=LIFECYCLE_EVENT_AUTHOR,
        branch=branch,
        content=types.Content(role="model", parts=[types.Part(text=message)]),
        actions=EventActions(state_delta={LIFECYCLE_STATE_DELTA_KEY: payload}),
    )


def build_lifecycle_engine_dict(
    *,
    phase: str,
    session_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    invocation_id: Optional[str] = None,
    primary_agent: Optional[str] = None,
    checkpoint_ids: Optional[list[str]] = None,
    checkpoint_optional_agents: Optional[list[str]] = None,
    context_doc_uris: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Reasoning Engine stream dict (``async_stream_query`` yield)."""
    payload = build_lifecycle_payload(
        phase,
        session_id=session_id,
        correlation_id=correlation_id,
        invocation_id=invocation_id,
        primary_agent=primary_agent,
        checkpoint_ids=checkpoint_ids,
        checkpoint_optional_agents=checkpoint_optional_agents,
        context_doc_uris=context_doc_uris,
    )
    message = str(payload.get("message") or "")
    return {
        "author": LIFECYCLE_EVENT_AUTHOR,
        "invocation_id": invocation_id or "",
        "content": {"role": "model", "parts": [{"text": message}]},
        "actions": {"state_delta": {LIFECYCLE_STATE_DELTA_KEY: payload}},
    }


def log_lifecycle_payload(payload: Mapping[str, Any]) -> None:
    logger.info(
        "HOMEAPP_LIFECYCLE phase=%s elapsed_ms=%s correlation_id=%s session_id=%s invocation_id=%s",
        payload.get("phase"),
        payload.get("elapsed_ms"),
        payload.get("correlation_id") or "-",
        payload.get("session_id") or "-",
        payload.get("invocation_id") or "-",
    )


def _context_fields_from_message(message: Any) -> dict[str, Any]:
    if isinstance(message, str):
        try:
            import json

            message = json.loads(message)
        except json.JSONDecodeError:
            return {}
    if not isinstance(message, dict):
        return {}
    optional = message.get("checkpoint_optional_agents")
    agents: list[str] = []
    if isinstance(optional, list):
        agents = [str(a) for a in optional if a]
    cp_ids = message.get("checkpoint_ids")
    ids: list[str] = []
    if isinstance(cp_ids, list):
        ids = [str(c) for c in cp_ids if c]
    doc_uris = message.get("context_doc_uris")
    uris: list[str] = []
    if isinstance(doc_uris, list):
        uris = [str(u) for u in doc_uris if u]
    return {
        "correlation_id": message.get("correlation_id"),
        "primary_agent": message.get("primary_agent"),
        "checkpoint_ids": ids,
        "checkpoint_optional_agents": agents,
        "context_doc_uris": uris,
    }


def context_fields_from_stream_message(message: Any) -> dict[str, Any]:
    return _context_fields_from_message(message)


def _state_get(state: Any, key: str) -> Any:
    if state is None:
        return None
    if isinstance(state, dict):
        return state.get(key)
    getter = getattr(state, "get", None)
    if callable(getter):
        return getter(key)
    return getattr(state, key, None)


def lifecycle_context_from_invocation(invocation_context: Any) -> dict[str, Any]:
    """Read correlation / routing fields from invocation session state."""
    session = getattr(invocation_context, "session", None)
    session_id = getattr(session, "id", None) if session is not None else None
    state = getattr(invocation_context, "state", None)
    if state is None and session is not None:
        state = getattr(session, "state", None)
    raw_agents = _state_get(state, "checkpoint_optional_agents")
    agents: Optional[list[str]] = None
    if isinstance(raw_agents, list):
        agents = [str(a) for a in raw_agents if a]
    raw_ids = _state_get(state, "checkpoint_ids")
    cp_ids: Optional[list[str]] = None
    if isinstance(raw_ids, list):
        cp_ids = [str(c) for c in raw_ids if c]
    correlation_id = _state_get(state, "correlation_id")
    primary_agent = _state_get(state, "primary_agent")
    return {
        "session_id": str(session_id) if session_id else None,
        "correlation_id": str(correlation_id) if correlation_id else None,
        "primary_agent": str(primary_agent) if primary_agent else None,
        "checkpoint_ids": cp_ids,
        "checkpoint_optional_agents": agents,
        "context_doc_uris": None,
    }


def enqueue_lifecycle_event(
    invocation_context: Any,
    *,
    phase: str,
    session_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    primary_agent: Optional[str] = None,
    checkpoint_ids: Optional[list[str]] = None,
    checkpoint_optional_agents: Optional[list[str]] = None,
    context_doc_uris: Optional[list[str]] = None,
) -> bool:
    """Enqueue lifecycle on the checkpoint progress queue (sync-safe ``put_nowait``)."""
    from property_agent.checkpoint.progress_stream import (
        checkpoint_progress_streaming_enabled,
        get_checkpoint_progress_queue,
        init_checkpoint_progress_queue,
    )

    if not checkpoint_progress_streaming_enabled():
        return False

    inv_id = str(getattr(invocation_context, "invocation_id", "") or "")
    queue = get_checkpoint_progress_queue(invocation_context)
    if queue is None:
        queue = init_checkpoint_progress_queue(invocation_context)
    if queue is None:
        return False

    event = build_lifecycle_adk_event(
        phase=phase,
        invocation_id=inv_id,
        session_id=session_id,
        correlation_id=correlation_id,
        primary_agent=primary_agent,
        checkpoint_ids=checkpoint_ids,
        checkpoint_optional_agents=checkpoint_optional_agents,
        context_doc_uris=context_doc_uris,
        branch=getattr(invocation_context, "branch", None),
    )
    try:
        queue.put_nowait(event)
    except Exception:
        logger.exception("lifecycle enqueue failed phase=%s", phase)
        return False
    delta = getattr(getattr(event, "actions", None), "state_delta", None) or {}
    payload = delta.get(LIFECYCLE_STATE_DELTA_KEY) if isinstance(delta, dict) else None
    if isinstance(payload, dict):
        log_lifecycle_payload(payload)
    return True


def emit_lifecycle_from_callback(
    callback_context: Any,
    *,
    phase: str,
    state_key: str,
) -> None:
    """Emit once per invocation (guarded by ``state_key`` on session state)."""
    state = getattr(callback_context, "state", None)
    if state is not None and _state_get(state, state_key):
        return

    correlation_id = None
    primary_agent = None
    checkpoint_optional_agents: Optional[list[str]] = None
    checkpoint_ids: Optional[list[str]] = None
    if state is not None:
        correlation_id = _state_get(state, "correlation_id")
        primary_agent = _state_get(state, "primary_agent")
        raw = _state_get(state, "checkpoint_optional_agents")
        if isinstance(raw, list):
            checkpoint_optional_agents = [str(a) for a in raw if a]
        raw_ids = _state_get(state, "checkpoint_ids")
        if isinstance(raw_ids, list):
            checkpoint_ids = [str(c) for c in raw_ids if c]

    inv_ctx = getattr(callback_context, "_invocation_context", None) or callback_context
    session_id = getattr(callback_context, "session_id", None)
    enqueued = enqueue_lifecycle_event(
        inv_ctx,
        phase=phase,
        session_id=str(session_id) if session_id else None,
        correlation_id=str(correlation_id) if correlation_id else None,
        primary_agent=str(primary_agent) if primary_agent else None,
        checkpoint_ids=checkpoint_ids,
        checkpoint_optional_agents=checkpoint_optional_agents,
    )
    if enqueued and state is not None:
        if isinstance(state, dict):
            state[state_key] = True
        else:
            setattr(state, state_key, True)
