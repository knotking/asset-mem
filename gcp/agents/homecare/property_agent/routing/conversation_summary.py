"""Long-session conversation summary (optional; off by default in single-loop)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Mapping, Optional, Sequence

from agent_platform.core.model.response_text import json_from_generate_response
from agent_platform.core.ports import GenerateRequest

from ..model_config import flash_lite_model_client
from .analysis_digest import build_analysis_digest_blob
from .pending_user_action import get_pending_user_action
from .recent_dialogue import recent_dialogue

logger = logging.getLogger(__name__)

CONVERSATION_SUMMARY_STATE_KEY = "conversation_summary"
_SUMMARY_SOURCE_LINES_KEY = "_conversation_summary_source_lines"
_DEFAULT_LINE_THRESHOLD = 12
_RE_SUMMARIZE_DELTA = 4


def conversation_summary_enabled() -> bool:
    """Opt-in rolling summary; disabled by default (ADK compaction is primary)."""
    return os.getenv("HOMEAPP_CONVERSATION_SUMMARY", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )

_SUMMARY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "open_task": {"type": "string"},
        "branches_completed": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["summary"],
}

_SUMMARY_SYSTEM = """Summarize the property-care chat for routing context.
Output JSON only.
Preserve: pending user offers, which analysis branches ran, current user goal.
open_task: one line if user/agent left an unanswered offer or task; else empty string.
Keep summary under 400 words."""


def conversation_summary_from_state(state: Mapping[str, Any] | None) -> Optional[str]:
    if not state:
        return None
    raw = state.get(CONVERSATION_SUMMARY_STATE_KEY)
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def _task_context_blob(state: Mapping[str, Any]) -> dict[str, Any]:
    blob: dict[str, Any] = {}
    pending = get_pending_user_action(state)
    if pending is not None:
        blob["pending_user_action"] = pending.to_dict()
    digest = build_analysis_digest_blob(state)
    if digest:
        blob["analysis_digest"] = digest
    return blob


def maybe_update_conversation_summary(
    state: Any,
    session_events: Sequence[Any] | None,
    *,
    line_threshold: int = _DEFAULT_LINE_THRESHOLD,
) -> None:
    """Refresh rolling summary when dialogue grows (opt-in; ADK compaction is primary)."""
    if not conversation_summary_enabled():
        return
    if state is None or not hasattr(state, "__setitem__"):
        return
    dialogue = recent_dialogue(session_events, max_chars=5000)
    lines = [ln for ln in dialogue.splitlines() if ln.strip()]
    line_count = len(lines)
    if line_count < line_threshold:
        return
    prev_lines = state.get(_SUMMARY_SOURCE_LINES_KEY)
    try:
        prev_count = int(prev_lines) if prev_lines is not None else 0
    except (TypeError, ValueError):
        prev_count = 0
    if line_count - prev_count < _RE_SUMMARIZE_DELTA and state.get(CONVERSATION_SUMMARY_STATE_KEY):
        return

    task_blob = _task_context_blob(state)
    prior = state.get(CONVERSATION_SUMMARY_STATE_KEY)
    prompt = (
        f"{_SUMMARY_SYSTEM}\n\n"
        f"PRIOR_SUMMARY:\n{(prior or '(none)')}\n\n"
        f"TASK_STATE:\n{json.dumps(task_blob, indent=2)}\n\n"
        f"RECENT_DIALOGUE:\n{dialogue}\n"
    )
    client = flash_lite_model_client()
    try:
        response = client.generate(
            GenerateRequest(
                contents=prompt,
                temperature=0.1,
                max_output_tokens=512,
                response_mime_type="application/json",
                response_json_schema=_SUMMARY_SCHEMA,
            )
        )
    except Exception:
        logger.debug("conversation_summary: generate_content failed", exc_info=True)
        return
    raw = json_from_generate_response(response)
    if not raw:
        return
    summary = str(raw.get("summary") or "").strip()
    if not summary:
        return
    open_task = str(raw.get("open_task") or "").strip()
    if open_task:
        summary = f"{summary}\n\nOpen task: {open_task}"
    state[CONVERSATION_SUMMARY_STATE_KEY] = summary
    state[_SUMMARY_SOURCE_LINES_KEY] = line_count
    logger.info(
        "conversation_summary updated lines=%d chars=%d",
        line_count,
        len(summary),
    )
