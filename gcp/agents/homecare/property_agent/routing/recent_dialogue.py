"""Shared recent-dialogue extraction for resolve and executor inject."""

from __future__ import annotations

from typing import Any, Optional, Sequence

_PROGRESS_EVENT_AUTHORS = frozenset(
    {
        "checkpoint_analysis_progress",
        "checkpoint_optional_agents_parallel_runner",
        "checkpoint_progress_synthesis_agent",
    }
)


def _event_text(event: Any) -> str:
    content = getattr(event, "content", None)
    if content is None:
        return ""
    parts = getattr(content, "parts", None) or []
    chunks: list[str] = []
    for part in parts:
        text = getattr(part, "text", None)
        if isinstance(text, str) and text.strip():
            chunks.append(text.strip())
    return "\n".join(chunks)


def is_heavy_dialogue_for_resolve(text: str) -> bool:
    stripped = (text or "").strip()
    if not stripped:
        return True
    if stripped.startswith("{") or "```json" in stripped:
        return True
    if "# Checkpoint" in stripped and "analysis" in stripped.lower() and len(stripped) > 600:
        return True
    return False


def recent_dialogue(
    session_events: Sequence[Any] | None,
    *,
    current_invocation_id: Optional[str] = None,
    max_chars: int = 2500,
) -> str:
    if not session_events:
        return ""
    lines: list[str] = []
    for event in reversed(list(session_events)):
        inv_id = getattr(event, "invocation_id", None)
        if current_invocation_id and inv_id == current_invocation_id:
            continue
        author = getattr(event, "author", None)
        if author in _PROGRESS_EVENT_AUTHORS:
            continue
        if author not in ("user", "property_agent", "model"):
            continue
        text = _event_text(event)
        if is_heavy_dialogue_for_resolve(text):
            continue
        role = "user" if author == "user" else "assistant"
        lines.append(f"{role}: {text[:350]}")
        if sum(len(x) for x in lines) >= max_chars:
            break
    lines.reverse()
    blob = "\n".join(lines)
    return blob[-max_chars:] if len(blob) > max_chars else blob


def last_assistant_ended_with_question(
    session_events: Sequence[Any] | None,
    *,
    current_invocation_id: Optional[str] = None,
) -> bool:
    if not session_events:
        return False
    for event in reversed(list(session_events)):
        inv_id = getattr(event, "invocation_id", None)
        if current_invocation_id and inv_id == current_invocation_id:
            continue
        author = getattr(event, "author", None)
        if author not in ("property_agent", "model"):
            continue
        text = _event_text(event)
        if not text or is_heavy_dialogue_for_resolve(text):
            continue
        stripped = text.rstrip()
        return stripped.endswith("?")
    return False
