"""Property analysis context for unified routing and orchestrator gating."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from .conversational_intent import OPTIONAL_CHECKPOINT_BRANCHES
from .query_mode import prior_analysis_branches_completed


def property_analysis_routing_blob(
    state: Mapping[str, Any] | None,
    *,
    user_id: Optional[str] = None,
    property_id: Optional[str] = None,
) -> dict[str, Any]:
    """Compact branch status for resolve_turn_llm INPUT_JSON."""
    _ = (user_id, property_id)
    completed = sorted(prior_analysis_branches_completed(state))
    return {
        "branches_completed": completed,
    }


def filter_optional_branches_for_orchestrator(
    branches: list[str],
    *,
    branches_completed: frozenset[str],
    explicit_pick: bool,
    fresh_external: bool,
) -> list[str]:
    """Only run branches missing from prior analysis unless user asked for fresh run."""
    if not branches:
        return []
    if explicit_pick or fresh_external:
        return [b for b in branches if b in OPTIONAL_CHECKPOINT_BRANCHES]
    needed = [b for b in branches if b not in branches_completed]
    return needed
