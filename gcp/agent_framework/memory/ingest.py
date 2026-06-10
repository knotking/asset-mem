"""Generic Vertex AI Memory Bank ingest helpers."""

from __future__ import annotations

import os
from typing import Any, Optional, Protocol, Sequence

from google.adk.events.event import Event


def truthy_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def memory_ingest_enabled() -> bool:
    return truthy_env("ADK_MEMORY_INGEST_ENABLED", default=False)


def memory_preload_enabled() -> bool:
    return truthy_env("ADK_MEMORY_PRELOAD_ENABLED", default=False)


def memory_force_flush() -> bool:
    return truthy_env("ADK_MEMORY_FORCE_FLUSH", default=True)


def stream_prefix() -> str:
    return os.getenv("ADK_MEMORY_STREAM_PREFIX", "").strip()


def memory_stream_id(*, property_id: Optional[str]) -> str:
    prefix = stream_prefix()
    if property_id:
        return (
            f"{prefix}property:{property_id}" if prefix else f"property:{property_id}"
        )
    return f"{prefix}user-general" if prefix else "user-general"


class MemoryStreamResolver(Protocol):
    """Vertical supplies stream id from session state."""

    def resolve_stream_id(self, state: Any) -> str: ...


def event_has_text(event: Event) -> bool:
    if not event.content or not event.content.parts:
        return False
    for part in event.content.parts:
        if part.text and part.text.strip():
            return True
    return False


def is_memory_ingest_candidate(
    event: Event,
    *,
    skip_authors: frozenset[str] = frozenset(),
) -> bool:
    if event.actions and event.actions.compaction:
        return False
    if event.get_function_calls() or event.get_function_responses():
        return False
    if event.partial:
        return False
    if event.author in skip_authors:
        return False
    return event_has_text(event)


def select_events_for_memory_ingest(
    events: Sequence[Event],
    *,
    invocation_id: str,
    allowed_authors: frozenset[str],
    skip_authors: frozenset[str] = frozenset(),
) -> list[Event]:
    """Return user/model text events for the current invocation only."""
    candidates: list[Event] = []
    for event in events:
        if event.invocation_id != invocation_id:
            continue
        if event.author not in allowed_authors:
            continue
        if not is_memory_ingest_candidate(event, skip_authors=skip_authors):
            continue
        candidates.append(event)

    user_events = [e for e in candidates if e.author == "user"]
    model_events = [e for e in candidates if e.author != "user"]
    selected: list[Event] = []
    if user_events:
        selected.append(user_events[-1])
    if model_events:
        selected.append(model_events[-1])
    return selected


def build_ingest_custom_metadata(*, stream_id: str) -> dict[str, object]:
    metadata: dict[str, object] = {"stream_id": stream_id}
    if memory_force_flush():
        metadata["force_flush"] = True
    else:
        metadata["generation_trigger_config"] = {
            "generation_rule": {
                "idle_duration": os.getenv("ADK_MEMORY_IDLE_DURATION", "60s")
            }
        }
    return metadata


def invocation_used_agent(
    session_events: Sequence[Event],
    invocation_id: str,
    *,
    agent_names: frozenset[str],
) -> bool:
    for event in session_events:
        if event.invocation_id != invocation_id:
            continue
        if event.author in agent_names:
            return True
    return False
