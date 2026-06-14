"""Append-only checkpoint comparison history."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from google.cloud import firestore


def _checkpoint_ref(
    db: firestore.Client, user_id: str, property_id: str, checkpoint_id: str
):
    return (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
        .document(checkpoint_id)
    )


def build_visual_diff_from_result(
    *,
    comparison_result: Dict[str, Any],
    compared_with_checkpoint_id: str,
    match_reason: Optional[str] = None,
    compared_with_revision_number: Optional[int] = None,
    diff_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a visualDiff payload from Gemini comparison output."""
    visual_diff: Dict[str, Any] = {
        "id": diff_id or f"diff_{uuid.uuid4().hex[:8]}",
        "status": "completed",
        "comparedWithCheckpointId": compared_with_checkpoint_id,
        "summary": comparison_result.get("summary", ""),
        "semanticChanges": comparison_result.get("semanticChanges", []),
        "regions": [
            {
                "id": f"region_{i}",
                "bbox": region.get("bbox") or {"x": 0, "y": 0, "width": 0, "height": 0},
                "changeType": region.get("changeType", "modified"),
                "severity": region.get("severity", "minor"),
                "confidence": region.get("confidence", 0.5),
                "description": region.get("description", ""),
                "changePercentage": 0,
            }
            for i, region in enumerate(comparison_result.get("regions", []))
        ],
        "similarityScore": comparison_result.get("similarityScore", 1.0),
        "completedAt": firestore.SERVER_TIMESTAMP,
    }
    if match_reason:
        visual_diff["matchReason"] = match_reason
    if compared_with_revision_number is not None:
        visual_diff["comparedWithRevisionNumber"] = compared_with_revision_number
    return visual_diff


def append_checkpoint_comparison(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    *,
    visual_diff: Dict[str, Any],
    source: str,
) -> str:
    """
    Append comparison to history subcollection and denormalize latest onto visualDiff.

    Path: checkpoints/{captureId}/comparisons/{comparisonId}
    """
    comparison_id = str(visual_diff.get("id") or f"diff_{uuid.uuid4().hex[:8]}")
    record = {
        **visual_diff,
        "id": comparison_id,
        "source": source,
    }
    cp_ref = _checkpoint_ref(db, user_id, property_id, checkpoint_id)
    comp_ref = cp_ref.collection("comparisons").document(comparison_id)
    batch = db.batch()
    batch.set(comp_ref, record)
    batch.update(cp_ref, {"visualDiff": visual_diff})
    batch.commit()
    return comparison_id


def delete_checkpoint_comparisons(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    checkpoint_id: str,
) -> int:
    """Delete all comparison history docs for a capture."""
    cp_ref = _checkpoint_ref(db, user_id, property_id, checkpoint_id)
    deleted = 0
    while True:
        docs = list(cp_ref.collection("comparisons").limit(200).stream())
        if not docs:
            break
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
            deleted += 1
        batch.commit()
    return deleted


def comparison_record_from_visual_diff(
    visual_diff: Dict[str, Any],
    *,
    source: str = "legacy",
) -> Dict[str, Any]:
    """Wrap an existing visualDiff as a comparison history record."""
    comparison_id = str(visual_diff.get("id") or f"diff_{uuid.uuid4().hex[:8]}")
    return {**visual_diff, "id": comparison_id, "source": source}
