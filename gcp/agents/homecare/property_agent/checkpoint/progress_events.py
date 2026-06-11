"""ADK-visible checkpoint progress events."""

from __future__ import annotations

from typing import Any, Dict, Optional

from google.adk.events.event import Event
from google.adk.events.event_actions import EventActions
from google.genai import types

from property_agent.checkpoint.constants import (
    CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY,
    CHECKPOINT_PROGRESS_EVENT_AUTHOR,
)


def build_checkpoint_progress_event(
    *,
    invocation_id: str,
    session_event_text: str,
    state_delta: Dict[str, Any],
    branch: Optional[str] = None,
) -> Event:
    """Model event with text + ``state_delta`` for proxy / ADK web chat."""
    delta = dict(state_delta)
    if session_event_text:
        delta[CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY] = session_event_text
    return Event(
        invocation_id=invocation_id,
        author=CHECKPOINT_PROGRESS_EVENT_AUTHOR,
        branch=branch,
        content=types.Content(
            role="model",
            parts=[types.Part(text=session_event_text)],
        ),
        actions=EventActions(state_delta=delta),
    )
