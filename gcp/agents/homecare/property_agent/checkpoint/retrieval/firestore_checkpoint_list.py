"""
List recent checkpoints for inventory/status queries (bounded, recency-ordered).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, TypedDict

from property_agent.checkpoint.constants import CHECKPOINT_INVENTORY_LIST_LIMIT
from property_agent.checkpoint.retrieval.temporal_query import CheckpointDateRange

logger = logging.getLogger(__name__)

try:
    from google.cloud import firestore as _firestore
except ImportError:  # pragma: no cover
    _firestore = None


class CheckpointInventoryMeta(TypedDict):
    total_count: int
    returned_count: int
    truncated: bool
    scope: str


class CheckpointTemporalMeta(TypedDict):
    label: str
    start_utc: str
    end_utc: str
    returned_count: int
    scope: str


def format_checkpoint_inventory_disclosure(meta: CheckpointInventoryMeta | Dict[str, Any]) -> str:
    """User-facing note for inventory list scope."""
    total = int(meta.get("total_count") or 0)
    returned = int(meta.get("returned_count") or 0)
    truncated = bool(meta.get("truncated"))
    if total <= 0 or returned <= 0:
        return ""
    if not truncated:
        if total == 1:
            return "Showing 1 checkpoint."
        return f"Showing all {total} checkpoints."
    return f"Showing the {returned} most recent of {total} checkpoints."


def _checkpoints_collection_ref(db: Any, *, user_id: str, property_id: str):
    return (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
    )


def _count_checkpoints(checkpoints_ref: Any) -> Optional[int]:
    try:
        agg = checkpoints_ref.count()
        results = agg.get()
        if results and results[0]:
            return int(results[0][0].value)
    except Exception as exc:
        logger.warning("checkpoint_inventory_list: count failed: %s", exc)
    return None


def list_recent_property_checkpoints(
    db: Any,
    *,
    user_id: str,
    property_id: str,
    limit: int = CHECKPOINT_INVENTORY_LIST_LIMIT,
    location: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch checkpoints ordered by ``createdAt`` descending (newest first).

    Returns ``{"checkpoints": [raw dicts with id], "inventory_meta": CheckpointInventoryMeta}``.
    """
    if _firestore is None:
        logger.error("checkpoint_inventory_list: google.cloud.firestore unavailable")
        return {
            "checkpoints": [],
            "inventory_meta": {
                "total_count": 0,
                "returned_count": 0,
                "truncated": False,
                "scope": "recent",
            },
        }

    checkpoints_ref = _checkpoints_collection_ref(
        db, user_id=user_id, property_id=property_id
    )
    fetch_limit = max(1, limit) + 1
    query = checkpoints_ref.order_by(
        "createdAt", direction=_firestore.Query.DESCENDING
    ).limit(fetch_limit)
    loc = (location or "").strip()
    if loc:
        query = (
            checkpoints_ref.where(filter=_firestore.FieldFilter("location", "==", loc))
            .order_by("createdAt", direction=_firestore.Query.DESCENDING)
            .limit(fetch_limit)
        )

    docs = list(query.stream())
    truncated = len(docs) > limit
    if truncated:
        docs = docs[:limit]

    checkpoints: List[Dict[str, Any]] = []
    for doc in docs:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        checkpoints.append(data)

    returned_count = len(checkpoints)
    if truncated:
        count_ref = checkpoints_ref
        if loc:
            count_ref = checkpoints_ref.where(
                filter=_firestore.FieldFilter("location", "==", loc)
            )
        total_count = _count_checkpoints(count_ref)
        if total_count is None:
            total_count = returned_count + 1
    else:
        total_count = returned_count

    meta: CheckpointInventoryMeta = {
        "total_count": total_count,
        "returned_count": returned_count,
        "truncated": truncated,
        "scope": "recent",
    }
    logger.info(
        "checkpoint_inventory_list: user_id=%s property_id=%s returned=%d total=%d truncated=%s location=%r",
        user_id,
        property_id,
        returned_count,
        total_count,
        truncated,
        loc or None,
    )
    return {"checkpoints": checkpoints, "inventory_meta": meta}


def list_checkpoint_location_values(
    db: Any,
    *,
    user_id: str,
    property_id: str,
    limit: int = CHECKPOINT_INVENTORY_LIST_LIMIT,
) -> List[str]:
    """Distinct ``location`` / ``detectedAsset`` values for a property (recent first)."""
    list_result = list_recent_property_checkpoints(
        db,
        user_id=user_id,
        property_id=property_id,
        limit=limit,
    )
    locations: List[str] = []
    seen: set[str] = set()
    for checkpoint in list_result.get("checkpoints") or []:
        if not isinstance(checkpoint, dict):
            continue
        ai = checkpoint.get("aiAnalysis") or {}
        loc = (
            (checkpoint.get("location") or "")
            or (ai.get("detectedAsset") if isinstance(ai, dict) else "")
            or ""
        ).strip()
        if loc and loc not in seen:
            seen.add(loc)
            locations.append(loc)
    return locations


def list_checkpoints_in_date_range(
    db: Any,
    *,
    user_id: str,
    property_id: str,
    date_range: CheckpointDateRange,
    location: Optional[str] = None,
    limit: int = CHECKPOINT_INVENTORY_LIST_LIMIT,
) -> Dict[str, Any]:
    """
    Fetch checkpoints whose ``createdAt`` falls in ``[start_utc, end_utc)``.

    Returns ``{"checkpoints": [...], "temporal_meta": CheckpointTemporalMeta}``.
    """
    if _firestore is None:
        logger.error("checkpoint_temporal_list: google.cloud.firestore unavailable")
        return {
            "checkpoints": [],
            "temporal_meta": {
                "label": date_range.label,
                "start_utc": date_range.start_utc.isoformat(),
                "end_utc": date_range.end_utc.isoformat(),
                "returned_count": 0,
                "scope": "temporal",
            },
        }

    checkpoints_ref = _checkpoints_collection_ref(
        db, user_id=user_id, property_id=property_id
    )
    loc = (location or "").strip()
    query = checkpoints_ref.where(
        filter=_firestore.FieldFilter("createdAt", ">=", date_range.start_utc)
    ).where(
        filter=_firestore.FieldFilter("createdAt", "<", date_range.end_utc)
    )
    if loc:
        query = query.where(filter=_firestore.FieldFilter("location", "==", loc))
    query = query.order_by(
        "createdAt", direction=_firestore.Query.DESCENDING
    ).limit(max(1, limit))

    checkpoints: List[Dict[str, Any]] = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        checkpoints.append(data)

    temporal_meta: CheckpointTemporalMeta = {
        "label": date_range.label,
        "start_utc": date_range.start_utc.isoformat(),
        "end_utc": date_range.end_utc.isoformat(),
        "returned_count": len(checkpoints),
        "scope": "temporal",
    }
    logger.info(
        "checkpoint_temporal_list: user_id=%s property_id=%s label=%r returned=%d location=%r",
        user_id,
        property_id,
        date_range.label,
        len(checkpoints),
        loc or None,
    )
    return {"checkpoints": checkpoints, "temporal_meta": temporal_meta}


__all__ = [
    "CheckpointInventoryMeta",
    "CheckpointTemporalMeta",
    "format_checkpoint_inventory_disclosure",
    "list_checkpoint_location_values",
    "list_checkpoints_in_date_range",
    "list_recent_property_checkpoints",
]
