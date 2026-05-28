"""Session-memory formatting helpers for prompt injection (production prompt blocks)."""

from __future__ import annotations

import json
from typing import Any, Mapping

from .assembler import AssemblyBudget, join_segments_with_budget


_DEFAULT_SESSION_MEMORY_MAX_CHARS = 12000


def format_session_working_memory_block_from_memory(
    memory: Mapping[str, Any] | None,
    *,
    max_chars: int = _DEFAULT_SESSION_MEMORY_MAX_CHARS,
) -> str:
    """Render the canonical [SESSION_WORKING_MEMORY] prompt block."""

    if not memory:
        return ""
    block = (
        "[SESSION_WORKING_MEMORY]\n"
        f"{json.dumps(dict(memory), indent=2)}\n"
        "[/SESSION_WORKING_MEMORY]\n"
        "Use this as ground truth for follow-up answers. Do not re-run tools unless "
        "the user asks for new external data or a branch not covered here."
    )
    return join_segments_with_budget((block,), budget=AssemblyBudget(max_chars=max_chars))

