"""Query-mode heuristics and routing inference."""

from __future__ import annotations

import re
from typing import Literal

from property_agent.routing.schema import SessionStateLike

from ..conversational_intent import resolve_requested_optional_branches
from ..optional_branches import (
    EXPLICIT_BRANCH_RE,
    HOW_ABOUT_OPTIONAL_BRANCH_RE,
    MEAN_OPTIONAL_BRANCH_RE,
    OPTIONAL_CHECKPOINT_BRANCHES,
    STANDALONE_OPTIONAL_BRANCH_RE,
)
from .provider_context import (
    prior_analysis_has_service_results,
    query_references_known_provider,
)
from ..checkpoint_selection import checkpoint_selection_changed
from .session_memory import (
    _analysis_object_from_state,
    _branch_payload_has_content,
    build_session_working_memory,
)

QueryModeKind = Literal[
    "interpret_session",
    "branch_issue_search",
    "branch_entity_search",
    "branch_explicit",
]

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

def query_requests_entity_detail(user_query: str) -> bool:
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    if _ENTITY_DETAIL_RE.search(normalized):
        return True
    if re.match(r"^[A-Z][\w'&.-]+(?:\s+[A-Z][\w'&.-]+)+$", normalized):
        return True
    return False


def should_answer_provider_from_context(user_query: str, *, state: SessionStateLike | None) -> bool:
    if not prior_analysis_has_service_results(state):
        return False
    if not query_requests_entity_detail(user_query):
        return False
    return query_references_known_provider(user_query, state) is not None


_EXPLAIN_FOLLOW_UP_RE = re.compile(
    r"\b("
    r"explain|walk me through|help me understand|clarify|"
    r"why (?:is|are|does|do)|what (?:are|were) the|"
    r"can you explain|tell me more about the|"
    r"break down|elaborate on"
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


def query_looks_like_explain_follow_up(user_query: str) -> bool:
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    if HOW_ABOUT_OPTIONAL_BRANCH_RE.search(normalized):
        return False
    if MEAN_OPTIONAL_BRANCH_RE.search(normalized):
        return False
    if STANDALONE_OPTIONAL_BRANCH_RE.match(normalized):
        return False
    return bool(_EXPLAIN_FOLLOW_UP_RE.search(normalized))


def query_requests_fresh_external_data(user_query: str) -> bool:
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    return bool(_FRESH_EXTERNAL_DATA_RE.search(normalized))


def prior_analysis_branches_completed(state: SessionStateLike | None) -> frozenset[str]:
    analysis = _analysis_object_from_state(state)
    if not analysis:
        return frozenset()
    completed: set[str] = set()
    for branch in OPTIONAL_CHECKPOINT_BRANCHES:
        if _branch_payload_has_content(branch, analysis):
            completed.add(branch)
    return frozenset(completed)


_FRESH_CHECKPOINT_AREA_RE = re.compile(
    r"\b("
    r"kitchen|bathroom|bedroom|roof|basement|attic|yard|exterior|"
    r"living room|dining room|laundry|hvac|plumbing|electrical"
    r")\b",
    re.IGNORECASE,
)

_CHECKPOINT_INVENTORY_LIST_RE = re.compile(
    r"\b("
    r"what checkpoints?|which checkpoints?|list (?:my )?checkpoints?|"
    r"how many checkpoints?"
    r")\b",
    re.IGNORECASE,
)

# Status phrasing must mention checkpoints — avoid hijacking area queries like
# "current status of the garage door" into inventory list mode.
_CHECKPOINT_INVENTORY_STATUS_RE = re.compile(
    r"\b("
    r"checkpoint status|"
    r"status of (?:my |the )?checkpoints?|"
    r"(?:their|the) current status of (?:my |the )?checkpoints?"
    r")\b",
    re.IGNORECASE,
)

_CHECKPOINT_INVENTORY_STATUS_COMBO_RE = re.compile(
    r"checkpoints?.{0,48}(?:current )?status|(?:current )?status.{0,48}checkpoints?",
    re.IGNORECASE,
)


def query_requests_checkpoint_inventory(user_query: str) -> bool:
    """True when the user asks to list checkpoints or report live status."""
    normalized = (user_query or "").strip()
    if not normalized:
        return False
    if _CHECKPOINT_INVENTORY_LIST_RE.search(normalized):
        return True
    if _CHECKPOINT_INVENTORY_STATUS_RE.search(normalized):
        return True
    return bool(_CHECKPOINT_INVENTORY_STATUS_COMBO_RE.search(normalized))


def _checkpoint_areas_in_memory(state: SessionStateLike | None) -> set[str]:
    memory = build_session_working_memory(state)
    if not memory:
        return set()
    areas: set[str] = set()
    summary = memory.get("checkpoint_summary")
    if isinstance(summary, dict):
        for loc in summary.get("locations") or []:
            if isinstance(loc, str) and loc.strip():
                areas.add(loc.strip().lower())
    return areas


def query_asks_area_outside_memory(user_query: str, state: SessionStateLike | None) -> bool:
    normalized = (user_query or "").strip().lower()
    match = _FRESH_CHECKPOINT_AREA_RE.search(normalized)
    if not match:
        return False
    memory_areas = _checkpoint_areas_in_memory(state)
    if not memory_areas:
        return False
    asked = match.group(1).lower().strip()
    for mem in memory_areas:
        if asked == mem or asked in mem or mem in asked:
            return False
    return True


def needs_fresh_checkpoint_retrieval(user_query: str, *, state: SessionStateLike | None = None) -> bool:
    normalized = (user_query or "").strip().lower()
    if not normalized:
        return False
    if query_requests_checkpoint_inventory(user_query):
        return True
    if state is not None and query_references_known_provider(user_query, state):
        return False
    if _FRESH_CHECKPOINT_AREA_RE.search(normalized):
        if state is not None and query_asks_area_outside_memory(user_query, state):
            return False
        return True
    if re.search(r"\b(issues?|problems?|inspection|checkpoints?)\b.*\b(in|at|for)\b", normalized):
        return True
    return False


def should_block_checkpoint_pipeline_for_context_turn(
    *,
    user_query: str,
    state: SessionStateLike | None,
    user_goal: str,
    query_mode: str,
    resolved_route: str = "",
    tool_name: str = "",
    discourse_act: str = "",
) -> bool:
    """Block checkpoint/retrieval tools when resolve chose session-memory follow-up."""
    route = (resolved_route or "").strip().lower()
    tool = (tool_name or "").strip().lower()
    if tool in ("analyze_checkpoints", "run_checkpoint_pipeline") and route == "report":
        return True

    if discourse_act == "accept_offer":
        return False

    if discourse_act in (
        "explain_prior",
        "provider_detail",
        "closure",
    ):
        return True
    if user_goal != "answer_from_context":
        return False
    if checkpoint_selection_changed(state):
        return False
    if query_requests_fresh_external_data(user_query):
        return False
    if needs_fresh_checkpoint_retrieval(user_query, state=state):
        return False
    if tool in ("user_docs_retrieval", "report_retrieval") and route in (
        "user_docs",
        "report",
    ):
        return False
    if should_answer_provider_from_context(user_query, state=state):
        return True
    memory = build_session_working_memory(state)
    if not memory or query_mode != "interpret_session":
        return False
    if query_requests_entity_detail(user_query):
        if query_references_known_provider(user_query, state):
            return True
        if memory.get("service_providers_mentioned") or memory.get("checkpoint_summary"):
            return True
        return False
    if (
        memory.get("checkpoint_summary")
        or memory.get("branches_completed")
        or memory.get("analysis_digest")
    ):
        return True
    return False


def branches_mentioned_in_query(user_query: str) -> list[str]:
    normalized = (user_query or "").lower()
    picked: list[str] = []
    for branch in OPTIONAL_CHECKPOINT_BRANCHES:
        if re.search(rf"\b{re.escape(branch)}\b", normalized):
            if branch not in picked:
                picked.append(branch)
    return picked


def infer_query_mode(
    *,
    user_goal: str,
    expanded_user_query: str,
    run_optional_agents: list[str],
    state: SessionStateLike | None = None,
) -> QueryModeKind:
    if user_goal == "answer_from_context":
        return "interpret_session"
    expanded = (expanded_user_query or "").strip()
    if user_goal != "new_analysis" or not run_optional_agents:
        return "interpret_session"
    if query_references_known_provider(expanded, state) and query_requests_entity_detail(expanded):
        return "branch_entity_search"
    if query_requests_entity_detail(expanded) and not EXPLICIT_BRANCH_RE.search(expanded):
        return "branch_entity_search"
    if EXPLICIT_BRANCH_RE.search(expanded) or resolve_requested_optional_branches(expanded, state):
        return "branch_explicit"
    return "branch_issue_search"
