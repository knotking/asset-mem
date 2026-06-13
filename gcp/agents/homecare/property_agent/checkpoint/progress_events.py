"""ADK-visible checkpoint progress events."""

from __future__ import annotations

from typing import Any, Dict, Optional

from google.adk.events.event import Event

from agent_platform.adk.streaming.events import build_adk_progress_event

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
    return build_adk_progress_event(
        invocation_id=invocation_id,
        author=CHECKPOINT_PROGRESS_EVENT_AUTHOR,
        session_event_text=session_event_text,
        state_delta=state_delta,
        branch=branch,
        progress_text_state_key=CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY,
    )
