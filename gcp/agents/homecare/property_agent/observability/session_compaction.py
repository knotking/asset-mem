"""Observability for ADK post-invocation session event compaction."""

from __future__ import annotations

import logging
from typing import Any, Sequence

logger = logging.getLogger(__name__)


def compaction_event_count(events: Sequence[Any] | None) -> int:
    """Count session events whose actions carry ADK compaction metadata."""
    if not events:
        return 0
    count = 0
    for event in events:
        actions = getattr(event, "actions", None)
        if actions is not None and getattr(actions, "compaction", None) is not None:
            count += 1
    return count


def _summary_chars(events: Sequence[Any] | None, *, after_index: int) -> int:
    if not events or after_index >= len(events):
        return 0
    event = events[after_index]
    actions = getattr(event, "actions", None)
    compaction = getattr(actions, "compaction", None) if actions else None
    content = getattr(compaction, "compacted_content", None) if compaction else None
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return 0
    total = 0
    for part in parts:
        text = getattr(part, "text", None)
        if text:
            total += len(str(text))
    return total


def log_compaction_applied(
    *,
    session_id: str | None,
    events_before: int,
    events_after: int,
    session_events: Sequence[Any] | None,
    token_threshold: int | None,
    event_retention_size: int | None,
) -> None:
    """Emit INFO when ADK appended one or more compaction events this invocation."""
    added = events_after - events_before
    if added <= 0:
        return
    summary_chars = _summary_chars(session_events, after_index=events_after - 1)
    logger.info(
        "adk_session_compaction applied session_id=%s compaction_events_added=%d "
        "compaction_events_total=%d summary_chars=%d token_threshold=%s "
        "event_retention_size=%s",
        session_id or "-",
        added,
        events_after,
        summary_chars,
        token_threshold if token_threshold is not None else "-",
        event_retention_size if event_retention_size is not None else "-",
    )
