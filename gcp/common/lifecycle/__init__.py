"""Request lifecycle events for proxy ↔ Agent Engine streaming."""

from common.lifecycle.events import (
    LIFECYCLE_EVENT_AUTHOR,
    LIFECYCLE_SSE_PREFIX,
    LIFECYCLE_STATE_DELTA_KEY,
    PHASE_ENGINE_BEFORE_MODEL,
    PHASE_ENGINE_RUNNER_EXEC,
    PHASE_ENGINE_TURN_STARTED,
    PHASE_PROXY_ENGINE_INVOKE,
    PHASE_PROXY_REQUEST_ACCEPTED,
    build_lifecycle_payload,
    default_message_for_phase,
    extract_lifecycle_payload,
    format_lifecycle_sse_line,
    is_lifecycle_author,
    is_lifecycle_stream_event,
    log_lifecycle_payload,
    parse_lifecycle_sse_chunk,
)

__all__ = [
    "LIFECYCLE_EVENT_AUTHOR",
    "LIFECYCLE_SSE_PREFIX",
    "LIFECYCLE_STATE_DELTA_KEY",
    "PHASE_ENGINE_BEFORE_MODEL",
    "PHASE_ENGINE_RUNNER_EXEC",
    "PHASE_ENGINE_TURN_STARTED",
    "PHASE_PROXY_ENGINE_INVOKE",
    "PHASE_PROXY_REQUEST_ACCEPTED",
    "build_lifecycle_payload",
    "default_message_for_phase",
    "extract_lifecycle_payload",
    "format_lifecycle_sse_line",
    "is_lifecycle_author",
    "is_lifecycle_stream_event",
    "log_lifecycle_payload",
    "parse_lifecycle_sse_chunk",
]
