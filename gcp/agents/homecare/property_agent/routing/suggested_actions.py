"""Suggested action chips emitted in contentJson for client quick-replies."""

from __future__ import annotations

from typing import Any

from .optional_branches import OPTIONAL_CHECKPOINT_BRANCHES

_BRANCH_LABELS: dict[str, str] = {
    "coverage": "Run coverage analysis",
    "diy": "Explain DIY steps",
    "service": "Find local providers",
    "cost": "Run cost analysis",
}

_BRANCH_QUERIES: dict[str, str] = {
    "coverage": "Run coverage analysis for this issue",
    "diy": "What are the DIY steps for this repair?",
    "service": "Find local service providers for this repair",
    "cost": "Run cost analysis and compare DIY vs professional",
}


def _branches_completed(analysis: dict[str, Any]) -> set[str]:
    status = analysis.get("analysisStatus")
    if isinstance(status, dict):
        return {
            str(b)
            for b, st in status.items()
            if str(st).lower() == "completed" and b in OPTIONAL_CHECKPOINT_BRANCHES
        }
    completed: set[str] = set()
    for branch in OPTIONAL_CHECKPOINT_BRANCHES:
        if branch == "coverage" and analysis.get("coverageResult"):
            completed.add(branch)
        if branch == "diy" and analysis.get("diyResults"):
            completed.add(branch)
        if branch == "service" and analysis.get("serviceResults"):
            completed.add(branch)
        if branch == "cost" and analysis.get("costEstimationResults"):
            completed.add(branch)
    return completed


def build_suggested_actions_for_analysis(analysis: dict[str, Any]) -> list[dict[str, Any]]:
    """Deterministic chip suggestions from assembled analysis status.

    Each chip carries a structured ``action`` object; clients echo it back as
    ``chip_action`` for deterministic routing (zero resolve-LLM call). The
    ``userQuery``/``chatIntent`` text path stays for older clients.
    """
    if not isinstance(analysis, dict):
        return []
    completed = _branches_completed(analysis)
    actions: list[dict[str, Any]] = []

    if "cost" in completed and "diy" in completed:
        actions.append(
            {
                "label": "Compare DIY vs professional",
                "userQuery": "Compare DIY and professional repair options for this issue",
                "chatIntent": "discuss_analysis",
                "action": {"type": "discuss", "topic": "cost"},
            }
        )
    elif "diy" in completed:
        actions.append(
            {
                "label": "Explain DIY steps",
                "userQuery": "Can you explain the DIY steps in more detail?",
                "chatIntent": "discuss_analysis",
                "action": {"type": "discuss", "topic": "diy"},
            }
        )
    elif "cost" in completed:
        actions.append(
            {
                "label": "Explain cost estimate",
                "userQuery": "Can you explain the cost estimate breakdown?",
                "chatIntent": "discuss_analysis",
                "action": {"type": "discuss", "topic": "cost"},
            }
        )

    for branch in OPTIONAL_CHECKPOINT_BRANCHES:
        if branch in completed:
            continue
        actions.append(
            {
                "label": _BRANCH_LABELS.get(branch, f"Run {branch}"),
                "userQuery": _BRANCH_QUERIES.get(branch, f"Run {branch} analysis"),
                "chatIntent": "new_analysis",
                "action": {"type": "run_branch", "branch": branch},
            }
        )
        if len(actions) >= 4:
            break

    if completed and len(actions) < 4:
        actions.append(
            {
                "label": "Show full analysis",
                "userQuery": "Show me the full analysis again",
                "chatIntent": "replay_analysis",
                "action": {"type": "replay_analysis"},
            }
        )

    return actions[:4]


def merge_suggested_actions_into_content_json(
    content_json: dict[str, Any],
    analysis: dict[str, Any],
) -> dict[str, Any]:
    out = dict(content_json)
    actions = build_suggested_actions_for_analysis(analysis)
    if actions:
        out["suggestedActions"] = actions
    return out
