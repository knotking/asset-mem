"""Branch-detection helpers used by checkpoint tool_guards and search_query (not context arbitration)."""

from __future__ import annotations

import re
from typing import Any, Mapping

from ..optional_branches import OPTIONAL_CHECKPOINT_BRANCHES
from .session_memory import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    _analysis_object_from_state,
    _branch_payload_has_content,
    _branches_completed_from_analysis,
)

_ENTITY_DETAIL_RE = re.compile(
    r"\b("
    r"more (?:details?|info(?:rmation)?) (?:about|on)|"
    r"(?:tell|give) me (?:more )?(?:about|on)|"
    r"(?:what|anything) (?:do you know |can you tell me )?about|"
    r"learn more about|details on|info on|"
    r"who is|what is|get (?:more )?details (?:about|on)|"
    r"more on"
    r")\b",
    re.IGNORECASE,
)

_FRESH_EXTERNAL_DATA_RE = re.compile(
    r"\b("
    r"find (?:me )?(?:more|new|additional|other)\s+(?:local\s+)?(?:service\s+)?providers?|"
    r"(?:get|run|fetch)\s+(?:new|fresh|latest)\s+(?:provider|search)|"
    r"re-?run|run again|refresh|start over|from scratch|"
    r"new search for providers?"
    r")\b",
    re.IGNORECASE,
)


def branches_mentioned_in_query(user_query: str) -> list[str]:
    """Return branch names explicitly mentioned in the user query (deduped, ordered)."""
    normalized = (user_query or "").lower()
    picked: list[str] = []
    for branch in OPTIONAL_CHECKPOINT_BRANCHES:
        if re.search(rf"\b{re.escape(branch)}\b", normalized):
            if branch not in picked:
                picked.append(branch)
    return picked


def prior_analysis_branches_completed(state: Mapping[str, Any] | None) -> frozenset[str]:
    """Return optional branches already completed in session analysis."""
    return session_optional_branches_completed(state)


def session_optional_branches_completed(state: Mapping[str, Any] | None) -> frozenset[str]:
    """Union of completed optional branches from analysis payloads and pipeline status."""
    if not state:
        return frozenset()

    completed: set[str] = set()

    analysis = _analysis_object_from_state(state)
    if isinstance(analysis, dict):
        completed.update(_branches_completed_from_analysis(analysis))

    pipeline_done = state.get("_checkpoint_pipeline_completed")
    if isinstance(pipeline_done, list):
        for branch in pipeline_done:
            if branch in OPTIONAL_CHECKPOINT_BRANCHES:
                completed.add(str(branch))

    snapshot = state.get(SESSION_WORKING_MEMORY_SNAPSHOT_KEY)
    if isinstance(snapshot, dict):
        for branch in snapshot.get("branches_completed") or []:
            if branch in OPTIONAL_CHECKPOINT_BRANCHES:
                completed.add(str(branch))

    if not completed:
        for branch in OPTIONAL_CHECKPOINT_BRANCHES:
            if _branch_payload_has_content(branch, analysis or {}):
                completed.add(branch)

    return frozenset(completed)


def query_requests_fresh_external_data(user_query: str) -> bool:
    """True when the user explicitly asks for a new/fresh provider search."""
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    return bool(_FRESH_EXTERNAL_DATA_RE.search(normalized))


def query_requests_entity_detail(user_query: str) -> bool:
    """True when the turn asks for detail about a named entity (provider, contractor, etc.)."""
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    if _ENTITY_DETAIL_RE.search(normalized):
        return True
    if re.match(r"^[A-Z][\w'&.-]+(?:\s+[A-Z][\w'&.-]+)+$", normalized):
        return True
    return False
