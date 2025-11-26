from __future__ import annotations

from typing import Iterable, List, Optional, Sequence


ANALYSIS_OPTIONAL_AGENT_ORDER: List[str] = ["coverage", "diy", "service", "cost"]
_OPTIONAL_AGENT_SET = set(ANALYSIS_OPTIONAL_AGENT_ORDER)


def normalize_analysis_optional_agents(value: Sequence[str] | str | None) -> Optional[List[str]]:
    """
    Normalizes the analysis_optional_agents field to an ordered list of allowed agent identifiers.
    
    - Returns None when input is None (defaults to all agents)
    - Returns empty list when user explicitly provides empty list (only triage runs)
    - Returns ordered list of valid agents when user provides a non-empty list
    """
    # None means "use default" (all agents)
    if value is None:
        return None

    candidates: Iterable[str]
    if isinstance(value, str):
        candidates = [value]
    else:
        candidates = value

    # Convert to list to check if it's explicitly empty
    candidates_list = list(candidates)
    
    # Empty list means "only run triage, no optional agents"
    if len(candidates_list) == 0:
        return []

    normalized: List[str] = []
    for candidate in candidates_list:
        if isinstance(candidate, str):
            key = candidate.strip().lower()
            if key in _OPTIONAL_AGENT_SET and key not in normalized:
                normalized.append(key)

    # If user provided agents but none were valid, return empty (only triage)
    if not normalized:
        return []

    # Return in canonical order
    ordered = [agent for agent in ANALYSIS_OPTIONAL_AGENT_ORDER if agent in normalized]
    return ordered

