from __future__ import annotations

from typing import Iterable, List, Sequence


ANALYSIS_OPTIONAL_AGENT_ORDER: List[str] = ["coverage", "diy", "service", "cost"]
_OPTIONAL_AGENT_SET = set(ANALYSIS_OPTIONAL_AGENT_ORDER)

CHECKPOINT_OPTIONAL_AGENT_ORDER: List[str] = ["coverage", "diy", "service", "cost"]
_CHECKPOINT_OPTIONAL_AGENT_SET = set(CHECKPOINT_OPTIONAL_AGENT_ORDER)


def normalize_analysis_optional_agents(value: Sequence[str] | str | None) -> List[str]:
    """
    Normalizes the analysis_optional_agents field to an ordered list of allowed agent identifiers.
    Defaults to the full optional agent order when the input is missing, empty, or invalid.
    """
    if value is None:
        return ANALYSIS_OPTIONAL_AGENT_ORDER.copy()

    candidates: Iterable[str]
    if isinstance(value, str):
        candidates = [value]
    else:
        candidates = value

    normalized: List[str] = []
    for candidate in candidates:
        if isinstance(candidate, str):
            key = candidate.strip().lower()
            if key in _OPTIONAL_AGENT_SET and key not in normalized:
                normalized.append(key)

    if not normalized:
        return ANALYSIS_OPTIONAL_AGENT_ORDER.copy()

    ordered = [agent for agent in ANALYSIS_OPTIONAL_AGENT_ORDER if agent in normalized]
    return ordered if ordered else ANALYSIS_OPTIONAL_AGENT_ORDER.copy()


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

