"""State keys and branch maps for checkpoint dual-format flows."""

from __future__ import annotations

import re
from typing import Dict

_JSON_FENCE_RE = re.compile(r"```json\s*\n?([\s\S]*?)```", re.IGNORECASE)

# Stashed by nested checkpoint_analysis workflow; parent checkpoint_agent / doculink read this.
CHECKPOINT_ANALYSIS_DUAL_FORMAT_STATE_KEY = "checkpoint_analysis_dual_format"
# Incremental optional-branch payloads for progressive UI updates.
CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY = "checkpoint_analysis_progress"
# Stream author for partial checkpoint analysis (proxy replaces assistant content).
CHECKPOINT_PROGRESS_EVENT_AUTHOR = "checkpoint_analysis_progress"
# State delta key: optional branch name that just completed (coverage|diy|service|cost).
CHECKPOINT_BRANCH_COMPLETED_STATE_KEY = "checkpoint_branch_completed"
# Serialized CheckpointAnalysisInput for doculink transfer → checkpoint_progress_agent.
CHECKPOINT_ANALYSIS_PENDING_INPUT_STATE_KEY = "checkpoint_analysis_pending_input"
# Monotonic counter bumped when progress stash updates (doculink streaming callback).
CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY = "checkpoint_progress_emit_seq"
CHECKPOINT_PROGRESS_LAST_EMITTED_SEQ_STATE_KEY = "checkpoint_progress_last_emitted_seq"

OPTIONAL_BRANCH_TO_AGENT_NAME: Dict[str, str] = {
    "coverage": "coverage_agent",
    "diy": "diy_agent",
    "service": "service_agent",
    "cost": "cost_agent",
}

_PARALLEL_KEY_TO_BRANCH: Dict[str, str] = {
    "checkpoint_parallel_coverage_result": "coverage",
    "checkpoint_parallel_diy_result": "diy",
    "checkpoint_parallel_service_result": "service",
    "checkpoint_parallel_cost_result": "cost",
}

# Copied from tool args / DocsInput into session before nested checkpoint_agent runs.
CHECKPOINT_SESSION_INPUT_KEYS: tuple[str, ...] = (
    "user_query",
    "checkpoint_optional_agents",
    "checkpoint_ids",
    "context_doc_uris",
    "property_address",
    "property_id",
    "search_location",
)

_CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY = "checkpoint_retrieval_search_query"
_VALID_OPTIONAL_BRANCHES = frozenset(OPTIONAL_BRANCH_TO_AGENT_NAME.keys())

