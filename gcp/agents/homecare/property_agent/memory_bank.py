"""Vertex AI Memory Bank ingest + configuration for property_agent."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Mapping, Optional, Sequence

from google.adk.agents.callback_context import CallbackContext
from google.adk.events.event import Event
from google.genai import types

logger = logging.getLogger(__name__)

_JSON_FENCE_RE = re.compile(r"```json\s*\n?([\s\S]*?)```", re.IGNORECASE)

DOCULINK_AGENT_NAME = "doculink_agent"
PROPERTY_AGENT_NAME = "property_agent"
CHECKPOINT_DUAL_FORMAT_STATE_KEY = "checkpoint_analysis_dual_format"


def _truthy_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    return str(raw).strip().lower() in ("1", "true", "yes")


def memory_ingest_enabled() -> bool:
    return _truthy_env("ADK_MEMORY_INGEST_ENABLED", default=True)


def memory_preload_enabled() -> bool:
    return _truthy_env("ADK_MEMORY_PRELOAD_ENABLED", default=True)


def memory_force_flush() -> bool:
    return _truthy_env("ADK_MEMORY_FORCE_FLUSH", default=True)


def _stream_prefix() -> str:
    return os.getenv("ADK_MEMORY_STREAM_PREFIX", "").strip()


def resolve_property_id(state: Mapping[str, Any] | None) -> Optional[str]:
    if not state:
        return None
    for key in ("property_id", "app:property_id"):
        value = state.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def memory_stream_id(*, property_id: Optional[str]) -> str:
    prefix = _stream_prefix()
    if property_id:
        return f"{prefix}property:{property_id}" if prefix else f"property:{property_id}"
    return f"{prefix}user-general" if prefix else "user-general"


def _event_has_text(event: Event) -> bool:
    if not event.content or not event.content.parts:
        return False
    for part in event.content.parts:
        if part.text and part.text.strip():
            return True
    return False


def _is_memory_ingest_candidate(event: Event) -> bool:
    if event.actions and event.actions.compaction:
        return False
    if event.actions and event.actions.transfer_to_agent:
        return False
    if event.get_function_calls() or event.get_function_responses():
        return False
    if event.partial:
        return False
    if event.author == CHECKPOINT_DUAL_FORMAT_STATE_KEY:
        return False
    if event.author == "checkpoint_analysis_progress":
        return False
    return _event_has_text(event)


def select_events_for_memory_ingest(
    events: Sequence[Event],
    *,
    invocation_id: str,
    allowed_authors: frozenset[str],
) -> list[Event]:
    """Return user/model text events for the current invocation only."""
    candidates: list[Event] = []
    for event in events:
        if event.invocation_id != invocation_id:
            continue
        if event.author not in allowed_authors:
            continue
        if not _is_memory_ingest_candidate(event):
            continue
        candidates.append(event)

    # Prefer one user turn and the last model text from allowed authors.
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
            "generation_rule": {"idle_duration": os.getenv("ADK_MEMORY_IDLE_DURATION", "60s")}
        }
    return metadata


def _checkpoint_analysis_memory_facts(state: Mapping[str, Any]) -> list[str]:
    """Optional Tier-B facts from checkpoint analysis stash."""
    raw = state.get(CHECKPOINT_DUAL_FORMAT_STATE_KEY)
    if not isinstance(raw, str) or not raw.strip():
        return []

    match = _JSON_FENCE_RE.search(raw)
    if not match:
        return []

    try:
        payload = json.loads(match.group(1).strip())
    except json.JSONDecodeError:
        return []

    analysis = payload.get("analysis") if isinstance(payload, dict) else None
    if not isinstance(analysis, dict):
        return []

    title = analysis.get("title")
    if not isinstance(title, str) or not title.strip():
        return []

    property_id = resolve_property_id(state)
    scope = f"property {property_id}" if property_id else "property"
    return [f"{scope}: checkpoint analysis — {title.strip()}"]


async def ingest_invocation_to_memory_bank(
    callback_context: CallbackContext,
    *,
    agent_name: str,
    include_checkpoint_facts: bool = False,
) -> None:
    """Ingest filtered invocation events into Vertex AI Memory Bank."""
    if not memory_ingest_enabled():
        return

    invocation = callback_context._invocation_context
    if invocation.memory_service is None:
        logger.debug("memory ingest skipped: no memory_service agent=%s", agent_name)
        return

    session = invocation.session
    invocation_id = invocation.invocation_id
    allowed = frozenset({agent_name, "user"})
    events = select_events_for_memory_ingest(
        session.events,
        invocation_id=invocation_id,
        allowed_authors=allowed,
    )
    if not events:
        logger.debug(
            "memory ingest skipped: no text events invocation=%s agent=%s",
            invocation_id,
            agent_name,
        )
        return

    state = callback_context.state
    property_id = resolve_property_id(state)
    stream_id = memory_stream_id(property_id=property_id)
    metadata = build_ingest_custom_metadata(stream_id=stream_id)

    await callback_context.add_events_to_memory(
        events=events,
        custom_metadata=metadata,
    )
    logger.info(
        "memory ingest queued events=%s stream_id=%s agent=%s property_id=%s",
        len(events),
        stream_id,
        agent_name,
        property_id or "-",
    )

    if include_checkpoint_facts:
        facts = _checkpoint_analysis_memory_facts(state)
        if not facts:
            return
        # Use ingest_events path so local InMemoryMemoryService works (no add_memory).
        fact_events = [
            Event(
                invocation_id=invocation_id,
                author=agent_name,
                content=types.Content(
                    role="model",
                    parts=[types.Part(text=fact)],
                ),
            )
            for fact in facts
        ]
        await callback_context.add_events_to_memory(
            events=fact_events,
            custom_metadata=metadata,
        )
        logger.info(
            "memory ingest checkpoint facts=%s stream_id=%s",
            len(facts),
            stream_id,
        )


def invocation_used_doculink(session_events: Sequence[Event], invocation_id: str) -> bool:
    for event in session_events:
        if event.invocation_id != invocation_id:
            continue
        if event.author == DOCULINK_AGENT_NAME:
            return True
        if event.actions and event.actions.transfer_to_agent == DOCULINK_AGENT_NAME:
            return True
    return False
