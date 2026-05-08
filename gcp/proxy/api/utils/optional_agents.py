from __future__ import annotations

from typing import Iterable, List, Sequence

CHECKPOINT_OPTIONAL_AGENT_ORDER: List[str] = ["coverage", "diy", "service", "cost"]
_CHECKPOINT_OPTIONAL_AGENT_SET = set(CHECKPOINT_OPTIONAL_AGENT_ORDER)


def normalize_checkpoint_optional_agents(value: Sequence[str] | str | None) -> List[str]:
    """
    Normalizes the checkpoint_optional_agents field to an ordered list of allowed agent identifiers.
    Returns an empty list when the input is missing or empty (no agents selected).
    """
    if value is None:
        return []

    candidates: Iterable[str]
    if isinstance(value, str):
        candidates = [value]
    else:
        candidates = value

    normalized: List[str] = []
    for candidate in candidates:
        if isinstance(candidate, str):
            key = candidate.strip().lower()
            if key in _CHECKPOINT_OPTIONAL_AGENT_SET and key not in normalized:
                normalized.append(key)

    # Return empty list if no valid agents (unlike analysis which defaults to all)
    if not normalized:
        return []

    ordered = [agent for agent in CHECKPOINT_OPTIONAL_AGENT_ORDER if agent in normalized]
    return ordered

