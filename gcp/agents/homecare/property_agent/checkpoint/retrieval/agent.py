"""
Checkpoint Agent

Retrieves checkpoint information using Firestore Vector Search for semantic query matching.
Can optionally trigger comprehensive analysis with coverage, DIY, service, and cost recommendations.
"""

import logging
import re
import time
from typing import Any, Dict, List, Optional

from google.adk.tools import ToolContext
from dotenv import load_dotenv
from .firestore_checkpoint_list import (
    list_checkpoint_location_values,
    list_checkpoints_in_date_range,
    list_recent_property_checkpoints,
)
from .format_checkpoints import format_raw_checkpoints
from .firestore_vector_search import search_checkpoints_by_vector
from property_agent.checkpoint.constants import (
    CHECKPOINT_BRANCH_SEARCH_INTENTS_KEY,
    CHECKPOINT_INVENTORY_META_STATE_KEY,
    CHECKPOINT_RETRIEVAL_SEARCH_QUERY_KEY,
    CHECKPOINT_TEMPORAL_META_STATE_KEY,
    CHECKPOINT_LOCATION_META_STATE_KEY,
    CHECKPOINT_VECTOR_SIMILARITY_MIN,
)
from property_agent.checkpoint.retrieval.effective_query import (
    resolve_effective_checkpoint_query,
)
from property_agent.checkpoint.retrieval.location_query import (
    CheckpointLocationIntent,
    resolve_location_field,
)
from property_agent.checkpoint.retrieval.retrieval_scope import plan_checkpoint_retrieval
from property_agent.checkpoint.retrieval.temporal_query import (
    parse_reference_date_utc,
)
from .media_search_query_refiner import refine_checkpoint_branch_search_intents
from property_agent.checkpoint.timing import record_retrieval_ms

load_dotenv()

logger = logging.getLogger(__name__)

_FIRESTORE_CLIENT: Any = None


def _firestore_client():
    """Cached Firestore client — construction costs hundreds of ms per call."""
    global _FIRESTORE_CLIENT
    if _FIRESTORE_CLIENT is None:
        # Lazy import to avoid deployment issues
        from google.cloud import firestore  # type: ignore[attr-defined]

        _FIRESTORE_CLIENT = firestore.Client()
    return _FIRESTORE_CLIENT



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


def _resolve_location_scope(
    db: Any,
    *,
    user_id: str,
    property_id: str,
    explicit_location: Optional[str],
    location_intent: Optional[CheckpointLocationIntent],
) -> tuple[Optional[str], Optional[str], list[str]]:
    """Resolve a location filter to a stored Firestore ``location`` value."""
    known_locations = list_checkpoint_location_values(
        db,
        user_id=user_id,
        property_id=property_id,
    )
    resolved_field: Optional[str] = None
    requested_label = explicit_location
    if explicit_location:
        intent = CheckpointLocationIntent(label=explicit_location)
        resolved_field = resolve_location_field(intent, known_locations)
        if resolved_field is None and explicit_location in known_locations:
            resolved_field = explicit_location
    elif location_intent is not None:
        requested_label = location_intent.label
        resolved_field = resolve_location_field(location_intent, known_locations)
    return resolved_field, requested_label, known_locations


def ask_checkpoints_retrieval(
    user_query: str,
    property_id: str,  # Mandatory - required for property-specific checkpoint queries
    location: Optional[str] = None,
    checkpoint_ids: Optional[List[str]] = None,
    tool_context: ToolContext | None = None,
    refine_branch_intents: bool = True,
):
    """
    Retrieves relevant checkpoints using Firestore Vector Search based on semantic query matching.

    Args:
        user_query: Natural language query about checkpoints (e.g., "Show me checkpoints with water damage")
        property_id: Property ID (REQUIRED) - must be provided to query property-specific checkpoints
        location: Optional location filter (e.g., "Kitchen", "Car")
        checkpoint_ids: Optional list of specific checkpoint IDs to limit results to (when provided, only these checkpoints are considered)
        tool_context: Tool context containing user_id and session information
        refine_branch_intents: When False, skip the branch-intent refiner LLM call
            (used on retrieval-only turns where no optional branch will consume it)

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
        if tool_context is not None:
            user_query = resolve_effective_checkpoint_query(
                tool_context.state, user_query or ""
            )
        reference_date = None
        if tool_context is not None:
            reference_date = tool_context.state.get("current_date_utc")
        plan = plan_checkpoint_retrieval(
            user_query or "",
            location=location,
            checkpoint_ids=checkpoint_ids,
            reference_date=reference_date or parse_reference_date_utc(None),
            state=tool_context.state if tool_context is not None else None,
        )
        ck_mode = plan.mode
        date_range = plan.date_range
        explicit_location = plan.explicit_location
        location_intent = plan.location_intent
        inventory_query = plan.inventory_query
        inventory_meta: dict | None = None
        temporal_meta: dict | None = None
        location_meta: dict | None = None
        logger.info(
            "checkpoint_retrieval: start mode=%s property_id=%s "
            "user_query_len=%d location_set=%s checkpoint_id_count=%d carried_over=%s",
            ck_mode,
            property_id or "",
            len(user_query or ""),
            bool(location and str(location).strip()),
            len(checkpoint_ids or []),
            plan.carried_over,
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

        db = _firestore_client()

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
            try:
                doc_refs = [checkpoints_ref.document(cid) for cid in checkpoint_ids]
                fetched_by_id: Dict[str, Dict[str, Any]] = {}
                for checkpoint_doc in db.get_all(doc_refs):
                    if checkpoint_doc.exists:
                        checkpoint_data = checkpoint_doc.to_dict()
                        checkpoint_data["id"] = checkpoint_doc.id
                        fetched_by_id[checkpoint_doc.id] = checkpoint_data
                # Preserve requested order; get_all returns docs in arbitrary order.
                for checkpoint_id in checkpoint_ids:
                    checkpoint_data = fetched_by_id.get(checkpoint_id)
                    if checkpoint_data is not None:
                        checkpoints.append(checkpoint_data)
                    else:
                        logger.warning(
                            f"Checkpoint document {checkpoint_id} does not exist"
                        )
            except Exception as e:
                logger.error(
                    f"Error batch-fetching checkpoints {checkpoint_ids}: {e}",
                    exc_info=True,
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
                    min_similarity=CHECKPOINT_VECTOR_SIMILARITY_MIN,
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
                        "temporal_meta": None,
                    }
        elif date_range is not None:
            _temporal = time.monotonic()
            resolved_field: Optional[str] = None
            requested_label: Optional[str] = None
            known_locations: list[str] = []
            if explicit_location or location_intent is not None:
                resolved_field, requested_label, known_locations = _resolve_location_scope(
                    db,
                    user_id=user_id,
                    property_id=property_id,
                    explicit_location=explicit_location,
                    location_intent=location_intent,
                )
                location_meta = {
                    "requested": requested_label or "",
                    "matched_field": resolved_field,
                    "known_locations": known_locations,
                    "returned_count": 0,
                    "scope": "location",
                }
                if tool_context is not None:
                    tool_context.state[CHECKPOINT_LOCATION_META_STATE_KEY] = location_meta
                if not resolved_field:
                    logger.info(
                        "checkpoint_retrieval: date_range+location duration_ms=%d "
                        "requested=%r matched=None known=%r",
                        int((time.monotonic() - _temporal) * 1000),
                        requested_label,
                        known_locations,
                    )
                    logger.info(
                        "checkpoint_retrieval: end duration_ms=%d "
                        "outcome=no_location_matches checkpoints=0",
                        _elapsed_ms(),
                    )
                    _record_retrieval_timing()
                    return {
                        "checkpoints": [],
                        "search_query": "",
                        "inventory_meta": None,
                        "temporal_meta": None,
                        "location_meta": location_meta,
                    }

            list_result = list_checkpoints_in_date_range(
                db,
                user_id=user_id,
                property_id=property_id,
                date_range=date_range,
                location=resolved_field,
            )
            checkpoints = list_result.get("checkpoints") or []
            raw_temporal = list_result.get("temporal_meta")
            temporal_meta = raw_temporal if isinstance(raw_temporal, dict) else None
            if tool_context is not None and temporal_meta is not None:
                tool_context.state[CHECKPOINT_TEMPORAL_META_STATE_KEY] = temporal_meta
            if location_meta is not None:
                location_meta["returned_count"] = len(checkpoints)
                if tool_context is not None:
                    tool_context.state[CHECKPOINT_LOCATION_META_STATE_KEY] = location_meta
            logger.info(
                "checkpoint_retrieval: date_range duration_ms=%d returned=%d label=%r location=%r",
                int((time.monotonic() - _temporal) * 1000),
                len(checkpoints),
                date_range.label,
                resolved_field,
            )
            if not checkpoints:
                logger.info(
                    "checkpoint_retrieval: end duration_ms=%d outcome=no_temporal_matches checkpoints=0",
                    _elapsed_ms(),
                )
                _record_retrieval_timing()
                return {
                    "checkpoints": [],
                    "search_query": "",
                    "inventory_meta": None,
                    "temporal_meta": temporal_meta,
                    "location_meta": location_meta,
                }
        elif ck_mode == "location_filter":
            _loc = time.monotonic()
            resolved_field, requested_label, known_locations = _resolve_location_scope(
                db,
                user_id=user_id,
                property_id=property_id,
                explicit_location=explicit_location,
                location_intent=location_intent,
            )

            location_meta = {
                "requested": requested_label or "",
                "matched_field": resolved_field,
                "known_locations": known_locations,
                "returned_count": 0,
                "scope": "location",
            }
            if tool_context is not None:
                tool_context.state[CHECKPOINT_LOCATION_META_STATE_KEY] = location_meta

            if not resolved_field:
                logger.info(
                    "checkpoint_retrieval: location_filter duration_ms=%d "
                    "requested=%r matched=None known=%r",
                    int((time.monotonic() - _loc) * 1000),
                    requested_label,
                    known_locations,
                )
                logger.info(
                    "checkpoint_retrieval: end duration_ms=%d outcome=no_location_matches checkpoints=0",
                    _elapsed_ms(),
                )
                _record_retrieval_timing()
                return {
                    "checkpoints": [],
                    "search_query": "",
                    "inventory_meta": None,
                    "temporal_meta": None,
                    "location_meta": location_meta,
                }

            list_result = list_recent_property_checkpoints(
                db,
                user_id=user_id,
                property_id=property_id,
                location=resolved_field,
            )
            checkpoints = list_result.get("checkpoints") or []
            location_meta["matched_field"] = resolved_field
            location_meta["returned_count"] = len(checkpoints)
            if tool_context is not None:
                tool_context.state[CHECKPOINT_LOCATION_META_STATE_KEY] = location_meta
            logger.info(
                "checkpoint_retrieval: location_filter duration_ms=%d returned=%d "
                "requested=%r matched=%r",
                int((time.monotonic() - _loc) * 1000),
                len(checkpoints),
                requested_label,
                resolved_field,
            )
            if not checkpoints:
                logger.info(
                    "checkpoint_retrieval: end duration_ms=%d outcome=no_location_matches checkpoints=0",
                    _elapsed_ms(),
                )
                _record_retrieval_timing()
                return {
                    "checkpoints": [],
                    "search_query": "",
                    "inventory_meta": None,
                    "temporal_meta": None,
                    "location_meta": location_meta,
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
            vector_location = location
            if not vector_location and explicit_location:
                _resolved, _, _known = _resolve_location_scope(
                    db,
                    user_id=user_id,
                    property_id=property_id,
                    explicit_location=explicit_location,
                    location_intent=location_intent,
                )
                vector_location = _resolved
            checkpoints = search_checkpoints_by_vector(
                db=db,
                user_id=user_id,
                property_id=property_id,
                query_text=user_query,
                limit=5,
                location=vector_location,
                min_similarity=CHECKPOINT_VECTOR_SIMILARITY_MIN,
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

        logger.debug(
            "checkpoint_retrieval: formatting checkpoint_count=%d",
            len(checkpoints),
        )
        t_fmt = time.monotonic()
        formatted_results = format_raw_checkpoints(checkpoints)

        search_query = build_search_query_from_checkpoints(formatted_results)
        if refine_branch_intents:
            branch_intents = refine_checkpoint_branch_search_intents(
                search_query, formatted_results
            )
        else:
            from property_agent.checkpoint.branch_search_intents import (
                BranchSearchIntents,
            )

            logger.debug(
                "checkpoint_retrieval: branch intent refinement skipped (retrieval-only)"
            )
            branch_intents = BranchSearchIntents.fallback_from_raw_query(search_query)
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
        if (
            tool_context is not None
            and refine_branch_intents
            and branch_intents.issue_stem
        ):
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
            "temporal_meta": temporal_meta,
            "location_meta": location_meta,
        }
    except Exception as e:
        logger.error(f"Error retrieving checkpoints: {e}", exc_info=True)
        logger.info(
            "checkpoint_retrieval: end duration_ms=%d outcome=error checkpoints=0",
            _elapsed_ms(),
        )
        _record_retrieval_timing()
        return {
            "checkpoints": [],
            "search_query": "",
            "inventory_meta": None,
            "temporal_meta": None,
            "location_meta": None,
        }


__all__ = ["ask_checkpoints_retrieval", "build_search_query_from_checkpoints"]
