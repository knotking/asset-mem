"""Query modes and session working memory for ChatGPT-style multi-turn chat."""

from __future__ import annotations

from property_agent.routing.schema import QueryModeKind

from .heuristics import (
    branches_mentioned_in_query,
    needs_fresh_checkpoint_retrieval,
    prior_analysis_branches_completed,
    query_asks_area_outside_memory,
    query_looks_like_explain_follow_up,
    query_requests_checkpoint_inventory,
    query_requests_entity_detail,
    query_requests_fresh_external_data,
    should_answer_provider_from_context,
    should_block_checkpoint_pipeline_for_context_turn,
)
from .provider_context import (
    format_provider_context_answer,
    prior_analysis_has_service_results,
    provider_context_answer_is_substantive,
    query_references_known_provider,
)
from .session_memory import (
    SESSION_WORKING_MEMORY_SNAPSHOT_KEY,
    build_session_working_memory,
    extract_known_service_providers,
    extract_service_provider_details,
    session_has_checkpoint_answer_context,
    snapshot_session_analysis_context,
)

__all__ = [
    "SESSION_WORKING_MEMORY_SNAPSHOT_KEY",
    "QueryModeKind",
    "branches_mentioned_in_query",
    "build_session_working_memory",
    "extract_known_service_providers",
    "extract_service_provider_details",
    "format_provider_context_answer",
    "session_has_checkpoint_answer_context",
    "needs_fresh_checkpoint_retrieval",
    "prior_analysis_branches_completed",
    "prior_analysis_has_service_results",
    "provider_context_answer_is_substantive",
    "query_asks_area_outside_memory",
    "query_looks_like_explain_follow_up",
    "query_references_known_provider",
    "query_requests_checkpoint_inventory",
    "query_requests_entity_detail",
    "query_requests_fresh_external_data",
    "should_answer_provider_from_context",
    "should_block_checkpoint_pipeline_for_context_turn",
    "snapshot_session_analysis_context",
]
