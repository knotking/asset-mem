"""Message patch state_delta helpers for checkpoint pipeline (V2)."""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from property_agent.bindings.state_merge import merge_homecare_state_delta
from property_agent.checkpoint.constants import (
    CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY,
    CHECKPOINT_ANALYSIS_STATE_KEY,
    CHECKPOINT_BRANCH_COMPLETED_STATE_KEY,
)
from property_agent.runtime.session_diet import filter_state_delta_for_session_storage


def build_message_patch_delta(
    *,
    content_json: Optional[Dict[str, Any]],
    content_markdown: str,
    analysis_run_id: Optional[str] = None,
    checkpoint_branch_completed: Optional[str] = None,
) -> Dict[str, Any]:
    delta: Dict[str, Any] = {
        "contentMarkdown": content_markdown,
    }
    if content_json is not None:
        delta["contentJson"] = content_json
    if analysis_run_id:
        delta["analysisRunId"] = analysis_run_id
    if checkpoint_branch_completed:
        delta[CHECKPOINT_BRANCH_COMPLETED_STATE_KEY] = checkpoint_branch_completed
    return delta


def stash_checkpoint_analysis_in_state(
    state: Any,
    content_json: Dict[str, Any],
    *,
    content_markdown: str = "",
) -> None:
    if not hasattr(state, "__setitem__"):
        return
    state[CHECKPOINT_ANALYSIS_STATE_KEY] = content_json
    if content_markdown:
        state[CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY] = content_markdown


def apply_tool_context_state_delta(tool_context: Any, delta: Dict[str, Any]) -> None:
    """Write session fields and merge into outgoing tool ``state_delta`` for parent sync."""
    if not delta or tool_context is None:
        return

    session_delta = filter_state_delta_for_session_storage(delta)
    state = getattr(tool_context, "state", None)
    if state is not None and hasattr(state, "update") and session_delta:
        state.update(session_delta)

    content_json = delta.get("contentJson")
    if isinstance(content_json, dict):
        stash_checkpoint_analysis_in_state(
            state,
            content_json,
            content_markdown=str(delta.get("contentMarkdown") or ""),
        )

    actions = getattr(tool_context, "actions", None)
    if actions is None:
        return
    existing = getattr(actions, "state_delta", None)
    if isinstance(existing, dict):
        actions.state_delta = merge_homecare_state_delta(existing, delta)
    else:
        actions.state_delta = merge_homecare_state_delta(None, delta)


def new_analysis_run_id() -> str:
    return str(uuid.uuid4())
