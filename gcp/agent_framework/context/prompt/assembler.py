"""Deterministic prompt/context assembly helpers (production prompt blocks)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class AssemblyBudget:
    """Character-based budget for deterministic prompt assembly."""

    max_chars: int


def clip_text(text: str, *, max_chars: int) -> str:
    """Deterministically clip text to max_chars with ellipsis."""

    if max_chars <= 0:
        return ""
    if len(text) <= max_chars:
        return text
    if max_chars <= 1:
        return text[:max_chars]
    return text[: max_chars - 1].rstrip() + "…"


def join_segments_with_budget(
    segments: Iterable[str],
    *,
    budget: AssemblyBudget,
    separator: str = "\n\n",
) -> str:
    """Join ordered segments and clip once against a global character budget."""

    combined = separator.join(s for s in segments if s)
    return clip_text(combined, max_chars=budget.max_chars)

