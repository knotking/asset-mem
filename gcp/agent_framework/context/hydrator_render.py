"""Render ``HydratedContext`` (ContextHydratorV1 output) into prompt blocks."""

from __future__ import annotations

from agent_framework.contracts.v1 import HydratedContext


def render_hydrated_context_blocks(hydrated: HydratedContext) -> list[str]:
    """Ordered prompt segments: compacted summary, then retrieved snippets."""

    blocks: list[str] = []
    summary = hydrated.compacted_summary
    if summary and summary.strip():
        blocks.append(summary.strip())
    for snippet in hydrated.retrieved:
        text = snippet.text.strip()
        if text:
            blocks.append(text)
    return blocks


def render_hydrated_context(hydrated: HydratedContext) -> str:
    """Single string for injection into resolve / executor prompts."""

    return "\n\n".join(render_hydrated_context_blocks(hydrated))
