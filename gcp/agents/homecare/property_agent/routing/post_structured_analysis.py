"""Helpers after optional-branch checkpoint analysis (synthesis + contentJson)."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from .optional_branches import OPTIONAL_CHECKPOINT_BRANCHES
from .pending_user_action import PendingUserAction


def structured_analysis_ran(
    args: Mapping[str, Any] | None,
    tool_response: Any,
    state: Any,
) -> bool:
    """True when ``analyze_checkpoints`` actually executed optional branches.

    Keyed on the post-guard tool args and pipeline output, not resolved intent:
    tool guards may filter the requested branches to ``[]`` (retrieval-only run)
    or short-circuit with a ``Skipped:``/blocked result, in which case the
    post-synthesis executor hop must still run.
    """
    if not isinstance(args, Mapping) or not args.get("branches"):
        return False
    if isinstance(tool_response, Mapping):
        result = tool_response.get("result")
        if isinstance(result, str) and result.startswith("Skipped:"):
            return False
    return bool(state and state.get("checkpoint_parallel_results"))


def run_branch_names_from_content_json(
    content_json: Mapping[str, Any] | None,
) -> list[str]:
    if not content_json:
        return []
    branches: list[str] = []
    for item in content_json.get("suggestedActions") or []:
        if not isinstance(item, dict):
            continue
        action = item.get("action") or {}
        if action.get("type") != "run_branch":
            continue
        branch = str(action.get("branch") or "").strip().lower()
        if branch in OPTIONAL_CHECKPOINT_BRANCHES and branch not in branches:
            branches.append(branch)
    return branches


def run_branch_names_from_state(state: Mapping[str, Any] | None) -> list[str]:
    if not state:
        return []
    content_json = state.get("contentJson")
    if not isinstance(content_json, dict):
        return []
    return run_branch_names_from_content_json(content_json)


def brief_post_structured_analysis_reply(state: Mapping[str, Any] | None) -> Optional[str]:
    """Deterministic wrap-up when synthesis already streamed structured UI."""
    branches = run_branch_names_from_state(state)
    if branches:
        parts = ", ".join(f"**{b}**" for b in branches)
        return (
            f"I've completed the analysis above. "
            f"Would you like me to run {parts} analysis next?"
        )
    return "I've completed the analysis above."


def pending_from_suggested_actions(state: Any) -> Optional[PendingUserAction]:
    branches = run_branch_names_from_state(state)
    if not branches:
        return None
    labels: list[str] = []
    content_json = state.get("contentJson") if state else None
    if isinstance(content_json, dict):
        for item in content_json.get("suggestedActions") or []:
            if not isinstance(item, dict):
                continue
            action = item.get("action") or {}
            if action.get("type") != "run_branch":
                continue
            label = str(item.get("label") or action.get("branch") or "").strip()
            if label:
                labels.append(label)
    return PendingUserAction(
        kind="run_branch",
        expanded_user_query=f"Run {', '.join(branches)} analysis for this issue.",
        run_optional_agents=branches,
        offered_summary="; ".join(labels[:4]) or None,
    )
