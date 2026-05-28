"""Reusable helpers for agent step state management."""

from __future__ import annotations

import time
from typing import Any, Callable


def merge_step_update(
    agent_steps_by_name: dict[str, dict[str, Any]],
    update: dict[str, Any],
    *,
    now_ms: int | None = None,
) -> None:
    """Merge an incoming step update while preserving stable display semantics."""

    name = update.get("name")
    if not name:
        return

    if now_ms is None:
        now_ms = int(time.time() * 1000)

    previous = agent_steps_by_name.get(name, {})
    merged: dict[str, Any] = {**previous, **update}

    if "startedAt" not in merged:
        merged["startedAt"] = now_ms
    if merged.get("status") in ("completed", "failed") and not merged.get("completedAt"):
        merged["completedAt"] = now_ms
    if not merged.get("preview") and previous.get("preview"):
        merged["preview"] = previous["preview"]
    if previous.get("displayName"):
        merged["displayName"] = previous["displayName"]

    agent_steps_by_name[str(name)] = merged


def complete_pending_specialists(
    agent_steps_by_name: dict[str, dict[str, Any]],
    specialist_names: set[str],
    *,
    display_name_for: Callable[[str], str],
    now_ms: int | None = None,
) -> None:
    """Complete any still-executing specialist rows after rollup completion."""

    for agent_name in specialist_names:
        step = agent_steps_by_name.get(agent_name)
        if not step or step.get("status") != "executing":
            continue
        merge_step_update(
            agent_steps_by_name,
            {
                "name": agent_name,
                "status": "completed",
                "displayName": step.get("displayName") or display_name_for(agent_name),
            },
            now_ms=now_ms,
        )

