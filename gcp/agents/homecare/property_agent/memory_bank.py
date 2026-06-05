"""Vertex AI Memory Bank ingest + configuration for property_agent."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional, Sequence

from property_agent.routing.schema import SessionStateLike

from google.adk.agents.callback_context import CallbackContext
from google.adk.events.event import Event
from google.genai import types

from agent_framework.memory.ingest import (
    build_ingest_custom_metadata,
    invocation_used_agent,
    memory_ingest_enabled,
    memory_preload_enabled,
    memory_stream_id as _platform_memory_stream_id,
    select_events_for_memory_ingest,
)

logger = logging.getLogger(__name__)

_JSON_FENCE_RE = re.compile(r"```json\s*\n?([\s\S]*?)```", re.IGNORECASE)

PROPERTY_AGENT_NAME = "property_agent"
ORCHESTRATOR_AGENT_NAMES = frozenset({PROPERTY_AGENT_NAME})
CHECKPOINT_ANALYSIS_STATE_KEY = "checkpoint_analysis"

_SKIP_MEMORY_AUTHORS = frozenset(
    {
        CHECKPOINT_ANALYSIS_STATE_KEY,
        "checkpoint_analysis_progress",
    }
)


def resolve_property_id(state: SessionStateLike | None) -> Optional[str]:
    if not state:
        return None
    for key in ("property_id", "app:property_id"):
        value = state.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def memory_stream_id(*, property_id: Optional[str]) -> str:
    return _platform_memory_stream_id(property_id=property_id)


def _analysis_from_state(state: SessionStateLike) -> dict[str, Any] | None:
    raw = state.get(CHECKPOINT_ANALYSIS_STATE_KEY)
    if isinstance(raw, dict):
        inner = raw.get("analysis")
        return inner if isinstance(inner, dict) else raw
    if isinstance(raw, str) and raw.strip():
        match = _JSON_FENCE_RE.search(raw)
        if match:
            try:
                payload = json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                return None
            if isinstance(payload, dict):
                inner = payload.get("analysis")
                return inner if isinstance(inner, dict) else None
    return None


def _checkpoint_analysis_memory_facts(state: SessionStateLike) -> list[str]:
    """Optional Tier-B facts from assembled checkpoint analysis."""
    analysis = _analysis_from_state(state)
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
        skip_authors=_SKIP_MEMORY_AUTHORS,
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


def invocation_used_orchestrator(
    session_events: Sequence[Event], invocation_id: str
) -> bool:
    return invocation_used_agent(
        session_events,
        invocation_id,
        agent_names=ORCHESTRATOR_AGENT_NAMES,
    )


# Re-export for manifest / plugin consumers.
__all__ = [
    "ingest_invocation_to_memory_bank",
    "invocation_used_orchestrator",
    "memory_ingest_enabled",
    "memory_preload_enabled",
    "memory_stream_id",
    "resolve_property_id",
]
