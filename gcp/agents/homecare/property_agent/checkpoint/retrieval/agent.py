"""
Checkpoint Agent

Retrieves checkpoint information using Firestore Vector Search for semantic query matching.
Can optionally trigger comprehensive analysis with coverage, DIY, service, and cost recommendations.
"""

import json
import logging
import re
import time
from typing import Any, Dict, List, Optional

from google.adk.tools import ToolContext
from dotenv import load_dotenv
from .firestore_checkpoint_list import list_recent_property_checkpoints
from .firestore_vector_search import search_checkpoints_by_vector
from property_agent.checkpoint.constants import (
    CHECKPOINT_BRANCH_SEARCH_INTENTS_KEY,
    CHECKPOINT_INVENTORY_META_STATE_KEY,
    CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY,
)
from property_agent.routing.query_mode.heuristics import query_requests_checkpoint_inventory
from .media_search_query_refiner import refine_checkpoint_branch_search_intents
from property_agent.checkpoint.timing import record_retrieval_ms

load_dotenv()

logger = logging.getLogger(__name__)



def build_search_query_from_checkpoints(
    formatted_results: List[Dict[str, Any]], *, max_chars: int = 200
) -> str:
    """
    Compact search seed for YouTube / product APIs: location plus issue descriptions.
    """
    locations: List[str] = []
    issue_parts: List[str] = []
    seen_loc = set()
    for fc in formatted_results or ():
        loc = (fc.get("location") or "").strip()
        if loc and loc not in seen_loc:
            seen_loc.add(loc)
            locations.append(loc)
        for issue in fc.get("issues") or []:
            if isinstance(issue, dict):
                text = (issue.get("description") or "").strip()
            else:
                text = str(issue).strip()
            if text:
                issue_parts.append(text)
    loc_blob = " ".join(locations[:3])
    issue_blob = " ".join(issue_parts[:8])
    q = f"{loc_blob} {issue_blob}".strip()
    q = re.sub(r"\s+", " ", q)
    if len(q) > max_chars:
        cut = q[: max_chars + 1]
        q = cut.rsplit(" ", 1)[0].strip() if " " in cut else cut[:max_chars].strip()
    return q


def ask_checkpoints_retrieval(
    user_query: str,
    property_id: str,  # Mandatory - required for property-specific checkpoint queries
    location: Optional[str] = None,
    checkpoint_ids: Optional[List[str]] = None,
    tool_context: ToolContext | None = None,
):
    """
    Retrieves relevant checkpoints using Firestore Vector Search based on semantic query matching.

    Args:
        user_query: Natural language query about checkpoints (e.g., "Show me checkpoints with water damage")
        property_id: Property ID (REQUIRED) - must be provided to query property-specific checkpoints
        location: Optional location filter (e.g., "Kitchen", "Car")
        checkpoint_ids: Optional list of specific checkpoint IDs to limit results to (when provided, only these checkpoints are considered)
        tool_context: Tool context containing user_id and session information

    Returns:
        ``{"checkpoints": [...], "search_query": str, "inventory_meta": dict|None}`` —
        checkpoints carry analysis fields; ``search_query`` is a short phrase from
        locations and issue descriptions for downstream YouTube / shopping search;
        ``inventory_meta`` is set for inventory list queries (recent N, with totals).
        On failure or no matches, ``checkpoints`` is empty and ``search_query`` is ``""``.
    """
    t0 = time.monotonic()

    def _elapsed_ms() -> int:
        return int((time.monotonic() - t0) * 1000)

    def _record_retrieval_timing() -> None:
        if tool_context is not None:
            record_retrieval_ms(tool_context.state, _elapsed_ms())

    try:
        inventory_query = bool(
            not (checkpoint_ids and len(checkpoint_ids) > 0)
            and query_requests_checkpoint_inventory(user_query or "")
        )
        if checkpoint_ids and len(checkpoint_ids) > 0:
            ck_mode = "by_id"
        elif inventory_query:
            ck_mode = "inventory_recent"
        else:
            ck_mode = "vector"
        inventory_meta: dict | None = None
        logger.info(
            "checkpoint_retrieval: start mode=%s property_id=%s "
            "user_query_len=%d location_set=%s checkpoint_id_count=%d",
            ck_mode,
            property_id or "",
            len(user_query or ""),
            bool(location and str(location).strip()),
            len(checkpoint_ids or []),
        )
        logger.debug(
            "checkpoint_retrieval: args user_query=%r location=%r checkpoint_ids=%r",
            user_query,
            location,
            checkpoint_ids,
        )

        if tool_context is None:
            logger.error("checkpoint_retrieval: missing tool_context")
            _record_retrieval_timing()
            return {"checkpoints": [], "search_query": "", "inventory_meta": None}

        # Get user_id from context
        user_id = (
            tool_context.state.get("user_id")
            or tool_context._invocation_context.session.user_id
        )
        logger.debug("checkpoint_retrieval: user_id=%s", user_id)

        # property_id is now mandatory in function signature, but check tool_context.state as fallback if somehow missing
        if not property_id:
            property_id = tool_context.state.get("property_id")
            logger.warning(
                f"property_id not provided as parameter, attempting to retrieve from tool_context.state: {property_id}"
            )

        if not user_id:
            logger.error(f"Missing user_id: user_id={user_id}")
            logger.info(
                "checkpoint_retrieval: end duration_ms=%d outcome=no_user checkpoints=0",
                _elapsed_ms(),
            )
            _record_retrieval_timing()
            return {"checkpoints": [], "search_query": "", "inventory_meta": None}

        if not property_id:
            logger.error(
                "Missing property_id - checkpoint retrieval REQUIRES property_id. Cannot proceed without it."
            )
            logger.info(
                "checkpoint_retrieval: end duration_ms=%d outcome=no_property checkpoints=0",
                _elapsed_ms(),
            )
            _record_retrieval_timing()
            return {"checkpoints": [], "search_query": "", "inventory_meta": None}

        logger.debug(
            "checkpoint_retrieval: resolved user_id=%s property_id=%s",
            user_id,
            property_id,
        )

        # Lazy import to avoid deployment issues
        from google.cloud import firestore  # type: ignore[attr-defined]

        # Initialize Firestore client
        db = firestore.Client()

        # If specific checkpoint IDs are provided, fetch those checkpoints directly
        if checkpoint_ids and len(checkpoint_ids) > 0:
            logger.debug(
                "checkpoint_retrieval: fetching by id count=%d ids=%r",
                len(checkpoint_ids),
                checkpoint_ids,
            )
            checkpoints = []
            checkpoints_ref = (
                db.collection("users")
                .document(user_id)
                .collection("properties")
                .document(property_id)
                .collection("checkpoints")
            )
            logger.debug(
                "checkpoint_retrieval: collection users/%s/properties/%s/checkpoints",
                user_id,
                property_id,
            )

            t_fetch = time.monotonic()
            for checkpoint_id in checkpoint_ids:
                try:
                    logger.debug("checkpoint_retrieval: fetch doc id=%s", checkpoint_id)
                    checkpoint_doc = checkpoints_ref.document(checkpoint_id).get()
                    if checkpoint_doc.exists:
                        checkpoint_data = checkpoint_doc.to_dict()
                        checkpoint_data["id"] = checkpoint_doc.id
                        checkpoints.append(checkpoint_data)
                        logger.debug(
                            "checkpoint_retrieval: loaded id=%s aiAnalysis=%s",
                            checkpoint_id,
                            bool(checkpoint_data.get("aiAnalysis")),
                        )
                    else:
                        logger.warning(
                            f"Checkpoint document {checkpoint_id} does not exist"
                        )
                except Exception as e:
                    logger.error(
                        f"Error fetching checkpoint {checkpoint_id}: {e}", exc_info=True
                    )

            logger.info(
                "checkpoint_retrieval: firestore_by_id fetch_duration_ms=%d "
                "fetched=%d requested=%d total_elapsed_ms=%d",
                int((time.monotonic() - t_fetch) * 1000),
                len(checkpoints),
                len(checkpoint_ids),
                _elapsed_ms(),
            )
            if not checkpoints:
                logger.warning(
                    "None of the specified checkpoint IDs were found: %r; "
                    "falling back to vector search",
                    checkpoint_ids,
                )
                ck_mode = "vector"
                _vs = time.monotonic()
                checkpoints = search_checkpoints_by_vector(
                    db=db,
                    user_id=user_id,
                    property_id=property_id,
                    query_text=user_query,
                    limit=5,
                    location=location,
                )
                logger.info(
                    "checkpoint_retrieval: vector_search_after_by_id_miss "
                    "duration_ms=%d returned=%d",
                    int((time.monotonic() - _vs) * 1000),
                    len(checkpoints),
                )
                if not checkpoints:
                    logger.info(
                        "checkpoint_retrieval: end duration_ms=%d "
                        "outcome=no_matches checkpoints=0",
                        _elapsed_ms(),
                    )
                    _record_retrieval_timing()
                    return {
                        "checkpoints": [],
                        "search_query": "",
                        "inventory_meta": None,
                    }
        elif inventory_query:
            _inv = time.monotonic()
            list_result = list_recent_property_checkpoints(
                db,
                user_id=user_id,
                property_id=property_id,
                location=location,
            )
            checkpoints = list_result.get("checkpoints") or []
            raw_meta = list_result.get("inventory_meta")
            inventory_meta = raw_meta if isinstance(raw_meta, dict) else None
            if tool_context is not None and inventory_meta is not None:
                tool_context.state[CHECKPOINT_INVENTORY_META_STATE_KEY] = inventory_meta
            logger.info(
                "checkpoint_retrieval: inventory_recent duration_ms=%d returned=%d truncated=%s",
                int((time.monotonic() - _inv) * 1000),
                len(checkpoints),
                bool(inventory_meta and inventory_meta.get("truncated")),
            )
            if not checkpoints:
                logger.info(
                    "checkpoint_retrieval: end duration_ms=%d outcome=no_inventory checkpoints=0",
                    _elapsed_ms(),
                )
                _record_retrieval_timing()
                return {"checkpoints": [], "search_query": "", "inventory_meta": inventory_meta}
        else:
            # Perform vector search when no specific checkpoint IDs provided
            _vs = time.monotonic()
            logger.debug(
                "checkpoint_retrieval: vector_search start query_len=%d",
                len(user_query or ""),
            )
            checkpoints = search_checkpoints_by_vector(
                db=db,
                user_id=user_id,
                property_id=property_id,
                query_text=user_query,
                limit=5,
                location=location,
            )
            logger.info(
                "checkpoint_retrieval: vector_search duration_ms=%d returned=%d",
                int((time.monotonic() - _vs) * 1000),
                len(checkpoints),
            )
            if not checkpoints:
                from agent_framework.observability.log_redaction import safe_text_preview

                logger.warning(
                    "No checkpoints found for query_len=%d preview=%r",
                    len(user_query or ""),
                    safe_text_preview(user_query, max_len=60),
                )
                logger.info(
                    "checkpoint_retrieval: end duration_ms=%d outcome=no_matches checkpoints=0",
                    _elapsed_ms(),
                )
                _record_retrieval_timing()
                return {"checkpoints": [], "search_query": "", "inventory_meta": None}

        # Format checkpoints for agent consumption
        # Extract relevant information: summary, location, detected items, issues, etc.
        logger.debug(
            "checkpoint_retrieval: formatting checkpoint_count=%d",
            len(checkpoints),
        )
        t_fmt = time.monotonic()
        formatted_results = []
        for idx, checkpoint in enumerate(checkpoints):
            logger.debug(
                "checkpoint_retrieval: format %d/%d id=%s",
                idx + 1,
                len(checkpoints),
                checkpoint.get("id"),
            )
            checkpoint_id = checkpoint.get("id")
            ai_analysis = checkpoint.get("aiAnalysis", {})

            # Build a summary text from checkpoint data
            summary_parts = []
            if ai_analysis.get("summary"):
                summary_parts.append(f"Summary: {ai_analysis['summary']}")

            cp_location = checkpoint.get("location") or ai_analysis.get("detectedAsset")
            if cp_location:
                summary_parts.append(f"Location/Asset: {cp_location}")

            analysis_status = checkpoint.get("analysisStatus")
            if analysis_status:
                summary_parts.append(f"Status: {analysis_status}")

            detected_items = ai_analysis.get("detectedItems", [])
            if detected_items:
                items_text = ", ".join(detected_items[:5])  # Limit to first 5
                summary_parts.append(f"Detected items: {items_text}")

            issues = ai_analysis.get("issues", [])
            if issues:
                issue_descriptions = []
                for issue in issues[:3]:  # Limit to first 3 issues
                    if isinstance(issue, dict):
                        issue_descriptions.append(issue.get("description", ""))
                    elif isinstance(issue, str):
                        issue_descriptions.append(issue)

                if issue_descriptions:
                    issues_text = "; ".join(issue_descriptions)
                    summary_parts.append(f"Issues: {issues_text}")

            conditions = ai_analysis.get("conditions", [])
            if conditions:
                conditions_text = ", ".join(conditions[:3])  # Limit to first 3
                summary_parts.append(f"Conditions: {conditions_text}")

            # Get checkpoint name (prefer name, fallback to location or "Checkpoint")
            checkpoint_name = checkpoint.get("name") or cp_location or "Checkpoint"

            # Include checkpoint name in the text summary for agent consumption
            if checkpoint_name and checkpoint_name != "Checkpoint":
                summary_parts.insert(0, f"Checkpoint Name: {checkpoint_name}")

            # Build formatted checkpoint data
            formatted_checkpoint = {
                "checkpointId": checkpoint_id,  # Keep ID for internal reference
                "checkpointName": checkpoint_name,  # Add name field
                "text": "\n".join(summary_parts)
                if summary_parts
                else "No summary available",
                "location": cp_location,
                "createdAt": checkpoint.get("createdAt"),
                "summary": ai_analysis.get("summary", ""),
                "detectedItems": detected_items,
                "conditions": conditions,
                "issues": issues[:5] if issues else [],  # Limit issues for context
                "similarity_score": checkpoint.get("similarity_score", 0.0),
            }
            logger.debug(
                "formatted_checkpoint=%s",
                json.dumps(formatted_checkpoint, default=str, ensure_ascii=False),
            )

            formatted_results.append(formatted_checkpoint)
            logger.debug(
                "checkpoint_retrieval: formatted idx=%d text_len=%d",
                idx + 1,
                len(formatted_checkpoint.get("text") or ""),
            )

        search_query = build_search_query_from_checkpoints(formatted_results)
        branch_intents = refine_checkpoint_branch_search_intents(
            search_query, formatted_results
        )
        search_query = branch_intents.issue_stem or search_query
        if formatted_results:
            logger.debug(
                "checkpoint_retrieval: sample_text_head=%r",
                (formatted_results[0].get("text") or "")[:200],
            )
        logger.debug(
            "checkpoint_retrieval: search_query for branches=%r",
            search_query,
        )
        logger.info(
            "checkpoint_retrieval: format duration_ms=%d checkpoints=%d",
            int((time.monotonic() - t_fmt) * 1000),
            len(formatted_results),
        )
        if tool_context is not None and search_query:
            tool_context.state[CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY] = search_query
        if tool_context is not None and branch_intents.issue_stem:
            tool_context.state[CHECKPOINT_BRANCH_SEARCH_INTENTS_KEY] = (
                branch_intents.to_dict()
            )
        logger.info(
            "checkpoint_retrieval: end duration_ms=%d outcome=ok checkpoints=%d "
            "search_query_len=%d",
            _elapsed_ms(),
            len(formatted_results),
            len(search_query or ""),
        )
        _record_retrieval_timing()
        return {
            "checkpoints": formatted_results,
            "search_query": search_query,
            "inventory_meta": inventory_meta,
        }
    except Exception as e:
        logger.error(f"Error retrieving checkpoints: {e}", exc_info=True)
        logger.info(
            "checkpoint_retrieval: end duration_ms=%d outcome=error checkpoints=0",
            _elapsed_ms(),
        )
        _record_retrieval_timing()
        return {"checkpoints": [], "search_query": "", "inventory_meta": None}


__all__ = ["ask_checkpoints_retrieval", "build_search_query_from_checkpoints"]
