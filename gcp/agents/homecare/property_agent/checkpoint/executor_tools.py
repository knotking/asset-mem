"""Executor-facing checkpoint tools (Phase 2 tool split).

``list_checkpoints`` — inventory/status listing (replaces inventory regex inference).
``analyze_checkpoints`` — retrieval + optional branches (wraps ``run_checkpoint_pipeline``).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from google.adk.tools import ToolContext

from property_agent.checkpoint.analysis.assembler import (
    format_checkpoints_for_analysis_blob,
    prepend_inventory_disclosure_to_blob,
)
from property_agent.checkpoint.constants import (
    CHECKPOINT_EXPLICIT_BRANCHES_KEY,
    CHECKPOINT_INVENTORY_META_STATE_KEY,
    CHECKPOINT_LIST_TOOL,
    CHECKPOINT_ANALYSIS_TOOL,
    CHECKPOINT_TEMPORAL_META_STATE_KEY,
    CHECKPOINT_LOCATION_META_STATE_KEY,
)
from property_agent.checkpoint.pipeline import run_checkpoint_pipeline
from property_agent.checkpoint.retrieval.agent import _firestore_client
from property_agent.checkpoint.retrieval.effective_query import (
    resolve_effective_checkpoint_query,
)
from property_agent.checkpoint.retrieval.firestore_checkpoint_list import (
    list_recent_property_checkpoints,
)
from property_agent.checkpoint.retrieval.format_checkpoints import format_raw_checkpoints
from property_agent.checkpoint.session_input import normalize_checkpoint_optional_agents
from property_agent.routing.conversational_intent import CHECKPOINT_LAST_RESPONSE_KIND_KEY
from property_agent.shared.inputs import CheckpointOptionalAgent

logger = logging.getLogger(__name__)

__all__ = [
    "CHECKPOINT_ANALYSIS_TOOL",
    "CHECKPOINT_LIST_TOOL",
    "CHECKPOINT_ROUTING_TOOLS",
    "analyze_checkpoints",
    "is_checkpoint_routing_tool",
    "list_checkpoints",
]

CHECKPOINT_ROUTING_TOOLS = frozenset({CHECKPOINT_ANALYSIS_TOOL, CHECKPOINT_LIST_TOOL})


def is_checkpoint_routing_tool(tool_name: str | None) -> bool:
    return (tool_name or "").strip() in CHECKPOINT_ROUTING_TOOLS


def _resolve_user_and_property(
    tool_context: ToolContext | None,
    *,
    property_id: str,
) -> tuple[str | None, str]:
    if tool_context is None:
        return None, property_id
    user_id = (
        tool_context.state.get("user_id")
        or tool_context._invocation_context.session.user_id
    )
    resolved_property = property_id or tool_context.state.get("property_id") or ""
    return str(user_id) if user_id else None, str(resolved_property)


async def list_checkpoints(
    property_id: str,
    user_query: str = "",
    location: Optional[str] = None,
    tool_context: ToolContext | None = None,
) -> str:
    """List recent checkpoints for this property (inventory / status queries).

    Returns a markdown summary of the most recent checkpoints with analysis status.
    Use when the user asks what checkpoints exist or wants a property-wide status
    overview — not when analyzing specific selected checkpoints.
    """
    if tool_context is None:
        return "Checkpoint listing requires tool context."

    user_id, property_id = _resolve_user_and_property(tool_context, property_id=property_id)
    if not user_id or not property_id:
        return "Missing user or property context for checkpoint listing."

    tool_context.state["property_id"] = property_id
    effective_query = resolve_effective_checkpoint_query(tool_context.state, user_query or "")
    if effective_query:
        tool_context.state["user_query"] = effective_query

    db = _firestore_client()
    # Property-wide inventory — never apply scoped date/location carryover.
    tool_context.state[CHECKPOINT_TEMPORAL_META_STATE_KEY] = None
    tool_context.state[CHECKPOINT_LOCATION_META_STATE_KEY] = None

    list_result = list_recent_property_checkpoints(
        db,
        user_id=user_id,
        property_id=property_id,
        location=None,
    )
    raw_checkpoints = list_result.get("checkpoints") or []
    inventory_meta = list_result.get("inventory_meta")
    if isinstance(inventory_meta, dict):
        tool_context.state[CHECKPOINT_INVENTORY_META_STATE_KEY] = inventory_meta

    if not raw_checkpoints:
        return "No checkpoints found for this property yet."

    formatted = format_raw_checkpoints(raw_checkpoints)
    blob = format_checkpoints_for_analysis_blob(formatted)
    markdown = prepend_inventory_disclosure_to_blob(
        blob, inventory_meta if isinstance(inventory_meta, dict) else None
    ).strip()
    tool_context.state[CHECKPOINT_LAST_RESPONSE_KIND_KEY] = "retrieval"
    logger.info(
        "list_checkpoints property_id=%s returned=%d truncated=%s",
        property_id,
        len(formatted),
        bool(isinstance(inventory_meta, dict) and inventory_meta.get("truncated")),
    )
    return markdown or "No checkpoint details available."


async def analyze_checkpoints(
    user_query: str,
    property_id: str,
    branches: Optional[List[CheckpointOptionalAgent]] = None,
    checkpoint_ids: Optional[List[str]] = None,
    context_doc_uris: Optional[List[str]] = None,
    property_address: Optional[str] = None,
    search_location: Optional[Dict[str, Any]] = None,
    tool_context: ToolContext | None = None,
) -> str:
    """Retrieve and analyze checkpoints for this property.

    ``branches`` selects optional analysis sections:
    - ``[]`` (default) — retrieval + issue summary only (no coverage/diy/service/cost).
    - ``["cost"]``, ``["diy", "cost"]``, etc. — run those branch analyses after retrieval.

    Pass ``checkpoint_ids`` only when the client attached real Firestore ids in session
    context; omit them for semantic search across the property.
    """
    normalized_branches = normalize_checkpoint_optional_agents(branches or [])
    if tool_context is not None:
        # temp:-scoped — visible for the rest of this invocation, never persisted.
        tool_context.state[CHECKPOINT_EXPLICIT_BRANCHES_KEY] = True
        tool_context.state["checkpoint_optional_agents"] = normalized_branches
    return await run_checkpoint_pipeline(
        user_query=user_query,
        property_id=property_id,
        checkpoint_ids=checkpoint_ids,
        checkpoint_optional_agents=normalized_branches or None,
        context_doc_uris=context_doc_uris,
        property_address=property_address,
        search_location=search_location,
        tool_context=tool_context,
    )
