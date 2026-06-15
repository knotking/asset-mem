"""Checkpoint series (monitoring point) assignment and lifecycle."""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

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
    allow_name_fallback: bool = True,
) -> str:
    if (location or "").strip():
        return normalize_series_location(location)
    if allow_name_fallback and (name or "").strip():
        return normalize_series_location(name)
    return "unspecified"


def target_series_id_for_location(location: Optional[str]) -> str:
    return make_series_id(normalize_series_location(location))


def user_provided_series_location(checkpoint_data: Dict[str, Any]) -> bool:
    """True when the user explicitly set location at create (not AI-inferred)."""
    flag = checkpoint_data.get("userProvidedLocation")
    if flag is not None:
        return bool(flag)
    return bool((checkpoint_data.get("location") or "").strip())


def should_reassign_series_after_analysis(
    checkpoint_data: Dict[str, Any],
    final_location: Optional[str],
) -> bool:
    """Whether analysis should move/reassign the capture to a location-based series."""
    if not (final_location or "").strip():
        return False
    if user_provided_series_location(checkpoint_data):
        return False
    target_series_id = target_series_id_for_location(final_location)
    return checkpoint_data.get("seriesId") != target_series_id


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


def _capture_sort_datetime(checkpoint: Dict[str, Any]) -> Optional[datetime]:
    created_at = checkpoint.get("createdAt")
    if created_at is None:
        created_at = checkpoint.get("capturedAt")
    if hasattr(created_at, "to_datetime"):
        dt = created_at.to_datetime()
    elif hasattr(created_at, "seconds"):
        dt = datetime.fromtimestamp(created_at.seconds, tz=timezone.utc)
    elif isinstance(created_at, datetime):
        dt = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _query_series_members(
    transaction: firestore.Transaction,
    db: firestore.Client,
    user_id: str,
    property_id: str,
    series_id: str,
) -> List[Dict[str, Any]]:
    query = _checkpoints_collection(db, user_id, property_id).where(
        filter=FieldFilter("seriesId", "==", series_id)
    )
    members: List[Dict[str, Any]] = []
    for doc in query.stream(transaction=transaction):
        data = doc.to_dict() or {}
        data["id"] = doc.id
        members.append(data)
    return members


def _sort_series_members_chronologically(
    members: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    def sort_key(member: Dict[str, Any]) -> tuple:
        dt = _capture_sort_datetime(member)
        if dt is None:
            dt = datetime.min.replace(tzinfo=timezone.utc)
        return (dt, str(member.get("id", "")))

    return sorted(members, key=sort_key)


def _build_chronological_series_fields(
    sorted_ids: List[str],
) -> Dict[str, Dict[str, Any]]:
    fields: Dict[str, Dict[str, Any]] = {}
    for index, member_id in enumerate(sorted_ids):
        fields[member_id] = {
            "revisionNumber": index + 1,
            "supersedesCaptureId": sorted_ids[index - 1] if index > 0 else None,
            "isLatestInSeries": index == len(sorted_ids) - 1,
        }
    return fields


def _apply_chronological_series_renumber(
    transaction: firestore.Transaction,
    db: firestore.Client,
    *,
    user_id: str,
    property_id: str,
    series_id: str,
    members: List[Dict[str, Any]],
    series_exists: bool,
    location_key: str,
    display: str,
    asset_type: Optional[str],
    focus_checkpoint_id: Optional[str] = None,
    per_checkpoint_extra: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    sorted_members = _sort_series_members_chronologically(members)
    sorted_ids = [str(member["id"]) for member in sorted_members]
    fields = _build_chronological_series_fields(sorted_ids)
    checkpoints_ref = _checkpoints_collection(db, user_id, property_id)
    series_ref = _series_collection(db, user_id, property_id).document(series_id)
    now = firestore.SERVER_TIMESTAMP

    for member_id in sorted_ids:
        revision = fields[member_id]
        extra = (per_checkpoint_extra or {}).get(member_id, {})
        transaction.update(
            checkpoints_ref.document(member_id),
            {
                "seriesId": series_id,
                "revisionNumber": revision["revisionNumber"],
                "isLatestInSeries": revision["isLatestInSeries"],
                "supersedesCaptureId": revision["supersedesCaptureId"],
                **extra,
            },
        )

    latest_id = sorted_ids[-1]
    first_id = sorted_ids[0]
    series_update = {
        "latestCaptureId": latest_id,
        "captureCount": len(sorted_ids),
        "updatedAt": now,
        "name": display,
        "location": location_key,
    }
    if series_exists:
        transaction.update(series_ref, series_update)
    else:
        transaction.set(
            series_ref,
            {
                "userId": user_id,
                "propertyId": property_id,
                "assetType": asset_type or "real_estate",
                "createdAt": now,
                "baselineCaptureId": first_id,
                **series_update,
            },
        )

    focus_id = focus_checkpoint_id or latest_id
    focus_fields = fields[focus_id]
    return {
        "seriesId": series_id,
        "revisionNumber": focus_fields["revisionNumber"],
        "isLatestInSeries": focus_fields["isLatestInSeries"],
        "supersedesCaptureId": focus_fields["supersedesCaptureId"],
    }


def _sync_remaining_series_members_chronologically(
    transaction: firestore.Transaction,
    db: firestore.Client,
    *,
    user_id: str,
    property_id: str,
    series_id: str,
    members: List[Dict[str, Any]],
    location_key: str,
    display: str,
    asset_type: Optional[str],
) -> None:
    series_ref = _series_collection(db, user_id, property_id).document(series_id)
    if not members:
        transaction.delete(series_ref)
        return

    _apply_chronological_series_renumber(
        transaction,
        db,
        user_id=user_id,
        property_id=property_id,
        series_id=series_id,
        members=members,
        series_exists=True,
        location_key=location_key,
        display=display,
        asset_type=asset_type,
    )


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
        existing_members = (
            _query_series_members(transaction, db, user_id, property_id, series_id)
            if series_snap.exists
            else []
        )
        existing_members = [
            member for member in existing_members if member.get("id") != checkpoint_id
        ]
        moving_member = {**cp_data, "id": checkpoint_id}

        return _apply_chronological_series_renumber(
            transaction,
            db,
            user_id=user_id,
            property_id=property_id,
            series_id=series_id,
            members=[*existing_members, moving_member],
            series_exists=series_snap.exists,
            location_key=location_key,
            display=display,
            asset_type=asset_type,
            focus_checkpoint_id=checkpoint_id,
            per_checkpoint_extra={
                checkpoint_id: {"captureKind": capture_kind},
            },
        )

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


def _attach_capture_to_series(
    transaction: firestore.Transaction,
    db: firestore.Client,
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    series_id: str,
    *,
    location_key: str,
    display: str,
    asset_type: Optional[str],
    capture_kind: CaptureKind,
    moving_checkpoint_data: Dict[str, Any],
    existing_members: List[Dict[str, Any]],
    series_exists: bool,
    mark_user_provided: bool = False,
) -> Dict[str, Any]:
    members = [
        member for member in existing_members if member.get("id") != checkpoint_id
    ]
    members.append({**moving_checkpoint_data, "id": checkpoint_id})
    extras: Dict[str, Dict[str, Any]] = {
        checkpoint_id: {"captureKind": capture_kind},
    }
    if mark_user_provided:
        extras[checkpoint_id]["location"] = display
        extras[checkpoint_id]["userProvidedLocation"] = True

    return _apply_chronological_series_renumber(
        transaction,
        db,
        user_id=user_id,
        property_id=property_id,
        series_id=series_id,
        members=members,
        series_exists=series_exists,
        location_key=location_key,
        display=display,
        asset_type=asset_type,
        focus_checkpoint_id=checkpoint_id,
        per_checkpoint_extra=extras,
    )


def reassign_capture_to_series(
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
    Move a capture into the series for the given location (create/join as needed).

    Only supports reassigning the latest capture in its current series.
    """
    if not (location or "").strip():
        raise ValueError("location is required to reassign a capture to a series")

    location_key = normalize_series_location(location)
    series_id = make_series_id(location_key)
    display = series_display_name(location, name)

    @firestore.transactional
    def _tx(transaction: firestore.Transaction) -> Dict[str, Any]:
        cp_ref = _checkpoints_collection(db, user_id, property_id).document(
            checkpoint_id
        )
        cp_snap = cp_ref.get(transaction=transaction)
        if not cp_snap.exists:
            raise ValueError(f"Checkpoint {checkpoint_id} not found")
        cp_data = cp_snap.to_dict() or {}
        old_series_id = cp_data.get("seriesId")

        if cp_data.get("isLatestInSeries") is False:
            raise ValueError(
                "Cannot reassign a non-latest capture in a series. "
                "Reassign the latest capture first."
            )

        target_series_ref = _series_collection(db, user_id, property_id).document(series_id)
        target_series_snap = target_series_ref.get(transaction=transaction)
        target_members = (
            _query_series_members(transaction, db, user_id, property_id, series_id)
            if target_series_snap.exists
            else []
        )

        old_series_snap = None
        old_members: List[Dict[str, Any]] = []
        if old_series_id and old_series_id != series_id:
            old_series_snap = (
                _series_collection(db, user_id, property_id)
                .document(str(old_series_id))
                .get(transaction=transaction)
            )
            old_members = _query_series_members(
                transaction, db, user_id, property_id, str(old_series_id)
            )

        if old_series_id == series_id:
            return _apply_chronological_series_renumber(
                transaction,
                db,
                user_id=user_id,
                property_id=property_id,
                series_id=series_id,
                members=target_members,
                series_exists=True,
                location_key=location_key,
                display=display,
                asset_type=asset_type or cp_data.get("assetType"),
                focus_checkpoint_id=checkpoint_id,
                per_checkpoint_extra={
                    checkpoint_id: {
                        "captureKind": capture_kind or cp_data.get("captureKind") or "ad_hoc",
                        "location": display,
                        "userProvidedLocation": True,
                    }
                },
            )

        if old_series_id and old_series_id != series_id:
            remaining_members = [
                member
                for member in old_members
                if member.get("id") != checkpoint_id
            ]
            old_series_data = old_series_snap.to_dict() if old_series_snap and old_series_snap.exists else {}
            _sync_remaining_series_members_chronologically(
                transaction,
                db,
                user_id=user_id,
                property_id=property_id,
                series_id=str(old_series_id),
                members=remaining_members,
                location_key=str(old_series_data.get("location") or "unspecified"),
                display=str(old_series_data.get("name") or "Untitled"),
                asset_type=old_series_data.get("assetType"),
            )

        return _attach_capture_to_series(
            transaction,
            db,
            user_id,
            property_id,
            checkpoint_id,
            series_id,
            location_key=location_key,
            display=display,
            asset_type=asset_type or cp_data.get("assetType"),
            capture_kind=capture_kind or cp_data.get("captureKind") or "ad_hoc",
            moving_checkpoint_data=cp_data,
            existing_members=target_members,
            series_exists=target_series_snap.exists,
            mark_user_provided=True,
        )

    try:
        return _tx(db.transaction())
    except Exception as exc:
        logger.error(
            "reassign_capture_to_series failed checkpoint=%s property=%s: %s",
            checkpoint_id,
            property_id,
            exc,
            exc_info=True,
        )
        return None


def resolve_series_after_analysis(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    checkpoint_data: Dict[str, Any],
    *,
    final_location: Optional[str],
    final_name: Optional[str] = None,
    asset_type: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Assign or reassign series after analysis when location is known.

    - User-provided location: assign only if seriesId missing (idempotent otherwise).
    - AI-inferred location: assign or reassign to location-based series.
    """
    if not (final_location or "").strip():
        return None

    user_provided = user_provided_series_location(checkpoint_data)
    current_series_id = checkpoint_data.get("seriesId")

    if user_provided:
        if current_series_id:
            return None
        return assign_capture_to_series(
            db,
            user_id,
            property_id,
            checkpoint_id,
            location=final_location,
            name=final_name,
            asset_type=asset_type,
        )

    if should_reassign_series_after_analysis(checkpoint_data, final_location):
        if current_series_id:
            return reassign_capture_to_series(
                db,
                user_id,
                property_id,
                checkpoint_id,
                location=final_location,
                name=final_name,
                asset_type=asset_type,
            )
        return assign_capture_to_series(
            db,
            user_id,
            property_id,
            checkpoint_id,
            location=final_location,
            name=final_name,
            asset_type=asset_type,
        )

    if not current_series_id:
        return assign_capture_to_series(
            db,
            user_id,
            property_id,
            checkpoint_id,
            location=final_location,
            name=final_name,
            asset_type=asset_type,
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


def series_key_for_checkpoint(checkpoint: Dict[str, Any]) -> str:
    series_id = checkpoint.get("seriesId")
    if series_id:
        return str(series_id)
    location_key = normalize_series_location(
        checkpoint.get("location") or checkpoint.get("name")
    )
    return f"legacy-loc:{location_key}"


def _capture_is_newer_than(current: Dict[str, Any], other: Dict[str, Any]) -> bool:
    if current.get("isLatestInSeries") and not other.get("isLatestInSeries"):
        return True
    if other.get("isLatestInSeries") and not current.get("isLatestInSeries"):
        return False
    rev_current = int(current.get("revisionNumber") or 0)
    rev_other = int(other.get("revisionNumber") or 0)
    if rev_current != rev_other:
        return rev_current > rev_other
    dt_current = _capture_sort_datetime(current)
    dt_other = _capture_sort_datetime(other)
    if dt_current and dt_other:
        return dt_current > dt_other
    return False


def pick_latest_captures_per_series(
    checkpoints: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Keep the newest capture per series (or legacy location bucket)."""
    latest_by_key: Dict[str, Dict[str, Any]] = {}
    for checkpoint in checkpoints:
        key = series_key_for_checkpoint(checkpoint)
        existing = latest_by_key.get(key)
        if existing is None or _capture_is_newer_than(checkpoint, existing):
            latest_by_key[key] = checkpoint
    return list(latest_by_key.values())
