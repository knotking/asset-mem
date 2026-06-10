"""Server-side deletion orchestration (property jobs, RAG, shared chats, user erasure)."""

from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from common.observability.logging_context import get_correlation_id

from google.api_core import exceptions as api_exceptions
from google.cloud import firestore, storage
from google.cloud.firestore_v1.base_query import FieldFilter

from common.rag.delete import delete_rag_files_by_gcs_uris
from services.vertex_service import delete_reasoning_engine_session

logger = logging.getLogger(__name__)

FIRESTORE_BATCH_SIZE = 450
BATCH_DELETE_MAX = 50
FIRESTORE_COMMIT_MAX_ATTEMPTS = 5
FIRESTORE_COMMIT_RETRY_BASE_SECONDS = 1.0
# Client uploads (documents/, uploads/) live in the Firebase Storage bucket — not GCS_BUCKET.
GCS_USER_DATA_BUCKET_ENV_KEYS = ("GCS_BUCKET",)
JOB_LEASE_SECONDS = int(os.environ.get("DELETION_JOB_LEASE_SECONDS", "600"))
_STALE_JOB_ERROR = "Deletion job became stale (server restarted or timed out)"

_TRANSIENT_FIRESTORE_MARKERS = (
    "stream removed",
    "connection reset",
    "connection refused",
    "deadline exceeded",
    "unavailable",
    "internal error",
    "ssl",
    "bad_record_mac",
    "corruption detected",
)


def _firebase_storage_bucket_name() -> str | None:
    """Bucket for Firebase client paths (documents/{uid}/, uploads/{uid}/)."""
    explicit = (os.environ.get("FIREBASE_STORAGE_BUCKET") or "").strip()
    if explicit:
        return explicit.replace("gs://", "")
    for key in ("GCP_PROJECT_ID", "GOOGLE_CLOUD_PROJECT"):
        project = (os.environ.get(key) or "").strip()
        if project:
            return f"{project}.firebasestorage.app"
    return None


def _user_data_bucket_name() -> str | None:
    """Bucket for RAG / user-data imports (homegeek-user-data-*)."""
    for key in GCS_USER_DATA_BUCKET_ENV_KEYS:
        value = (os.environ.get(key) or "").strip()
        if value:
            return value.replace("gs://", "")
    return None


def _job_ref(db: firestore.Client, user_id: str, job_id: str):
    return db.collection("users").document(user_id).collection("deletionJobs").document(job_id)


def _audit_ref(db: firestore.Client, user_id: str, event_id: str):
    return db.collection("users").document(user_id).collection("deletionAudit").document(event_id)


def _notification_ref(db: firestore.Client, user_id: str, notification_id: str):
    return db.collection("users").document(user_id).collection("notifications").document(notification_id)


def _property_job_id(property_id: str) -> str:
    return f"property_{property_id}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _firestore_timestamp_to_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if hasattr(value, "timestamp"):
        return datetime.fromtimestamp(value.timestamp(), tz=timezone.utc)
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return None


def _is_job_lease_expired(data: dict[str, Any], *, now: datetime | None = None) -> bool:
    lease = _firestore_timestamp_to_datetime(data.get("leaseExpiresAt"))
    if lease is None:
        return True
    now = now or _utcnow()
    return lease < now


def can_retry_deletion_job(data: dict[str, Any], *, now: datetime | None = None) -> bool:
    status = data.get("status")
    if status in ("failed", "stale"):
        return True
    if status == "running":
        return _is_job_lease_expired(data, now=now)
    return False


def _update_job(
    db: firestore.Client,
    user_id: str,
    job_id: str,
    *,
    status: str,
    phase: str | None = None,
    warnings: list[str] | None = None,
    error: str | None = None,
) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if phase is not None:
        payload["phase"] = phase
    if warnings is not None:
        payload["warnings"] = warnings
    if error is not None:
        payload["error"] = error
    if status == "completed":
        payload["completedAt"] = firestore.SERVER_TIMESTAMP
    if status == "running":
        now = _utcnow()
        payload["lastHeartbeatAt"] = now
        payload["leaseExpiresAt"] = now + timedelta(seconds=JOB_LEASE_SECONDS)
    _commit_with_retry(lambda: _job_ref(db, user_id, job_id).set(payload, merge=True))


def _is_transient_firestore_error(exc: BaseException) -> bool:
    if isinstance(
        exc,
        (
            api_exceptions.ServiceUnavailable,
            api_exceptions.DeadlineExceeded,
            api_exceptions.Aborted,
            api_exceptions.InternalServerError,
            api_exceptions.Unknown,
        ),
    ):
        return True
    msg = str(exc).lower()
    return any(marker in msg for marker in _TRANSIENT_FIRESTORE_MARKERS)


def _commit_with_retry(operation, *, attempts: int = FIRESTORE_COMMIT_MAX_ATTEMPTS) -> None:
    last_exc: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            operation()
            return
        except Exception as exc:
            last_exc = exc
            if attempt >= attempts or not _is_transient_firestore_error(exc):
                raise
            sleep_seconds = FIRESTORE_COMMIT_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            logger.warning(
                "transient Firestore error (attempt %s/%s), retrying in %.1fs: %s",
                attempt,
                attempts,
                sleep_seconds,
                exc,
            )
            time.sleep(sleep_seconds)
    if last_exc is not None:
        raise last_exc


def _commit_batch_with_retry(db: firestore.Client, batch: firestore.WriteBatch) -> None:
    _commit_with_retry(batch.commit)


def _delete_doc_with_retry(doc_ref) -> None:
    _commit_with_retry(doc_ref.delete)


def _set_doc_merge_with_retry(doc_ref, payload: dict[str, Any]) -> None:
    _commit_with_retry(lambda: doc_ref.set(payload, merge=True))

def _document_ref(db: firestore.Client, user_id: str, doc_id: str):
    return db.collection("users").document(user_id).collection("docs").document(doc_id)


def _chat_ref(db: firestore.Client, user_id: str, session_id: str):
    return db.collection("users").document(user_id).collection("chats").document(session_id)


def _checkpoint_ref(db: firestore.Client, user_id: str, property_id: str, checkpoint_id: str):
    return (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
        .document(checkpoint_id)
    )


def _report_ref(db: firestore.Client, user_id: str, property_id: str, report_id: str):
    return (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("reports")
        .document(report_id)
    )


def _mark_resource_deleting(doc_ref, *, batch_id: str | None = None) -> bool:
    """Mark a leaf resource as deleting. Returns False if the doc does not exist."""
    if not doc_ref.get().exists:
        return False
    payload: dict[str, Any] = {
        "deletionStatus": "deleting",
        "deletionStartedAt": firestore.SERVER_TIMESTAMP,
        "deletionError": firestore.DELETE_FIELD,
        "deletionFailedAt": firestore.DELETE_FIELD,
    }
    if batch_id:
        payload["deletionBatchId"] = batch_id
    else:
        payload["deletionBatchId"] = firestore.DELETE_FIELD
    _set_doc_merge_with_retry(doc_ref, payload)
    return True


def _mark_resource_delete_failed(doc_ref, message: str) -> None:
    if not doc_ref.get().exists:
        return
    _set_doc_merge_with_retry(
        doc_ref,
        {
            "deletionStatus": "failed",
            "deletionError": message[:500],
            "deletionFailedAt": firestore.SERVER_TIMESTAMP,
        },
    )


def _batch_mark_resources_deleting(db: firestore.Client, refs: list, batch_id: str) -> None:
    for offset in range(0, len(refs), FIRESTORE_BATCH_SIZE):
        chunk = refs[offset : offset + FIRESTORE_BATCH_SIZE]
        batch = db.batch()
        has_writes = False
        for doc_ref in chunk:
            if not doc_ref.get().exists:
                continue
            batch.set(
                doc_ref,
                {
                    "deletionStatus": "deleting",
                    "deletionStartedAt": firestore.SERVER_TIMESTAMP,
                    "deletionBatchId": batch_id,
                    "deletionError": firestore.DELETE_FIELD,
                    "deletionFailedAt": firestore.DELETE_FIELD,
                },
                merge=True,
            )
            has_writes = True
        if has_writes:
            _commit_batch_with_retry(db, batch)


def _finalize_stuck_deleting_refs(refs: list) -> None:
    """Mark any resources still in deleting state as failed (batch interrupted)."""
    for doc_ref in refs:
        snap = doc_ref.get()
        if not snap.exists:
            continue
        if (snap.to_dict() or {}).get("deletionStatus") == "deleting":
            _mark_resource_delete_failed(doc_ref, "Deletion did not complete")





def _delete_collection_docs(db: firestore.Client, col_ref) -> int:
    """Delete all docs in a collection using paginated batches (idempotent)."""
    deleted = 0
    while True:
        docs = list(col_ref.limit(FIRESTORE_BATCH_SIZE).stream())
        if not docs:
            break
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        _commit_batch_with_retry(db, batch)
        deleted += len(docs)
    return deleted


def _delete_document_tree(db: firestore.Client, doc_ref) -> int:
    deleted = 0
    for sub in doc_ref.collections():
        for child in sub.stream():
            deleted += _delete_document_tree(db, child.reference)
            _delete_doc_with_retry(child.reference)
            deleted += 1
    return deleted


def _gs_uri_to_storage_path(gs_uri: str) -> str | None:
    if not gs_uri or not gs_uri.startswith("gs://"):
        return None
    parts = gs_uri[5:].split("/", 1)
    return parts[1] if len(parts) == 2 else None


def _append_storage_path(paths: list[str], value: str | None) -> None:
    if value and value.strip():
        paths.append(value.strip())


def _delete_property_storage(
    user_id: str, property_id: str, storage_paths: list[str]
) -> list[str]:
    warnings: list[str] = []
    bucket = _firebase_storage_bucket_name()
    if not bucket:
        warnings.append("FIREBASE_STORAGE_BUCKET not configured; skipped client storage paths")
        return warnings
    normalized_paths = list(dict.fromkeys(storage_paths))
    for path in normalized_paths:
        _, path_warnings = _delete_gcs_prefix(bucket, path)
        warnings.extend(path_warnings)
    _, prefix_warnings = _delete_gcs_prefix(bucket, f"uploads/{user_id}/properties/{property_id}/")
    warnings.extend(prefix_warnings)
    return warnings


def delete_rag_files(gs_uris: list[str]) -> dict[str, Any]:
    deleted, warnings = delete_rag_files_by_gcs_uris(gs_uris)
    return {"deleted": deleted, "warnings": warnings}


def delete_agent_sessions(user_id: str, session_ids: list[str]) -> dict[str, Any]:
    warnings: list[str] = []
    deleted = 0
    for session_id in session_ids:
        if not session_id:
            continue
        try:
            delete_reasoning_engine_session(user_id, session_id)
            deleted += 1
        except Exception as exc:
            msg = str(exc)
            if "404" in msg or "not found" in msg.lower():
                deleted += 1
                continue
            warnings.append(f"session {session_id}: {exc}")
    return {"deleted": deleted, "warnings": warnings}


def delete_shared_chats_for_session(db: firestore.Client, user_id: str, session_id: str) -> dict[str, Any]:
    warnings: list[str] = []
    deleted = 0
    query = (
        db.collection("sharedChats")
        .where(filter=FieldFilter("originalUserId", "==", user_id))
        .where(filter=FieldFilter("originalSessionId", "==", session_id))
    )
    for snap in query.stream():
        try:
            _delete_collection_docs(db, snap.reference.collection("messages"))
            _delete_doc_with_retry(snap.reference)
            deleted += 1
        except Exception as exc:
            warnings.append(f"sharedChat {snap.id}: {exc}")
    return {"deleted": deleted, "warnings": warnings}


def delete_document_asset(
    db: firestore.Client,
    user_id: str,
    doc_id: str,
    storage_path: str | None = None,
    gs_uri: str | None = None,
) -> dict[str, Any]:
    warnings: list[str] = []
    bucket = _firebase_storage_bucket_name()
    if bucket and storage_path:
        _, path_warnings = _delete_gcs_prefix(bucket, storage_path)
        warnings.extend(path_warnings)

    doc_ref = db.collection("users").document(user_id).collection("docs").document(doc_id)
    if doc_ref.get().exists:
        _delete_doc_with_retry(doc_ref)

    if gs_uri:
        rag_result = delete_rag_files([gs_uri])
        warnings.extend(rag_result.get("warnings") or [])

    return {"deleted": True, "warnings": warnings}


def delete_checkpoint_asset(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    checkpoint_id: str,
    *,
    rebuild_metrics: bool = True,
) -> dict[str, Any]:
    warnings: list[str] = []
    cp_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
        .document(checkpoint_id)
    )
    snap = cp_ref.get()
    storage_paths: list[str] = []
    if snap.exists:
        data = snap.to_dict() or {}
        for media in data.get("media") or []:
            if isinstance(media, dict):
                _append_storage_path(storage_paths, media.get("storagePath"))
                if media.get("gsURI"):
                    _append_storage_path(storage_paths, _gs_uri_to_storage_path(str(media["gsURI"])))

    bucket = _firebase_storage_bucket_name()
    if bucket:
        for path in list(dict.fromkeys(storage_paths)):
            _, path_warnings = _delete_gcs_prefix(bucket, path)
            warnings.extend(path_warnings)

    if snap.exists:
        _delete_doc_with_retry(cp_ref)

    if rebuild_metrics:
        from services.checkpoint_service import publish_checkpoint_metrics_rebuild

        try:
            publish_checkpoint_metrics_rebuild(
                user_id=user_id,
                property_id=property_id,
                reason="checkpoint.deleted",
            )
        except Exception as exc:
            logger.warning(
                "Failed to publish metrics rebuild after checkpoint delete user=%s property=%s checkpoint=%s: %s",
                user_id,
                property_id,
                checkpoint_id,
                exc,
            )
            warnings.append(f"metrics rebuild: {exc}")

    return {"deleted": True, "warnings": warnings}


def delete_report_asset(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    report_id: str,
) -> dict[str, Any]:
    warnings: list[str] = []
    report_ref = _report_ref(db, user_id, property_id, report_id)
    snap = report_ref.get()
    gs_uris: list[str] = []
    storage_paths: list[str] = []

    if snap.exists:
        data = snap.to_dict() or {}
        share_id = data.get("shareId")
        if share_id:
            share_ref = db.collection("sharedReports").document(str(share_id))
            if share_ref.get().exists:
                try:
                    _delete_doc_with_retry(share_ref)
                except Exception as exc:
                    warnings.append(f"sharedReport {share_id}: {exc}")
        _append_storage_path(storage_paths, data.get("pdfStoragePath"))
        if data.get("pdfGsUri"):
            uri = str(data["pdfGsUri"])
            gs_uris.append(uri)
            _append_storage_path(storage_paths, _gs_uri_to_storage_path(uri))
        if data.get("ragGsUri"):
            gs_uris.append(str(data["ragGsUri"]))
        companion_id = data.get("ragCompanionDocId")
        if companion_id:
            companion_ref = (
                db.collection("users")
                .document(user_id)
                .collection("docs")
                .document(str(companion_id))
            )
            if companion_ref.get().exists:
                try:
                    _delete_doc_with_retry(companion_ref)
                except Exception as exc:
                    warnings.append(f"ragCompanionDoc {companion_id}: {exc}")

        for rev in report_ref.collection("revisions").stream():
            rev_data = rev.to_dict() or {}
            _append_storage_path(storage_paths, rev_data.get("pdfStoragePath"))
            if rev_data.get("pdfGsUri"):
                uri = str(rev_data["pdfGsUri"])
                gs_uris.append(uri)
                _append_storage_path(storage_paths, _gs_uri_to_storage_path(uri))
            _delete_doc_with_retry(rev.reference)

    bucket = _firebase_storage_bucket_name()
    if bucket:
        prefix = f"uploads/{user_id}/properties/{property_id}/reports/{report_id}/"
        _, prefix_warnings = _delete_gcs_prefix(bucket, prefix)
        warnings.extend(prefix_warnings)
        for path in list(dict.fromkeys(storage_paths)):
            _, path_warnings = _delete_gcs_prefix(bucket, path)
            warnings.extend(path_warnings)

    if gs_uris:
        rag_result = delete_rag_files(list(dict.fromkeys(gs_uris)))
        warnings.extend(rag_result.get("warnings") or [])

    if snap.exists:
        _delete_doc_with_retry(report_ref)

    return {"deleted": True, "warnings": warnings}


def _message_storage_paths(message_data: dict[str, Any]) -> list[str]:
    paths: list[str] = []
    file_obj = message_data.get("file")
    if isinstance(file_obj, dict):
        if file_obj.get("storagePath"):
            _append_storage_path(paths, str(file_obj["storagePath"]))
        if file_obj.get("gsURI"):
            _append_storage_path(paths, _gs_uri_to_storage_path(str(file_obj["gsURI"])))
    return paths


def delete_chat_session_full(
    db: firestore.Client,
    user_id: str,
    session_id: str,
) -> dict[str, Any]:
    warnings: list[str] = []
    chat_ref = db.collection("users").document(user_id).collection("chats").document(session_id)
    snap = chat_ref.get()
    bucket = _firebase_storage_bucket_name()
    if bucket:
        for msg in chat_ref.collection("messages").stream():
            data = msg.to_dict() or {}
            for path in _message_storage_paths(data):
                _, path_warnings = _delete_gcs_prefix(bucket, path)
                warnings.extend(path_warnings)

    if snap.exists:
        data = snap.to_dict() or {}
        agent_session_id = data.get("agentSessionId")
        if agent_session_id:
            agent_result = delete_agent_sessions(user_id, [str(agent_session_id)])
            warnings.extend(agent_result.get("warnings") or [])

    shared_result = delete_shared_chats_for_session(db, user_id, session_id)
    warnings.extend(shared_result.get("warnings") or [])

    _delete_collection_docs(db, chat_ref.collection("messages"))
    if chat_ref.get().exists:
        _delete_doc_with_retry(chat_ref)

    return {"deleted": True, "warnings": warnings}


def delete_shared_chats_for_property(db: firestore.Client, user_id: str, property_id: str) -> dict[str, Any]:
    warnings: list[str] = []
    deleted = 0
    query = (
        db.collection("sharedChats")
        .where(filter=FieldFilter("originalUserId", "==", user_id))
        .where(filter=FieldFilter("propertyId", "==", property_id))
    )
    for snap in query.stream():
        try:
            _delete_collection_docs(db, snap.reference.collection("messages"))
            _delete_doc_with_retry(snap.reference)
            deleted += 1
        except Exception as exc:
            warnings.append(f"sharedChat {snap.id}: {exc}")
    return {"deleted": deleted, "warnings": warnings}


def _delete_gcs_blob(bucket, blob_name: str) -> tuple[bool, str | None]:
    try:
        blob = bucket.blob(blob_name)
        if blob.exists():
            blob.delete()
        return True, None
    except Exception as exc:
        return False, str(exc)


def _delete_gcs_prefix(bucket_name: str, prefix: str) -> tuple[int, list[str]]:
    warnings: list[str] = []
    deleted = 0
    if not prefix:
        return 0, warnings
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        normalized = prefix.rstrip("/")
        if "/" not in normalized or normalized.endswith((".pdf", ".jpg", ".jpeg", ".png", ".mp4", ".doc", ".docx")):
            ok, err = _delete_gcs_blob(bucket, normalized)
            if ok:
                deleted += 1
            elif err:
                warnings.append(f"gcs {normalized}: {err}")
            return deleted, warnings
        for blob in bucket.list_blobs(prefix=f"{normalized}/"):
            try:
                blob.delete()
                deleted += 1
            except Exception as exc:
                warnings.append(f"gcs {blob.name}: {exc}")
    except Exception as exc:
        warnings.append(f"gcs prefix {prefix}: {exc}")
    return deleted, warnings


def _collect_property_assets(db: firestore.Client, user_id: str, property_id: str) -> dict[str, Any]:
    user_ref = db.collection("users").document(user_id)
    gs_uris: list[str] = []
    storage_paths: list[str] = []
    agent_session_ids: list[str] = []

    docs_query = user_ref.collection("docs").where(filter=FieldFilter("propertyId", "==", property_id))
    for snap in docs_query.stream():
        data = snap.to_dict() or {}
        if data.get("gsURI"):
            gs_uris.append(str(data["gsURI"]))
        if data.get("storagePath"):
            storage_paths.append(str(data["storagePath"]))

    prop_ref = user_ref.collection("properties").document(property_id)
    for cp in prop_ref.collection("checkpoints").stream():
        data = cp.to_dict() or {}
        for media in data.get("media") or []:
            if isinstance(media, dict):
                if media.get("gsURI"):
                    gs_uris.append(str(media["gsURI"]))
                if media.get("storagePath"):
                    storage_paths.append(str(media["storagePath"]))

    for report in prop_ref.collection("reports").stream():
        data = report.to_dict() or {}
        if data.get("pdfGsUri"):
            gs_uris.append(str(data["pdfGsUri"]))
        if data.get("pdfStoragePath"):
            storage_paths.append(str(data["pdfStoragePath"]))
        if data.get("ragGsUri"):
            gs_uris.append(str(data["ragGsUri"]))

    chats_query = user_ref.collection("chats").where(filter=FieldFilter("propertyId", "==", property_id))
    for chat in chats_query.stream():
        data = chat.to_dict() or {}
        if data.get("agentSessionId"):
            agent_session_ids.append(str(data["agentSessionId"]))
        for msg in chat.reference.collection("messages").stream():
            msg_data = msg.to_dict() or {}
            file_data = msg_data.get("file") or {}
            if isinstance(file_data, dict):
                if file_data.get("gsURI"):
                    uri = str(file_data["gsURI"])
                    gs_uris.append(uri)
                    _append_storage_path(storage_paths, _gs_uri_to_storage_path(uri))
                _append_storage_path(storage_paths, file_data.get("storagePath"))

    return {
        "gs_uris": list(dict.fromkeys(gs_uris)),
        "storage_paths": list(dict.fromkeys(storage_paths)),
        "agent_session_ids": list(dict.fromkeys(agent_session_ids)),
    }


def _delete_property_firestore(
    db: firestore.Client, user_id: str, property_id: str
) -> None:
    user_ref = db.collection("users").document(user_id)
    prop_ref = user_ref.collection("properties").document(property_id)

    _delete_collection_docs(db, prop_ref.collection("checkpoints"))
    for report in prop_ref.collection("reports").stream():
        _delete_collection_docs(db, report.reference.collection("revisions"))
        _delete_doc_with_retry(report.reference)
    _delete_collection_docs(db, prop_ref.collection("savedProviders"))
    metrics_ref = prop_ref.collection("metrics").document("summary")
    if metrics_ref.get().exists:
        _delete_doc_with_retry(metrics_ref)

    for snap in user_ref.collection("docs").where(filter=FieldFilter("propertyId", "==", property_id)).stream():
        _delete_doc_with_retry(snap.reference)

    _delete_property_chats(db, user_id, property_id)


def _delete_property_chats(db: firestore.Client, user_id: str, property_id: str) -> None:
    """Delete all chats (including drafts) tagged with this propertyId."""
    user_ref = db.collection("users").document(user_id)
    for chat in user_ref.collection("chats").where(filter=FieldFilter("propertyId", "==", property_id)).stream():
        _delete_collection_docs(db, chat.reference.collection("messages"))
        _delete_doc_with_retry(chat.reference)


def _run_property_deletion_job(user_id: str, property_id: str, job_id: str) -> None:
    db = firestore.Client()
    warnings: list[str] = []
    user_ref = db.collection("users").document(user_id)
    prop_ref = user_ref.collection("properties").document(property_id)
    property_name = _property_display_name(prop_ref)

    try:
        _update_job(db, user_id, job_id, status="running", phase="collect")
        assets = _collect_property_assets(db, user_id, property_id)

        _update_job(db, user_id, job_id, status="running", phase="storage")
        warnings.extend(
            _delete_property_storage(user_id, property_id, assets["storage_paths"])
        )

        _update_job(db, user_id, job_id, status="running", phase="firestore")
        _delete_property_firestore(db, user_id, property_id)
        # Second pass: drafts may be created while the job runs (open client).
        _delete_property_chats(db, user_id, property_id)

        _update_job(db, user_id, job_id, status="running", phase="vertex")
        agent_result = delete_agent_sessions(user_id, assets["agent_session_ids"])
        warnings.extend(agent_result.get("warnings") or [])

        _update_job(db, user_id, job_id, status="running", phase="rag")
        rag_result = delete_rag_files(assets["gs_uris"])
        warnings.extend(rag_result.get("warnings") or [])

        _update_job(db, user_id, job_id, status="running", phase="sharedChats")
        shared_result = delete_shared_chats_for_property(db, user_id, property_id)
        warnings.extend(shared_result.get("warnings") or [])

        if prop_ref.get().exists:
            _delete_doc_with_retry(prop_ref)

        _update_job(
            db,
            user_id,
            job_id,
            status="completed",
            phase="done",
            warnings=warnings,
            error=None,
        )
        _write_deletion_notification(
            db,
            user_id,
            notification_type="property_deletion_completed",
            property_id=property_id,
            property_name=property_name,
            job_id=job_id,
            action_required=False,
        )
        _write_audit_event(
            db,
            user_id=user_id,
            actor_uid=user_id,
            resource_type="property",
            resource_ids=[property_id],
            property_id=property_id,
            job_id=job_id,
            source="job",
            status="completed",
            warnings=warnings,
        )
    except Exception as exc:
        logger.exception("property deletion job failed user=%s property=%s", user_id, property_id)
        try:
            _commit_with_retry(
                lambda: prop_ref.set(
                    {
                        "deletionStatus": "failed",
                        "deletionError": str(exc),
                        "deletionJobId": job_id,
                    },
                    merge=True,
                )
            )
        except Exception:
            pass
        _update_job(
            db,
            user_id,
            job_id,
            status="failed",
            phase="error",
            warnings=warnings,
            error=str(exc),
        )
        _write_deletion_notification(
            db,
            user_id,
            notification_type="property_deletion_failed",
            property_id=property_id,
            property_name=property_name,
            job_id=job_id,
            deletion_error=str(exc),
            action_required=True,
        )
        _write_audit_event(
            db,
            user_id=user_id,
            actor_uid=user_id,
            resource_type="property",
            resource_ids=[property_id],
            property_id=property_id,
            job_id=job_id,
            source="job",
            status="failed",
            warnings=warnings,
            error=str(exc),
        )


def start_property_deletion_job(user_id: str, property_id: str) -> str:
    db = firestore.Client()
    job_id = _property_job_id(property_id)
    job_doc = _job_ref(db, user_id, job_id).get()
    prior_attempt = 0
    if job_doc.exists:
        data = job_doc.to_dict() or {}
        status = data.get("status")
        if status == "running" and not _is_job_lease_expired(data):
            return job_id
        if status == "completed":
            return job_id
        prior_attempt = int(data.get("attempt") or 0)

    now = _utcnow()
    payload: dict[str, Any] = {
        "jobId": job_id,
        "type": "property",
        "propertyId": property_id,
        "userId": user_id,
        "status": "running",
        "phase": "queued",
        "warnings": [],
        "startedAt": firestore.SERVER_TIMESTAMP,
        "attempt": prior_attempt + 1,
        "lastHeartbeatAt": now,
        "leaseExpiresAt": now + timedelta(seconds=JOB_LEASE_SECONDS),
        "error": firestore.DELETE_FIELD,
    }
    if not job_doc.exists:
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
    _commit_with_retry(lambda: _job_ref(db, user_id, job_id).set(payload, merge=True))

    prop_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
    )
    try:
        prop_ref.set(
            {
                "deletionStatus": "deleting",
                "deletionJobId": job_id,
                "deletionError": firestore.DELETE_FIELD,
            },
            merge=True,
        )
    except Exception:
        logger.warning("could not set property tombstone user=%s property=%s", user_id, property_id)

    thread = threading.Thread(
        target=_run_property_deletion_job,
        args=(user_id, property_id, job_id),
        daemon=True,
    )
    thread.start()
    return job_id


def get_deletion_job(user_id: str, job_id: str) -> dict[str, Any] | None:
    db = firestore.Client()
    snap = _job_ref(db, user_id, job_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    return {
        "jobId": job_id,
        "status": data.get("status", "running"),
        "phase": data.get("phase"),
        "warnings": data.get("warnings") or [],
        "error": data.get("error"),
        "attempt": int(data.get("attempt") or 0),
        "canRetry": can_retry_deletion_job(data),
    }


def _collect_user_assets(db: firestore.Client, user_id: str) -> dict[str, Any]:
    user_ref = db.collection("users").document(user_id)
    gs_uris: list[str] = []
    storage_paths: list[str] = []
    agent_session_ids: list[str] = []

    for snap in user_ref.collection("docs").stream():
        data = snap.to_dict() or {}
        if data.get("gsURI"):
            uri = str(data["gsURI"])
            gs_uris.append(uri)
            _append_storage_path(storage_paths, _gs_uri_to_storage_path(uri))
        _append_storage_path(storage_paths, data.get("storagePath"))

    for chat in user_ref.collection("chats").stream():
        data = chat.to_dict() or {}
        if data.get("agentSessionId"):
            agent_session_ids.append(str(data["agentSessionId"]))

    return {
        "gs_uris": list(dict.fromkeys(gs_uris)),
        "storage_paths": list(dict.fromkeys(storage_paths)),
        "agent_session_ids": list(dict.fromkeys(agent_session_ids)),
    }


def _delete_user_storage(user_id: str, storage_paths: list[str]) -> list[str]:
    warnings: list[str] = []
    bucket = _firebase_storage_bucket_name()
    if not bucket:
        warnings.append("FIREBASE_STORAGE_BUCKET not configured; skipped user storage prefixes")
        return warnings
    for path in list(dict.fromkeys(storage_paths)):
        _, path_warnings = _delete_gcs_prefix(bucket, path)
        warnings.extend(path_warnings)
    for prefix in (f"uploads/{user_id}/", f"documents/{user_id}/"):
        _, prefix_warnings = _delete_gcs_prefix(bucket, prefix)
        warnings.extend(prefix_warnings)
    return warnings


def _delete_user_firestore(db: firestore.Client, user_id: str) -> None:
    user_ref = db.collection("users").document(user_id)

    for sub in user_ref.collections():
        for doc in sub.stream():
            _delete_document_tree(db, doc.reference)
            _delete_doc_with_retry(doc.reference)

    token_ref = db.collection("llm_token_usage").document(user_id)
    if token_ref.get().exists:
        _delete_collection_docs(db, token_ref.collection("periods"))
        _delete_doc_with_retry(token_ref)

    support_ref = db.collection("support_requests").document(user_id)
    if support_ref.get().exists:
        _delete_collection_docs(db, support_ref.collection("messages"))
        _delete_doc_with_retry(support_ref)

    for shared in db.collection("sharedChats").where(filter=FieldFilter("originalUserId", "==", user_id)).stream():
        _delete_collection_docs(db, shared.reference.collection("messages"))
        _delete_doc_with_retry(shared.reference)

    if user_ref.get().exists:
        _delete_doc_with_retry(user_ref)


def _run_user_erasure_job(user_id: str, job_id: str) -> None:
    db = firestore.Client()
    warnings: list[str] = []
    try:
        _update_job(db, user_id, job_id, status="running", phase="collect")
        assets = _collect_user_assets(db, user_id)

        _update_job(db, user_id, job_id, status="running", phase="storage")
        warnings.extend(_delete_user_storage(user_id, assets["storage_paths"]))

        _update_job(db, user_id, job_id, status="running", phase="firestore_user_tree")
        _delete_user_firestore(db, user_id)

        _update_job(db, user_id, job_id, status="running", phase="vertex")
        agent_result = delete_agent_sessions(user_id, assets["agent_session_ids"])
        warnings.extend(agent_result.get("warnings") or [])

        _update_job(db, user_id, job_id, status="running", phase="rag")
        rag_result = delete_rag_files(assets["gs_uris"])
        warnings.extend(rag_result.get("warnings") or [])

        _update_job(
            db,
            user_id,
            job_id,
            status="completed",
            phase="done",
            warnings=warnings,
        )
    except Exception as exc:
        logger.exception("user erasure job failed user=%s", user_id)
        _update_job(
            db,
            user_id,
            job_id,
            status="failed",
            phase="error",
            warnings=warnings,
            error=str(exc),
        )


def start_user_erasure_job(user_id: str) -> str:
    db = firestore.Client()
    job_id = f"user_{user_id}"
    job_doc = _job_ref(db, user_id, job_id).get()
    prior_attempt = 0
    if job_doc.exists:
        data = job_doc.to_dict() or {}
        status = data.get("status")
        if status == "running" and not _is_job_lease_expired(data):
            return job_id
        if status == "completed":
            return job_id
        prior_attempt = int(data.get("attempt") or 0)

    now = _utcnow()
    payload: dict[str, Any] = {
        "jobId": job_id,
        "type": "user",
        "userId": user_id,
        "status": "running",
        "phase": "queued",
        "warnings": [],
        "startedAt": firestore.SERVER_TIMESTAMP,
        "attempt": prior_attempt + 1,
        "lastHeartbeatAt": now,
        "leaseExpiresAt": now + timedelta(seconds=JOB_LEASE_SECONDS),
        "error": firestore.DELETE_FIELD,
    }
    if not job_doc.exists:
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
    _commit_with_retry(lambda: _job_ref(db, user_id, job_id).set(payload, merge=True))

    thread = threading.Thread(
        target=_run_user_erasure_job,
        args=(user_id, job_id),
        daemon=True,
    )
    thread.start()
    return job_id


def _mark_deletion_job_stale(
    db: firestore.Client,
    user_id: str,
    job_id: str,
    data: dict[str, Any],
) -> None:
    _update_job(
        db,
        user_id,
        job_id,
        status="stale",
        phase=data.get("phase"),
        error=_STALE_JOB_ERROR,
    )
    if data.get("type") != "property":
        return

    property_id = str(data.get("propertyId") or job_id.removeprefix("property_"))
    prop_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
    )
    property_name = _property_display_name(prop_ref)
    try:
        _commit_with_retry(
            lambda: prop_ref.set(
                {
                    "deletionStatus": "failed",
                    "deletionError": _STALE_JOB_ERROR,
                    "deletionJobId": job_id,
                },
                merge=True,
            )
        )
    except Exception:
        logger.warning(
            "could not mark stale property tombstone user=%s property=%s",
            user_id,
            property_id,
        )
    _write_deletion_notification(
        db,
        user_id,
        notification_type="property_deletion_failed",
        property_id=property_id,
        property_name=property_name,
        job_id=job_id,
        deletion_error=_STALE_JOB_ERROR,
        action_required=True,
    )


def sweep_stale_deletion_jobs() -> int:
    """Mark running jobs with expired leases as stale (proxy startup / ops)."""
    db = firestore.Client()
    now = _utcnow()
    marked = 0
    query = db.collection_group("deletionJobs").where(
        filter=FieldFilter("status", "==", "running")
    )
    try:
        for snap in query.stream():
            data = snap.to_dict() or {}
            if not _is_job_lease_expired(data, now=now):
                continue
            parts = snap.reference.path.split("/")
            if len(parts) < 4 or parts[0] != "users" or parts[2] != "deletionJobs":
                continue
            user_id = parts[1]
            job_id = parts[3]
            _mark_deletion_job_stale(db, user_id, job_id, data)
            marked += 1
    except api_exceptions.FailedPrecondition as exc:
        logger.warning(
            "deletion stale sweep skipped: deploy Firestore COLLECTION_GROUP index on "
            "deletionJobs.status (firebase deploy --only firestore:indexes). error=%s",
            exc,
        )
        return 0
    return marked


def _start_deletion_job_thread(user_id: str, job_id: str, data: dict[str, Any]) -> None:
    job_type = data.get("type")
    if job_type == "property":
        property_id = str(data.get("propertyId") or job_id.removeprefix("property_"))
        target = _run_property_deletion_job
        args = (user_id, property_id, job_id)
    elif job_type == "user":
        target = _run_user_erasure_job
        args = (user_id, job_id)
    else:
        raise ValueError(f"Unknown deletion job type: {job_type!r}")

    thread = threading.Thread(target=target, args=args, daemon=True)
    thread.start()


def retry_deletion_job(user_id: str, job_id: str) -> str:
    db = firestore.Client()
    snap = _job_ref(db, user_id, job_id).get()
    if not snap.exists:
        raise ValueError("Job not found")
    data = snap.to_dict() or {}
    if not can_retry_deletion_job(data):
        raise ValueError("Job cannot be retried")

    prior_attempt = int(data.get("attempt") or 0)
    now = _utcnow()
    _commit_with_retry(
        lambda: _job_ref(db, user_id, job_id).set(
            {
                "status": "running",
                "phase": "queued",
                "error": firestore.DELETE_FIELD,
                "attempt": prior_attempt + 1,
                "lastHeartbeatAt": now,
                "leaseExpiresAt": now + timedelta(seconds=JOB_LEASE_SECONDS),
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
    )

    if data.get("type") == "property":
        property_id = str(data.get("propertyId") or job_id.removeprefix("property_"))
        prop_ref = (
            db.collection("users")
            .document(user_id)
            .collection("properties")
            .document(property_id)
        )
        try:
            _commit_with_retry(
                lambda: prop_ref.set(
                    {
                        "deletionStatus": "deleting",
                        "deletionJobId": job_id,
                        "deletionError": firestore.DELETE_FIELD,
                    },
                    merge=True,
                )
            )
        except Exception:
            logger.warning(
                "could not reset property tombstone on retry user=%s property=%s",
                user_id,
                property_id,
            )

    refreshed = _job_ref(db, user_id, job_id).get().to_dict() or data
    _start_deletion_job_thread(user_id, job_id, refreshed)
    return job_id


def _property_display_name(prop_ref) -> str | None:
    try:
        snap = prop_ref.get()
        if snap.exists:
            data = snap.to_dict() or {}
            name = data.get("name")
            return str(name) if name else None
    except Exception:
        pass
    return None


def _log_deletion_action(
    *,
    resource_type: str,
    user_id: str,
    resource_ids: list[str],
    status: str,
    job_id: str | None = None,
    error: str | None = None,
) -> None:
    logger.info(
        "deletion action resource_type=%s user_id=%s resource_ids=%s status=%s job_id=%s correlation_id=%s error=%s",
        resource_type,
        user_id,
        ",".join(resource_ids) if resource_ids else "-",
        status,
        job_id or "-",
        get_correlation_id() or "-",
        error or "-",
    )


def _write_audit_event(
    db: firestore.Client,
    *,
    user_id: str,
    actor_uid: str,
    resource_type: str,
    resource_ids: list[str],
    status: str,
    source: str = "api",
    property_id: str | None = None,
    job_id: str | None = None,
    deleted: list[str] | None = None,
    warnings: list[str] | None = None,
    error: str | None = None,
    event_id: str | None = None,
    merge: bool = False,
) -> str:
    eid = event_id or str(uuid.uuid4())
    payload: dict[str, Any] = {
        "eventId": eid,
        "userId": user_id,
        "actorUid": actor_uid,
        "resourceType": resource_type,
        "resourceIds": resource_ids,
        "source": source,
        "status": status,
        "correlationId": get_correlation_id(),
    }
    if property_id:
        payload["propertyId"] = property_id
    if job_id:
        payload["jobId"] = job_id
    if deleted:
        payload["deleted"] = deleted
    if warnings:
        payload["warnings"] = warnings
    if error:
        payload["error"] = error
    if status in ("completed", "failed"):
        payload["completedAt"] = firestore.SERVER_TIMESTAMP
    if not merge:
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
    _commit_with_retry(lambda: _audit_ref(db, user_id, eid).set(payload, merge=merge))
    _log_deletion_action(
        resource_type=resource_type,
        user_id=user_id,
        resource_ids=resource_ids,
        status=status,
        job_id=job_id,
        error=error,
    )
    return eid


def _write_deletion_notification(
    db: firestore.Client,
    user_id: str,
    *,
    notification_type: str,
    property_id: str,
    property_name: str | None = None,
    job_id: str | None = None,
    deletion_error: str | None = None,
    action_required: bool = False,
) -> None:
    nid = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "type": notification_type,
        "propertyId": property_id,
        "propertyName": property_name,
        "jobId": job_id,
        "deletionError": deletion_error,
        "actionRequired": action_required,
        "read": False,
        "dismissed": False,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    try:
        _commit_with_retry(lambda: _notification_ref(db, user_id, nid).set(payload))
    except Exception:
        logger.warning("could not write deletion notification user=%s property=%s", user_id, property_id)



def run_audited_resource_deletion(
    db: firestore.Client,
    *,
    user_id: str,
    actor_uid: str,
    resource_type: str,
    resource_ids: list[str],
    resource_ref,
    property_id: str | None = None,
    source: str = "api",
    batch_id: str | None = None,
    skip_mark: bool = False,
    operation: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    """Audit-wrapped delete with Firestore deletionStatus tombstone on the resource doc."""
    if not skip_mark and resource_ref is not None:
        try:
            _mark_resource_deleting(resource_ref, batch_id=batch_id)
        except Exception as exc:
            logger.warning(
                "could not mark %s deleting user=%s ids=%s: %s",
                resource_type,
                user_id,
                resource_ids,
                exc,
            )

    event_id = _write_audit_event(
        db,
        user_id=user_id,
        actor_uid=actor_uid,
        resource_type=resource_type,
        resource_ids=resource_ids,
        property_id=property_id,
        source=source,
        status="started",
    )
    try:
        result = operation()
        warnings = result.get("warnings") or []
        deleted_summary = []
        if result.get("deleted"):
            if isinstance(result["deleted"], list):
                deleted_summary = [str(x) for x in result["deleted"]]
            elif result["deleted"] is True:
                deleted_summary = [f"{resource_type}:{rid}" for rid in resource_ids]
        _write_audit_event(
            db,
            user_id=user_id,
            actor_uid=actor_uid,
            resource_type=resource_type,
            resource_ids=resource_ids,
            property_id=property_id,
            source=source,
            status="completed",
            deleted=deleted_summary,
            warnings=warnings,
            event_id=event_id,
            merge=True,
        )
        return {"ok": True, "deleted": deleted_summary, "warnings": warnings, "failed": []}
    except Exception as exc:
        if resource_ref is not None:
            try:
                _mark_resource_delete_failed(resource_ref, str(exc))
            except Exception as mark_exc:
                logger.warning(
                    "could not mark %s delete failed user=%s ids=%s: %s",
                    resource_type,
                    user_id,
                    resource_ids,
                    mark_exc,
                )
        _write_audit_event(
            db,
            user_id=user_id,
            actor_uid=actor_uid,
            resource_type=resource_type,
            resource_ids=resource_ids,
            property_id=property_id,
            source=source,
            status="failed",
            error=str(exc),
            event_id=event_id,
            merge=True,
        )
        return {
            "ok": False,
            "deleted": [],
            "warnings": [],
            "failed": [{"resource": resource_type, "message": str(exc)}],
        }


def run_audited_operation(
    db: firestore.Client,
    *,
    user_id: str,
    actor_uid: str,
    resource_type: str,
    resource_ids: list[str],
    property_id: str | None = None,
    source: str = "api",
    operation: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    event_id = _write_audit_event(
        db,
        user_id=user_id,
        actor_uid=actor_uid,
        resource_type=resource_type,
        resource_ids=resource_ids,
        property_id=property_id,
        source=source,
        status="started",
    )
    try:
        result = operation()
        warnings = result.get("warnings") or []
        deleted_summary = []
        if result.get("deleted"):
            if isinstance(result["deleted"], list):
                deleted_summary = [str(x) for x in result["deleted"]]
            elif result["deleted"] is True:
                deleted_summary = [f"{resource_type}:{rid}" for rid in resource_ids]
        _write_audit_event(
            db,
            user_id=user_id,
            actor_uid=actor_uid,
            resource_type=resource_type,
            resource_ids=resource_ids,
            property_id=property_id,
            source=source,
            status="completed",
            deleted=deleted_summary,
            warnings=warnings,
            event_id=event_id,
            merge=True,
        )
        return {"ok": True, "deleted": deleted_summary, "warnings": warnings, "failed": []}
    except Exception as exc:
        _write_audit_event(
            db,
            user_id=user_id,
            actor_uid=actor_uid,
            resource_type=resource_type,
            resource_ids=resource_ids,
            property_id=property_id,
            source=source,
            status="failed",
            error=str(exc),
            event_id=event_id,
            merge=True,
        )
        return {
            "ok": False,
            "deleted": [],
            "warnings": [],
            "failed": [{"resource": resource_type, "message": str(exc)}],
        }


def _empty_batch_result() -> dict[str, Any]:
    return {"ok": True, "deleted": [], "warnings": [], "failed": []}


def _merge_batch_results(target: dict[str, Any], partial: dict[str, Any]) -> None:
    target["deleted"].extend(partial.get("deleted") or [])
    target["warnings"].extend(partial.get("warnings") or [])
    target["failed"].extend(partial.get("failed") or [])
    if not partial.get("ok", True):
        target["ok"] = False


def delete_checkpoints_batch(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    checkpoint_ids: list[str],
) -> dict[str, Any]:
    if len(checkpoint_ids) > BATCH_DELETE_MAX:
        raise ValueError(f"batch size exceeds {BATCH_DELETE_MAX}")
    batch_id = str(uuid.uuid4())
    refs = [
        _checkpoint_ref(db, user_id, property_id, cid)
        for cid in checkpoint_ids
        if cid
    ]
    _batch_mark_resources_deleting(db, refs, batch_id)
    result = _empty_batch_result()
    for cid in checkpoint_ids:
        if not cid:
            continue
        ref = _checkpoint_ref(db, user_id, property_id, cid)
        partial = run_audited_resource_deletion(
            db,
            user_id=user_id,
            actor_uid=user_id,
            resource_type="checkpoint",
            resource_ids=[cid],
            resource_ref=ref,
            property_id=property_id,
            batch_id=batch_id,
            skip_mark=True,
            operation=lambda c=cid: delete_checkpoint_asset(
                db, user_id, property_id, c, rebuild_metrics=False
            ),
        )
        _merge_batch_results(result, partial)
    _finalize_stuck_deleting_refs(refs)
    if checkpoint_ids:
        from services.checkpoint_service import publish_checkpoint_metrics_rebuild

        try:
            publish_checkpoint_metrics_rebuild(
                user_id=user_id,
                property_id=property_id,
                reason="checkpoint.batch_deleted",
            )
        except Exception as exc:
            logger.warning(
                "Failed to publish metrics rebuild after batch checkpoint delete user=%s property=%s: %s",
                user_id,
                property_id,
                exc,
            )
            result["warnings"].append(f"metrics rebuild: {exc}")
    return result


def delete_documents_batch(
    db: firestore.Client,
    user_id: str,
    items: list[dict[str, Any]],
) -> dict[str, Any]:
    if len(items) > BATCH_DELETE_MAX:
        raise ValueError(f"batch size exceeds {BATCH_DELETE_MAX}")
    batch_id = str(uuid.uuid4())
    refs = [
        _document_ref(db, user_id, str(item.get("docId") or ""))
        for item in items
        if str(item.get("docId") or "")
    ]
    _batch_mark_resources_deleting(db, refs, batch_id)
    result = _empty_batch_result()
    for item in items:
        doc_id = str(item.get("docId") or "")
        if not doc_id:
            continue
        storage_path = item.get("storagePath")
        gs_uri = item.get("gsURI")
        ref = _document_ref(db, user_id, doc_id)
        partial = run_audited_resource_deletion(
            db,
            user_id=user_id,
            actor_uid=user_id,
            resource_type="document",
            resource_ids=[doc_id],
            resource_ref=ref,
            batch_id=batch_id,
            skip_mark=True,
            operation=lambda d=doc_id, sp=storage_path, gu=gs_uri: delete_document_asset(
                db, user_id, d, sp, gu
            ),
        )
        _merge_batch_results(result, partial)
    _finalize_stuck_deleting_refs(refs)
    return result


def delete_sessions_batch(
    db: firestore.Client,
    user_id: str,
    session_ids: list[str],
) -> dict[str, Any]:
    if len(session_ids) > BATCH_DELETE_MAX:
        raise ValueError(f"batch size exceeds {BATCH_DELETE_MAX}")
    batch_id = str(uuid.uuid4())
    refs = [_chat_ref(db, user_id, sid) for sid in session_ids if sid]
    _batch_mark_resources_deleting(db, refs, batch_id)
    result = _empty_batch_result()
    for sid in session_ids:
        if not sid:
            continue
        ref = _chat_ref(db, user_id, sid)
        partial = run_audited_resource_deletion(
            db,
            user_id=user_id,
            actor_uid=user_id,
            resource_type="session",
            resource_ids=[sid],
            resource_ref=ref,
            batch_id=batch_id,
            skip_mark=True,
            operation=lambda s=sid: delete_chat_session_full(db, user_id, s),
        )
        _merge_batch_results(result, partial)
    _finalize_stuck_deleting_refs(refs)
    return result


def list_deletion_audit(
    db: firestore.Client,
    user_id: str,
    *,
    limit: int = 50,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    col = db.collection("users").document(user_id).collection("deletionAudit")
    for snap in col.order_by("createdAt", direction=firestore.Query.DESCENDING).limit(limit).stream():
        data = snap.to_dict() or {}
        data["eventId"] = data.get("eventId") or snap.id
        events.append(data)
    return events


def verify_data_erasure_admin_secret(header_value: str | None) -> bool:
    expected = (os.environ.get("DATA_ERASURE_ADMIN_SECRET") or "").strip()
    if not expected:
        logger.warning("DATA_ERASURE_ADMIN_SECRET not set; user erasure endpoint disabled")
        return False
    return bool(header_value and header_value.strip() == expected)
