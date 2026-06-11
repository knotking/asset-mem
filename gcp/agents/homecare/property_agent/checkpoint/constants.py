"""Checkpoint pipeline state keys and branch maps (Orchestrator V2)."""

from __future__ import annotations

import re
from typing import Dict

from property_agent.checkpoint.branch_registry import (
    CHECKPOINT_OPTIONAL_BRANCH_SPECS,
)

_JSON_FENCE_RE = re.compile(r"```json\s*\n?([\s\S]*?)```", re.IGNORECASE)

# Structured analysis dict in session (SSOT for assembly).
CHECKPOINT_ANALYSIS_STATE_KEY = "checkpoint_analysis"
# Optional synthesis prose (markdown only).
CHECKPOINT_ANALYSIS_MARKDOWN_STATE_KEY = "checkpoint_analysis_markdown"
# Incremental optional-branch payloads for progressive UI updates.
CHECKPOINT_ANALYSIS_PROGRESS_STATE_KEY = "checkpoint_analysis_progress"
# Stream author for partial checkpoint analysis (proxy replaces assistant content).
CHECKPOINT_PROGRESS_EVENT_AUTHOR = "checkpoint_analysis_progress"
# State delta key: optional branch name that just completed (coverage|diy|service|cost).
CHECKPOINT_BRANCH_COMPLETED_STATE_KEY = "checkpoint_branch_completed"
# Monotonic counter bumped when progress stash updates.
CHECKPOINT_PROGRESS_EMIT_SEQ_STATE_KEY = "checkpoint_progress_emit_seq"
CHECKPOINT_PROGRESS_LAST_EMITTED_SEQ_STATE_KEY = "checkpoint_progress_last_emitted_seq"
# Stable id for a single analysis run (message + agentSteps correlation).
CHECKPOINT_ANALYSIS_RUN_ID_STATE_KEY = "analysis_run_id"
# First-class synthesis phase in ``analysis.analysisStatus`` (chat progress UX).
CHECKPOINT_SYNTHESIS_ANALYSIS_STATUS_KEY = "synthesis"
# UI checkpoint_ids included in the last completed run_checkpoint_pipeline retrieval.
CHECKPOINT_IDS_ANALYZED_STATE_KEY = "checkpoint_ids_analyzed"

OPTIONAL_BRANCH_TO_AGENT_NAME: Dict[str, str] = {
    "coverage": "coverage_agent",
    "diy": "diy_agent",
    "service": "service_agent",
    "cost": "cost_agent",
}

_PARALLEL_KEY_TO_BRANCH: Dict[str, str] = {
    spec.parallel_result_key: spec.branch_id
    for spec in CHECKPOINT_OPTIONAL_BRANCH_SPECS
}

CHECKPOINT_SESSION_INPUT_KEYS: tuple[str, ...] = (
    "user_query",
    "checkpoint_optional_agents",
    "checkpoint_ids",
    "context_doc_uris",
    "property_address",
    "property_id",
    "search_location",
)

# Max checkpoints returned for inventory/status list queries (recency-ordered).
CHECKPOINT_INVENTORY_LIST_LIMIT = 20

CHECKPOINT_INVENTORY_META_STATE_KEY = "checkpoint_inventory_meta"

# Phase 2 executor tool names (registry exposes these instead of run_checkpoint_pipeline).
CHECKPOINT_LIST_TOOL = "list_checkpoints"
CHECKPOINT_ANALYSIS_TOOL = "analyze_checkpoints"
# When set, pipeline branch selection follows tool ``branches`` arg only (not resolve/UI).
CHECKPOINT_EXPLICIT_BRANCHES_KEY = "_checkpoint_explicit_branches"

CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY = "checkpoint_retrieval_search_query"
# Branch-specific search intents (youtube, shopping materials, service trade).
CHECKPOINT_BRANCH_SEARCH_INTENTS_KEY = "checkpoint_branch_search_intents"
_VALID_OPTIONAL_BRANCHES = frozenset(OPTIONAL_BRANCH_TO_AGENT_NAME.keys())
