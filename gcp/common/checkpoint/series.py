"""Checkpoint series (monitoring point) assignment and lifecycle."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

from google.cloud import firestore
from google.cloud.firestore_v1 import FieldFilter

logger = logging.getLogger(__name__)

CaptureKind = str  # scheduled | ad_hoc | baseline | reanalysis


def normalize_series_location(location: Optional[str]) -> str:
    normalized = (location or "unspecified").strip().lower()
    return normalized or "unspecified"


def series_display_name(location: Optional[str], name: Optional[str]) -> str:
    raw = (location or name or "Untitled").strip()
    return raw or "Untitled"


def make_series_id(location_key: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", location_key).strip("-") or "unspecified"
    return f"series_{slug}"[:1500]


def _series_collection(db: firestore.Client, user_id: str, property_id: str):
    return (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpointSeries")
    )


def _checkpoints_collection(db: firestore.Client, user_id: str, property_id: str):
    return (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
    )


def resolve_series_location_key(
    *,
    location: Optional[str],
    name: Optional[str] = None,
) -> str:
    return normalize_series_location(location or name)


def find_previous_capture_in_series(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    series_id: str,
    current_checkpoint_id: str,
    revision_number: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Return the prior capture in the same series (revision N-1)."""
    try:
        checkpoints_ref = _checkpoints_collection(db, user_id, property_id)
        if revision_number is not None and revision_number > 1:
            query = (
                checkpoints_ref.where(filter=FieldFilter("seriesId", "==", series_id))
                .where(filter=FieldFilter("revisionNumber", "==", revision_number - 1))
                .limit(1)
            )
            docs = list(query.stream())
            if docs:
                data = docs[0].to_dict() or {}
                data["id"] = docs[0].id
                return data
            return None

        query = (
            checkpoints_ref.where(filter=FieldFilter("seriesId", "==", series_id))
            .order_by("revisionNumber", direction=firestore.Query.DESCENDING)
            .limit(5)
        )
        for doc in query.stream():
            if doc.id == current_checkpoint_id:
                continue
            data = doc.to_dict() or {}
            data["id"] = doc.id
            return data
        return None
    except Exception as exc:
        logger.error("find_previous_capture_in_series failed: %s", exc, exc_info=True)
        return None


def assign_capture_to_series(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    *,
    location: Optional[str],
    name: Optional[str] = None,
    asset_type: Optional[str] = None,
    capture_kind: CaptureKind = "ad_hoc",
) -> Optional[Dict[str, Any]]:
    """
    Assign a checkpoint capture to a series (create series if needed).

    Uses a deterministic series document id per normalized location within the property.
    Idempotent when the capture already has seriesId.
    """
    location_key = resolve_series_location_key(location=location, name=name)
    series_id = make_series_id(location_key)
    display = series_display_name(location, name)

    @firestore.transactional
    def _tx(transaction: firestore.Transaction) -> Dict[str, Any]:
        cp_ref = _checkpoints_collection(db, user_id, property_id).document(checkpoint_id)
        series_ref = _series_collection(db, user_id, property_id).document(series_id)

        cp_snap = cp_ref.get(transaction=transaction)
        if not cp_snap.exists:
            raise ValueError(f"Checkpoint {checkpoint_id} not found")
        cp_data = cp_snap.to_dict() or {}
        existing_series_id = cp_data.get("seriesId")
        if existing_series_id:
            return {
                "seriesId": existing_series_id,
                "revisionNumber": cp_data.get("revisionNumber"),
                "isLatestInSeries": cp_data.get("isLatestInSeries"),
                "supersedesCaptureId": cp_data.get("supersedesCaptureId"),
            }

        series_snap = series_ref.get(transaction=transaction)
        now = firestore.SERVER_TIMESTAMP

        if series_snap.exists:
            series_data = series_snap.to_dict() or {}
            prev_latest_id = series_data.get("latestCaptureId")
            revision_number = int(series_data.get("captureCount") or 0) + 1
            supersedes_id = prev_latest_id

            if prev_latest_id:
                prev_ref = _checkpoints_collection(db, user_id, property_id).document(
                    str(prev_latest_id)
                )
                transaction.update(prev_ref, {"isLatestInSeries": False})

            capture_fields = {
                "seriesId": series_id,
                "revisionNumber": revision_number,
                "isLatestInSeries": True,
                "supersedesCaptureId": prev_latest_id,
                "captureKind": capture_kind,
            }
            transaction.update(cp_ref, capture_fields)
            transaction.update(
                series_ref,
                {
                    "latestCaptureId": checkpoint_id,
                    "captureCount": revision_number,
                    "updatedAt": now,
                },
            )
        else:
            revision_number = 1
            supersedes_id = None
            capture_fields = {
                "seriesId": series_id,
                "revisionNumber": 1,
                "isLatestInSeries": True,
                "supersedesCaptureId": None,
                "captureKind": capture_kind,
            }
            transaction.update(cp_ref, capture_fields)
            transaction.set(
                series_ref,
                {
                    "userId": user_id,
                    "propertyId": property_id,
                    "name": display,
                    "location": location_key,
                    "assetType": asset_type or "real_estate",
                    "createdAt": now,
                    "updatedAt": now,
                    "latestCaptureId": checkpoint_id,
                    "captureCount": 1,
                },
            )

        return {
            "seriesId": series_id,
            "revisionNumber": revision_number,
            "isLatestInSeries": True,
            "supersedesCaptureId": supersedes_id,
        }

    try:
        return _tx(db.transaction())
    except Exception as exc:
        logger.error(
            "assign_capture_to_series failed checkpoint=%s property=%s: %s",
            checkpoint_id,
            property_id,
            exc,
            exc_info=True,
        )
        return None


def assert_capture_deletable(checkpoint_data: Dict[str, Any]) -> None:
    """Raise when deleting a non-latest capture inside a series."""
    series_id = checkpoint_data.get("seriesId")
    if not series_id:
        return
    if checkpoint_data.get("isLatestInSeries") is False:
        raise ValueError(
            "Cannot delete a non-latest capture in a series. "
            "Delete the latest capture first or delete the entire series."
        )


def recompute_series_after_capture_delete(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    series_id: str,
    deleted_checkpoint_id: str,
    deleted_data: Dict[str, Any],
) -> None:
    """Update series metadata after the latest capture is deleted."""
    series_ref = _series_collection(db, user_id, property_id).document(series_id)
    series_snap = series_ref.get()
    if not series_snap.exists:
        return

    deleted_revision = deleted_data.get("revisionNumber")
    checkpoints_ref = _checkpoints_collection(db, user_id, property_id)

    new_latest_id: Optional[str] = None
    new_latest_revision: Optional[int] = None

    if deleted_revision and int(deleted_revision) > 1:
        prev_query = (
            checkpoints_ref.where(filter=FieldFilter("seriesId", "==", series_id))
            .where(filter=FieldFilter("revisionNumber", "==", int(deleted_revision) - 1))
            .limit(1)
        )
        prev_docs = list(prev_query.stream())
        if prev_docs:
            new_latest_id = prev_docs[0].id
            new_latest_revision = int(deleted_revision) - 1
            prev_docs[0].reference.update({"isLatestInSeries": True})

    if new_latest_id:
        series_ref.update(
            {
                "latestCaptureId": new_latest_id,
                "captureCount": new_latest_revision,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
    else:
        series_ref.delete()
