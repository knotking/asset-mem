"""
Property report generation — enqueue async worker and signed PDF URLs.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from google.cloud import firestore
from google.cloud import pubsub_v1

from common.rag.delete import delete_rag_files_by_gcs_uris
from common.observability.logging_context import pubsub_payload_with_correlation
from common.plan_limits import (
    PlanLimitExceeded,
    check_and_record_monthly_document_creations,
    check_and_record_monthly_report_generations,
)
from common.storage.client import StorageClient
from common.storage.config import StorageConfig
from common.storage.models import SignedUrlConfig
from core.config import settings
from schemas.reports import (
    GenerateReportRequest,
    ReportPreviewHtmlRequest,
    ReportPreviewRequest,
    ReportRagIndexRequest,
    ReportShareRequest,
    ReportStatusRequest,
    UpdateReportMetadataRequest,
)

logger = logging.getLogger(__name__)


def report_docs_chat_rag_enabled() -> bool:
    return settings.REPORT_DOCS_CHAT_RAG_ENABLED

PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
REPORT_GENERATION_TOPIC = os.environ.get(
    "REPORT_GENERATION_TOPIC", "report-generation-topic"
)
USER_UPLOAD_TOPIC = (os.environ.get("USER_UPLOAD_TOPIC") or "").strip()
def _resolve_gcs_bucket() -> Optional[str]:
    for key in ("GOOGLE_CLOUD_BUCKET", "GCS_BUCKET_NAME", "GCS_BUCKET"):
        value = (os.environ.get(key) or "").strip()
        if value:
            return value
    return None


GCS_BUCKET = _resolve_gcs_bucket()


def _report_storage_config() -> StorageConfig:
    project_id = (
        os.environ.get("GCP_PROJECT_ID") or os.environ.get("GCS_PROJECT_ID") or ""
    ).strip() or None
    return StorageConfig(
        project_id=project_id,
        bucket_name=GCS_BUCKET,
        location=(
            os.environ.get("GCP_REGION") or os.environ.get("GCS_LOCATION") or "us-central1"
        ),
    )

SHARED_REPORT_TTL_DAYS = 30
MAX_REPORTS_PER_PROPERTY = 50

REVISION_ARCHIVE_FIELDS = (
    "contentSnapshot",
    "chatMarkdown",
    "pdfStoragePath",
    "pdfGsUri",
    "generatedAt",
    "checkpointIds",
    "template",
    "status",
    "failureReason",
    "snapshotRange",
    "baselineRange",
    "comparisonRange",
    "mode",
    "purpose",
    "includeInDocsChat",
    "ragGsUri",
    "ragCompanionDocId",
    "mdGsUri",
    "mdStoragePath",
)

DEFAULT_TEMPLATE = {
    "layoutId": "professional",
    "includeCoverPage": True,
    "includePhotos": True,
    "includeIssueTable": True,
    "includeMetricsChart": True,
    "includeVisualDiff": True,
    "includeRecommendations": True,
    "includeSignatureBlock": False,
}


def _reports_collection(db: firestore.Client, user_id: str, property_id: str):
    return (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("reports")
    )


def _parse_iso_date(value: str, *, end_of_day: bool = False) -> datetime:
    raw = (value or "").strip()
    if not raw:
        raise ValueError("Date is required")
    if "T" in raw:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    else:
        dt = datetime.fromisoformat(raw)
        if end_of_day:
            dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        else:
            dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _checkpoint_effective_datetime(data: dict[str, Any]) -> Optional[datetime]:
    for key in ("capturedAt", "createdAt"):
        raw = data.get(key)
        if raw is None:
            continue
        if hasattr(raw, "to_datetime"):
            dt = raw.to_datetime()
        elif hasattr(raw, "seconds"):
            dt = datetime.fromtimestamp(raw.seconds, tz=timezone.utc)
        elif isinstance(raw, datetime):
            dt = raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
        elif isinstance(raw, str):
            try:
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                continue
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        else:
            continue
        return dt.astimezone(timezone.utc)
    return None


def _normalize_location(location: Optional[str]) -> str:
    return (location or "unspecified").strip().lower() or "unspecified"


COMPARISON_PAIR_RATE_WARN_THRESHOLD = 0.5


@dataclass(frozen=True)
class ComparisonResolution:
    pairs: list[dict[str, str]]
    baseline_only_ids: list[str]
    comparison_only_ids: list[str]

    def all_checkpoint_ids(self) -> list[str]:
        ordered: list[str] = []
        for pair in self.pairs:
            ordered.append(pair["baselineCheckpointId"])
            ordered.append(pair["comparisonCheckpointId"])
        ordered.extend(self.baseline_only_ids)
        ordered.extend(self.comparison_only_ids)
        return list(dict.fromkeys(ordered))

    def pair_rate(self) -> float:
        paired = len(self.pairs)
        unpaired = len(self.baseline_only_ids) + len(self.comparison_only_ids)
        total = paired + unpaired
        if total == 0:
            return 0.0
        return paired / total


def _checkpoint_ref(db: firestore.Client, user_id: str, property_id: str):
    return (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
    )


def _load_checkpoints_by_ids(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    checkpoint_ids: list[str],
) -> list[dict[str, Any]]:
    cp_ref = _checkpoint_ref(db, user_id, property_id)
    out: list[dict[str, Any]] = []
    for cp_id in checkpoint_ids:
        snap = cp_ref.document(cp_id).get()
        if snap.exists:
            data = snap.to_dict() or {}
            data["id"] = snap.id
            out.append(data)
    return out


def _collect_checkpoints_in_range(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    *,
    date_range: dict[str, str],
    checkpoint_ids: Optional[list[str]] = None,
) -> list[dict[str, Any]]:
    start = _parse_iso_date(date_range["start"])
    end = _parse_iso_date(date_range["end"], end_of_day=True)
    cp_ref = _checkpoint_ref(db, user_id, property_id)

    if checkpoint_ids:
        return _load_checkpoints_by_ids(db, user_id, property_id, checkpoint_ids)

    in_range: list[dict[str, Any]] = []
    for snap in cp_ref.stream():
        data = snap.to_dict() or {}
        effective = _checkpoint_effective_datetime(data)
        if effective is None or effective < start or effective > end:
            continue
        data["id"] = snap.id
        in_range.append(data)
    return in_range


def _pick_latest_per_location(
    checkpoints: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    by_location: dict[str, dict[str, Any]] = {}
    for cp in checkpoints:
        loc = _normalize_location(cp.get("location"))
        existing = by_location.get(loc)
        if existing is None:
            by_location[loc] = cp
            continue
        existing_dt = _checkpoint_effective_datetime(existing) or datetime.min.replace(
            tzinfo=timezone.utc
        )
        cp_dt = _checkpoint_effective_datetime(cp) or datetime.min.replace(
            tzinfo=timezone.utc
        )
        existing_conf = float(existing.get("assetConfidence") or 0)
        cp_conf = float(cp.get("assetConfidence") or 0)
        if cp_dt > existing_dt or (cp_dt == existing_dt and cp_conf > existing_conf):
            by_location[loc] = cp
    return by_location


def _display_location(checkpoint: dict[str, Any], normalized_loc: str) -> str:
    raw = (checkpoint.get("location") or "").strip()
    return raw or normalized_loc


def resolve_comparison_checkpoints(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    *,
    baseline_range: dict[str, str],
    comparison_range: dict[str, str],
) -> ComparisonResolution:
    baseline_in_range = _collect_checkpoints_in_range(
        db,
        user_id,
        property_id,
        date_range=baseline_range,
    )
    comparison_in_range = _collect_checkpoints_in_range(
        db,
        user_id,
        property_id,
        date_range=comparison_range,
    )
    if not baseline_in_range:
        raise ValueError("No checkpoints in baseline date range")
    if not comparison_in_range:
        raise ValueError("No checkpoints in comparison date range")

    baseline_latest = _pick_latest_per_location(baseline_in_range)
    comparison_latest = _pick_latest_per_location(comparison_in_range)

    pairs: list[dict[str, str]] = []
    baseline_only_ids: list[str] = []
    comparison_only_ids: list[str] = []

    for loc in sorted(set(baseline_latest) | set(comparison_latest)):
        baseline_cp = baseline_latest.get(loc)
        comparison_cp = comparison_latest.get(loc)
        if baseline_cp and comparison_cp:
            pairs.append(
                {
                    "location": _display_location(baseline_cp, loc),
                    "baselineCheckpointId": str(baseline_cp["id"]),
                    "comparisonCheckpointId": str(comparison_cp["id"]),
                }
            )
        elif baseline_cp:
            baseline_only_ids.append(str(baseline_cp["id"]))
        elif comparison_cp:
            comparison_only_ids.append(str(comparison_cp["id"]))

    return ComparisonResolution(
        pairs=pairs,
        baseline_only_ids=baseline_only_ids,
        comparison_only_ids=comparison_only_ids,
    )


def filter_comparison_resolution(
    resolution: ComparisonResolution,
    checkpoint_ids: Optional[list[str]],
) -> ComparisonResolution:
    if not checkpoint_ids:
        return resolution
    allowed = set(checkpoint_ids)
    pairs = [
        pair
        for pair in resolution.pairs
        if pair["baselineCheckpointId"] in allowed
        and pair["comparisonCheckpointId"] in allowed
    ]
    baseline_only = [cp_id for cp_id in resolution.baseline_only_ids if cp_id in allowed]
    comparison_only = [
        cp_id for cp_id in resolution.comparison_only_ids if cp_id in allowed
    ]
    return ComparisonResolution(
        pairs=pairs,
        baseline_only_ids=baseline_only,
        comparison_only_ids=comparison_only,
    )


def _checkpoint_preview_dict(checkpoint: dict[str, Any]) -> dict[str, Any]:
    captured = checkpoint.get("capturedAt") or checkpoint.get("createdAt")
    captured_at: Optional[str] = None
    if captured is not None:
        if hasattr(captured, "isoformat"):
            captured_at = captured.isoformat()
        elif hasattr(captured, "to_datetime"):
            captured_at = captured.to_datetime().isoformat()
        else:
            captured_at = str(captured)
    return {
        "checkpointId": str(checkpoint.get("id")),
        "name": checkpoint.get("name") or "Checkpoint",
        "location": checkpoint.get("location"),
        "analysisStatus": checkpoint.get("analysisStatus"),
        "capturedAt": captured_at,
    }


def prepare_report_preview(
    db: firestore.Client,
    request: ReportPreviewRequest,
) -> dict[str, Any]:
    if request.mode == "snapshot":
        if not request.snapshotRange:
            raise ValueError("snapshotRange is required for snapshot preview")
        checkpoints = resolve_snapshot_checkpoints(
            db,
            request.userId,
            request.propertyId,
            snapshot_range=request.snapshotRange.model_dump(),
        )
        return {
            "mode": "snapshot",
            "checkpoints": [_checkpoint_preview_dict(cp) for cp in checkpoints],
            "warnings": [],
        }

    if not request.baselineRange or not request.comparisonRange:
        raise ValueError(
            "baselineRange and comparisonRange are required for comparison preview"
        )
    resolution = resolve_comparison_checkpoints(
        db,
        request.userId,
        request.propertyId,
        baseline_range=request.baselineRange.model_dump(),
        comparison_range=request.comparisonRange.model_dump(),
    )
    warnings = comparison_resolution_warnings(resolution)
    checkpoint_ids = resolution.all_checkpoint_ids()
    by_id = {
        str(cp["id"]): cp
        for cp in _load_checkpoints_by_ids(
            db, request.userId, request.propertyId, checkpoint_ids
        )
    }
    pairs: list[dict[str, Any]] = []
    for pair in resolution.pairs:
        baseline = by_id.get(pair["baselineCheckpointId"])
        comparison = by_id.get(pair["comparisonCheckpointId"])
        pairs.append(
            {
                "location": pair["location"],
                "baselineCheckpointId": pair["baselineCheckpointId"],
                "comparisonCheckpointId": pair["comparisonCheckpointId"],
                "baseline": _checkpoint_preview_dict(baseline) if baseline else None,
                "comparison": _checkpoint_preview_dict(comparison) if comparison else None,
            }
        )
    baseline_only = [
        _checkpoint_preview_dict(by_id[cp_id])
        for cp_id in resolution.baseline_only_ids
        if cp_id in by_id
    ]
    comparison_only = [
        _checkpoint_preview_dict(by_id[cp_id])
        for cp_id in resolution.comparison_only_ids
        if cp_id in by_id
    ]
    return {
        "mode": "comparison",
        "pairs": pairs,
        "baselineOnly": baseline_only,
        "comparisonOnly": comparison_only,
        "warnings": warnings,
    }


def comparison_resolution_warnings(resolution: ComparisonResolution) -> list[str]:
    warnings: list[str] = []
    rate = resolution.pair_rate()
    if rate < COMPARISON_PAIR_RATE_WARN_THRESHOLD:
        warnings.append(
            f"Only {int(rate * 100)}% of locations paired between baseline and comparison "
            "ranges. Unpaired rooms appear in the report appendix."
        )
    if resolution.baseline_only_ids:
        warnings.append(
            f"{len(resolution.baseline_only_ids)} location(s) only in the baseline range."
        )
    if resolution.comparison_only_ids:
        warnings.append(
            f"{len(resolution.comparison_only_ids)} location(s) only in the comparison range."
        )
    return warnings


def resolve_snapshot_checkpoints(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    *,
    snapshot_range: dict[str, str],
    checkpoint_ids: Optional[list[str]] = None,
) -> list[dict[str, Any]]:
    in_range = _collect_checkpoints_in_range(
        db,
        user_id,
        property_id,
        date_range=snapshot_range,
        checkpoint_ids=checkpoint_ids,
    )
    return list(_pick_latest_per_location(in_range).values())


def validate_checkpoints_for_report(checkpoints: list[dict[str, Any]]) -> None:
    if not checkpoints:
        raise ValueError("No checkpoints match the selected date range")
    incomplete = [
        cp.get("id")
        for cp in checkpoints
        if (cp.get("analysisStatus") or "") != "completed"
    ]
    if incomplete:
        raise ValueError(
            "All selected checkpoints must have completed analysis before generating a report"
        )


def _delete_report_rag_uris(gs_uris: list[str]) -> list[str]:
    unique = [uri for uri in dict.fromkeys(gs_uris) if uri]
    if not unique:
        return []
    _, warnings = delete_rag_files_by_gcs_uris(unique)
    return warnings


def _user_docs_collection(db: firestore.Client, user_id: str):
    return db.collection("users").document(user_id).collection("docs")


def _upsert_report_rag_companion_doc(
    db: firestore.Client,
    *,
    user_id: str,
    property_id: str,
    report_id: str,
    report_title: str,
    md_gs_uri: str,
    md_storage_path: str,
    companion_doc_id: str,
) -> None:
    doc_ref = _user_docs_collection(db, user_id).document(companion_doc_id)
    now = firestore.SERVER_TIMESTAMP
    payload: dict[str, Any] = {
        "userId": user_id,
        "propertyId": property_id,
        "name": f"{report_title.strip()} (report)",
        "url": "",
        "storagePath": md_storage_path,
        "gsURI": md_gs_uri,
        "contentType": "text/markdown",
        "documentType": "PROPERTY_REPORT",
        "status": "complete",
        "ragIndexed": False,
        "reportId": report_id,
        "updatedAt": now,
    }
    if doc_ref.get().exists:
        doc_ref.update(payload)
    else:
        payload["createdAt"] = now
        doc_ref.set(payload)


def _delete_report_rag_companion_doc(
    db: firestore.Client, user_id: str, companion_doc_id: str | None
) -> None:
    if not companion_doc_id:
        return
    doc_ref = _user_docs_collection(db, user_id).document(str(companion_doc_id))
    if doc_ref.get().exists:
        doc_ref.delete()


def _publish_report_rag_import(
    *,
    user_id: str,
    gcs_urls: list[str],
    context_doc_ids: list[str],
) -> str:
    if not USER_UPLOAD_TOPIC or not PROJECT_ID:
        raise RuntimeError("USER_UPLOAD_TOPIC or GCP_PROJECT_ID is not configured")

    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(PROJECT_ID, USER_UPLOAD_TOPIC)
    body = pubsub_payload_with_correlation(
        {
            "gcs_urls": gcs_urls,
            "user_id": user_id,
            "user_query": "Property report companion for Docs chat",
            "source": "report-rag-index",
            "context_doc_ids": context_doc_ids,
        }
    )
    message_id = publisher.publish(
        topic_path, data=json.dumps(body).encode("utf-8")
    ).result()
    logger.info(
        "Published report RAG import user=%s urls=%d doc_ids=%s message_id=%s",
        user_id,
        len(gcs_urls),
        context_doc_ids,
        message_id,
    )
    return message_id


def _report_doc_payload(
    request: GenerateReportRequest,
    *,
    report_id: str,
    revision: int,
    checkpoint_ids: list[str],
    prior_data: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    template = {**DEFAULT_TEMPLATE, **(request.template.model_dump() if request.template else {})}
    now = firestore.SERVER_TIMESTAMP
    prior = prior_data or {}
    payload: dict[str, Any] = {
        "userId": request.userId,
        "propertyId": request.propertyId,
        "title": request.title.strip(),
        "mode": request.mode,
        "purpose": request.purpose,
        "checkpointIds": checkpoint_ids,
        "template": template,
        "status": "generating",
        "revision": revision,
        "includeInDocsChat": bool(prior.get("includeInDocsChat"))
        and report_docs_chat_rag_enabled(),
        "createdAt": now,
        "updatedAt": now,
    }
    if prior.get("ragCompanionDocId"):
        payload["ragCompanionDocId"] = prior["ragCompanionDocId"]
    if prior.get("includeInDocsChat") and report_docs_chat_rag_enabled():
        payload["ragGsUri"] = firestore.DELETE_FIELD
    if request.customNotes:
        payload["customNotes"] = request.customNotes.strip()
    if request.snapshotRange:
        payload["snapshotRange"] = request.snapshotRange.model_dump()
    if request.baselineRange:
        payload["baselineRange"] = request.baselineRange.model_dump()
    if request.comparisonRange:
        payload["comparisonRange"] = request.comparisonRange.model_dump()
    return payload


@dataclass(frozen=True)
class _ReportDocRollback:
    """How to undo a report Firestore write if Pub/Sub publish fails."""

    is_new: bool
    prior_data: Optional[dict[str, Any]] = None


def _rollback_report_doc(
    db: firestore.Client,
    request: GenerateReportRequest,
    report_id: str,
    rollback: _ReportDocRollback,
) -> None:
    ref = _reports_collection(db, request.userId, request.propertyId).document(report_id)
    if rollback.is_new:
        ref.delete()
        logger.info(
            "Deleted orphan report doc after publish failure reportId=%s userId=%s",
            report_id,
            request.userId,
        )
        return
    if rollback.prior_data is not None:
        ref.set(rollback.prior_data)
        logger.info(
            "Restored report doc after publish failure reportId=%s userId=%s",
            report_id,
            request.userId,
        )


def _shared_reports_collection(db: firestore.Client):
    return db.collection("sharedReports")


def _is_share_expired(expires_at: Any) -> bool:
    if expires_at is None:
        return False
    if hasattr(expires_at, "timestamp"):
        return expires_at.timestamp() < datetime.now(timezone.utc).timestamp()
    if isinstance(expires_at, datetime):
        dt = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
        return dt.timestamp() < datetime.now(timezone.utc).timestamp()
    return False


def archive_report_revision(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    report_id: str,
    prior_data: dict[str, Any],
) -> None:
    """Persist the current ready revision under reports/{id}/revisions/{n}."""
    revision = int(prior_data.get("revision") or 1)
    if prior_data.get("status") != "ready" or not prior_data.get("pdfStoragePath"):
        return

    archive: dict[str, Any] = {"revision": revision}
    for key in REVISION_ARCHIVE_FIELDS:
        if key in prior_data and prior_data[key] is not None:
            archive[key] = prior_data[key]
    archive["archivedAt"] = firestore.SERVER_TIMESTAMP

    (
        _reports_collection(db, user_id, property_id)
        .document(report_id)
        .collection("revisions")
        .document(str(revision))
        .set(archive)
    )
    logger.info(
        "Archived report revision user=%s property=%s report=%s revision=%s",
        user_id,
        property_id,
        report_id,
        revision,
    )


def update_report_metadata(
    db: firestore.Client,
    request: UpdateReportMetadataRequest,
) -> dict[str, Any]:
    ref = _reports_collection(db, request.userId, request.propertyId).document(
        request.reportId
    )
    snap = ref.get()
    if not snap.exists:
        raise ValueError("Report not found")

    data = snap.to_dict() or {}
    if data.get("status") == "generating":
        raise ValueError("Cannot edit metadata while the report is generating")

    updates: dict[str, Any] = {"updatedAt": firestore.SERVER_TIMESTAMP}
    if request.title is not None:
        title = request.title.strip()
        if not title:
            raise ValueError("Title cannot be empty")
        updates["title"] = title
    if request.customNotes is not None:
        notes = request.customNotes.strip()
        updates["customNotes"] = notes or firestore.DELETE_FIELD
    if request.template is not None:
        current = data.get("template") or {}
        updates["template"] = {**DEFAULT_TEMPLATE, **current, **request.template.model_dump()}

    if len(updates) == 1:
        raise ValueError("No metadata fields to update")

    ref.update(updates)
    return {"ok": True, "reportId": request.reportId}


def create_or_refresh_report_share(
    db: firestore.Client,
    request: ReportShareRequest,
) -> dict[str, Any]:
    report_ref = _reports_collection(db, request.userId, request.propertyId).document(
        request.reportId
    )
    snap = report_ref.get()
    if not snap.exists:
        raise ValueError("Report not found")

    data = snap.to_dict() or {}
    if data.get("status") != "ready":
        raise ValueError("Only ready reports can be shared")

    expires_at = datetime.now(timezone.utc) + timedelta(days=SHARED_REPORT_TTL_DAYS)
    share_payload: dict[str, Any] = {
        "originalUserId": request.userId,
        "originalPropertyId": request.propertyId,
        "originalReportId": request.reportId,
        "title": data.get("title"),
        "revision": data.get("revision"),
        "expiresAt": expires_at,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    share_id = data.get("shareId")
    if share_id:
        _shared_reports_collection(db).document(str(share_id)).update(share_payload)
    else:
        share_id = uuid.uuid4().hex
        share_payload["createdAt"] = firestore.SERVER_TIMESTAMP
        _shared_reports_collection(db).document(share_id).set(share_payload)
        report_ref.update({"shareId": share_id, "updatedAt": firestore.SERVER_TIMESTAMP})

    return {
        "shareId": share_id,
        "expiresAt": expires_at.isoformat(),
        "revision": int(data.get("revision") or 1),
    }


async def generate_public_report_signed_url(
    db: firestore.Client,
    *,
    share_id: str,
    expiration_seconds: int = 3600,
) -> dict[str, str]:
    share_snap = _shared_reports_collection(db).document(share_id).get()
    if not share_snap.exists:
        raise ValueError("Share link not found")

    share = share_snap.to_dict() or {}
    if _is_share_expired(share.get("expiresAt")):
        raise ValueError("Share link has expired")

    user_id = str(share.get("originalUserId") or "")
    property_id = str(share.get("originalPropertyId") or "")
    report_id = str(share.get("originalReportId") or "")
    if not all([user_id, property_id, report_id]):
        raise ValueError("Share link is invalid")

    return await generate_report_signed_url(
        db,
        user_id=user_id,
        property_id=property_id,
        report_id=report_id,
        expiration_seconds=expiration_seconds,
    )


@dataclass(frozen=True)
class _ReportRagContext:
    include_in_docs_chat: bool = False
    rag_companion_doc_id: Optional[str] = None


def create_or_reset_report_doc(
    db: firestore.Client,
    request: GenerateReportRequest,
    checkpoint_ids: list[str],
) -> tuple[str, int, _ReportDocRollback, _ReportRagContext]:
    reports = _reports_collection(db, request.userId, request.propertyId)
    revision = 1
    if request.regenerateReportId:
        ref = reports.document(request.regenerateReportId)
        snap = ref.get()
        if not snap.exists:
            raise ValueError("Report not found for regeneration")
        prior_data = snap.to_dict() or {}
        if prior_data.get("ragGsUri"):
            _delete_report_rag_uris([str(prior_data["ragGsUri"])])
        archive_report_revision(
            db,
            request.userId,
            request.propertyId,
            request.regenerateReportId,
            prior_data,
        )
        data = dict(prior_data)
        revision = int(data.get("revision") or 1) + 1
        payload = _report_doc_payload(
            request,
            report_id=request.regenerateReportId,
            revision=revision,
            checkpoint_ids=checkpoint_ids,
            prior_data=prior_data,
        )
        payload.pop("createdAt", None)
        ref.update(payload)
        rag_context = (
            _ReportRagContext(
                include_in_docs_chat=bool(prior_data.get("includeInDocsChat")),
                rag_companion_doc_id=(
                    str(prior_data["ragCompanionDocId"])
                    if prior_data.get("ragCompanionDocId")
                    else None
                ),
            )
            if report_docs_chat_rag_enabled()
            else _ReportRagContext()
        )
        return (
            request.regenerateReportId,
            revision,
            _ReportDocRollback(is_new=False, prior_data=prior_data),
            rag_context,
        )

    report_id = uuid.uuid4().hex
    reports.document(report_id).set(
        _report_doc_payload(
            request,
            report_id=report_id,
            revision=revision,
            checkpoint_ids=checkpoint_ids,
        )
    )
    return report_id, revision, _ReportDocRollback(is_new=True), _ReportRagContext()


def publish_report_generation(
    *,
    request: GenerateReportRequest,
    report_id: str,
    revision: int,
    checkpoint_ids: list[str],
    comparison_resolution: Optional[ComparisonResolution] = None,
    rag_context: Optional[_ReportRagContext] = None,
) -> str:
    if not PROJECT_ID:
        raise RuntimeError("GCP_PROJECT_ID is not configured")

    payload: dict[str, Any] = {
        "userId": request.userId,
        "propertyId": request.propertyId,
        "reportId": report_id,
        "revision": revision,
        "title": request.title,
        "mode": request.mode,
        "purpose": request.purpose,
        "checkpointIds": checkpoint_ids,
        "template": request.template.model_dump(),
        "customNotes": request.customNotes,
    }
    if request.snapshotRange:
        payload["snapshotRange"] = request.snapshotRange.model_dump()
    if request.baselineRange:
        payload["baselineRange"] = request.baselineRange.model_dump()
    if request.comparisonRange:
        payload["comparisonRange"] = request.comparisonRange.model_dump()
    if comparison_resolution is not None:
        payload["comparisonPairs"] = comparison_resolution.pairs
        payload["baselineOnlyCheckpointIds"] = comparison_resolution.baseline_only_ids
        payload["comparisonOnlyCheckpointIds"] = comparison_resolution.comparison_only_ids
    if (
        report_docs_chat_rag_enabled()
        and rag_context
        and rag_context.include_in_docs_chat
    ):
        payload["includeInDocsChat"] = True
        if rag_context.rag_companion_doc_id:
            payload["ragCompanionDocId"] = rag_context.rag_companion_doc_id

    payload = pubsub_payload_with_correlation(payload)

    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(PROJECT_ID, REPORT_GENERATION_TOPIC)
    message_id = publisher.publish(
        topic_path,
        data=json.dumps(payload).encode("utf-8"),
    ).result()
    logger.info(
        "Published report generation reportId=%s revision=%s message_id=%s",
        report_id,
        revision,
        message_id,
    )
    return message_id


def _count_property_reports(
    db: firestore.Client, user_id: str, property_id: str
) -> int:
    return sum(
        1
        for _ in _reports_collection(db, user_id, property_id).stream()
    )


def prepare_report_generation(
    db: firestore.Client,
    request: GenerateReportRequest,
) -> dict[str, Any]:
    comparison_resolution: Optional[ComparisonResolution] = None
    warnings: list[str] = []

    if not request.regenerateReportId:
        report_count = _count_property_reports(
            db, request.userId, request.propertyId
        )
        if report_count >= MAX_REPORTS_PER_PROPERTY:
            raise ValueError(
                f"This property already has the maximum of "
                f"{MAX_REPORTS_PER_PROPERTY} saved reports"
            )

    if request.mode == "snapshot":
        if not request.snapshotRange:
            raise ValueError("snapshotRange is required for snapshot reports")
        checkpoints = resolve_snapshot_checkpoints(
            db,
            request.userId,
            request.propertyId,
            snapshot_range=request.snapshotRange.model_dump(),
            checkpoint_ids=request.checkpointIds,
        )
        validate_checkpoints_for_report(checkpoints)
        checkpoint_ids = [str(cp["id"]) for cp in checkpoints]
    elif request.mode == "comparison":
        if not request.baselineRange or not request.comparisonRange:
            raise ValueError(
                "baselineRange and comparisonRange are required for comparison reports"
            )
        comparison_resolution = resolve_comparison_checkpoints(
            db,
            request.userId,
            request.propertyId,
            baseline_range=request.baselineRange.model_dump(),
            comparison_range=request.comparisonRange.model_dump(),
        )
        comparison_resolution = filter_comparison_resolution(
            comparison_resolution,
            request.checkpointIds,
        )
        if not comparison_resolution.pairs and not (
            comparison_resolution.baseline_only_ids
            or comparison_resolution.comparison_only_ids
        ):
            raise ValueError("No checkpoints resolved for comparison report")
        checkpoint_ids = comparison_resolution.all_checkpoint_ids()
        checkpoints = _load_checkpoints_by_ids(
            db, request.userId, request.propertyId, checkpoint_ids
        )
        if len(checkpoints) != len(checkpoint_ids):
            raise ValueError("One or more comparison checkpoints were not found")
        validate_checkpoints_for_report(checkpoints)
        warnings = comparison_resolution_warnings(comparison_resolution)
    else:
        raise ValueError(f"Unsupported report mode: {request.mode}")

    report_id, revision, rollback, rag_context = create_or_reset_report_doc(
        db, request, checkpoint_ids
    )
    try:
        message_id = publish_report_generation(
            request=request,
            report_id=report_id,
            revision=revision,
            checkpoint_ids=checkpoint_ids,
            comparison_resolution=comparison_resolution,
            rag_context=rag_context,
        )
    except Exception:
        _rollback_report_doc(db, request, report_id, rollback)
        raise
    try:
        check_and_record_monthly_report_generations(db, request.userId, 1)
    except PlanLimitExceeded:
        logger.warning(
            "Report enqueued but quota record failed reportId=%s userId=%s",
            report_id,
            request.userId,
        )
        raise
    result: dict[str, Any] = {
        "status": "accepted",
        "reportId": report_id,
        "revision": revision,
        "messageId": message_id,
    }
    if warnings:
        result["warnings"] = warnings
    return result


def get_report_status(
    db: firestore.Client,
    request: ReportStatusRequest,
) -> dict[str, Any]:
    ref = _reports_collection(db, request.userId, request.propertyId).document(
        request.reportId
    )
    snap = ref.get()
    if not snap.exists:
        raise ValueError("Report not found")
    data = snap.to_dict() or {}
    return {
        "reportId": request.reportId,
        "status": data.get("status"),
        "revision": int(data.get("revision") or 1),
        "failureReason": data.get("failureReason"),
        "generatedAt": data.get("generatedAt"),
        "updatedAt": data.get("updatedAt"),
    }


def prepare_report_preview_html(
    db: firestore.Client,
    request: ReportPreviewHtmlRequest,
) -> dict[str, Any]:
    comparison_resolution: Optional[ComparisonResolution] = None
    warnings: list[str] = []

    if request.mode == "snapshot":
        if not request.snapshotRange:
            raise ValueError("snapshotRange is required for snapshot preview")
        checkpoints = resolve_snapshot_checkpoints(
            db,
            request.userId,
            request.propertyId,
            snapshot_range=request.snapshotRange.model_dump(),
            checkpoint_ids=request.checkpointIds,
        )
        if not checkpoints:
            raise ValueError("No checkpoints match the selected date range")
        checkpoint_ids = [str(cp["id"]) for cp in checkpoints]
    elif request.mode == "comparison":
        if not request.baselineRange or not request.comparisonRange:
            raise ValueError(
                "baselineRange and comparisonRange are required for comparison preview"
            )
        comparison_resolution = resolve_comparison_checkpoints(
            db,
            request.userId,
            request.propertyId,
            baseline_range=request.baselineRange.model_dump(),
            comparison_range=request.comparisonRange.model_dump(),
        )
        comparison_resolution = filter_comparison_resolution(
            comparison_resolution,
            request.checkpointIds,
        )
        if not comparison_resolution.pairs and not (
            comparison_resolution.baseline_only_ids
            or comparison_resolution.comparison_only_ids
        ):
            raise ValueError("No checkpoints resolved for comparison preview")
        checkpoint_ids = comparison_resolution.all_checkpoint_ids()
        checkpoints = _load_checkpoints_by_ids(
            db, request.userId, request.propertyId, checkpoint_ids
        )
        if len(checkpoints) != len(checkpoint_ids):
            raise ValueError("One or more comparison checkpoints were not found")
        warnings = comparison_resolution_warnings(comparison_resolution)
    else:
        raise ValueError(f"Unsupported report mode: {request.mode}")

    from common.report.metrics import load_property_metrics, rollup_metrics_from_checkpoints
    from common.report.renderer import render_report_html
    from common.report.snapshot_builder import (
        build_comparison_report_content,
        build_snapshot_report_content,
    )

    prop_snap = (
        db.collection("users")
        .document(request.userId)
        .collection("properties")
        .document(request.propertyId)
        .get()
    )
    property_doc = prop_snap.to_dict() if prop_snap.exists else {}
    property_metrics = load_property_metrics(db, request.userId, request.propertyId)
    template = {
        **DEFAULT_TEMPLATE,
        **(request.template.model_dump() if request.template else {}),
    }

    if request.mode == "snapshot":
        content_snapshot, _chat_md = build_snapshot_report_content(
            property_doc=property_doc,
            property_id=request.propertyId,
            checkpoints=checkpoints,
            purpose=request.purpose,
            snapshot_range=request.snapshotRange.model_dump()
            if request.snapshotRange
            else None,
        )
    else:
        checkpoints_by_id = {str(cp["id"]): cp for cp in checkpoints}
        content_snapshot, _chat_md = build_comparison_report_content(
            property_doc=property_doc,
            property_id=request.propertyId,
            checkpoints_by_id=checkpoints_by_id,
            purpose=request.purpose,
            baseline_range=request.baselineRange.model_dump()
            if request.baselineRange
            else None,
            comparison_range=request.comparisonRange.model_dump()
            if request.comparisonRange
            else None,
            comparison_pairs=comparison_resolution.pairs if comparison_resolution else [],
            baseline_only_ids=(
                comparison_resolution.baseline_only_ids if comparison_resolution else []
            ),
            comparison_only_ids=(
                comparison_resolution.comparison_only_ids if comparison_resolution else []
            ),
        )

    content_snapshot["metrics"] = rollup_metrics_from_checkpoints(
        checkpoints,
        property_metrics,
    )
    html = render_report_html(
        title=request.title.strip() or "Property Report",
        content_snapshot=content_snapshot,
        template=template,
        custom_notes=request.customNotes,
    )
    result: dict[str, Any] = {"html": html}
    if warnings:
        result["warnings"] = warnings
    return result


async def generate_report_signed_url(
    db: firestore.Client,
    *,
    user_id: str,
    property_id: str,
    report_id: str,
    expiration_seconds: int = 900,
) -> dict[str, str]:
    ref = _reports_collection(db, user_id, property_id).document(report_id)
    snap = ref.get()
    if not snap.exists:
        raise ValueError("Report not found")

    data = snap.to_dict() or {}
    if data.get("status") != "ready":
        raise ValueError("Report PDF is not ready yet")
    storage_path = data.get("pdfStoragePath")
    if not storage_path:
        raise ValueError("Report has no PDF storage path")

    if not GCS_BUCKET:
        raise RuntimeError("Storage bucket is not configured")

    async with StorageClient(_report_storage_config()) as client:
        url = await client.generate_signed_url(
            bucket_name=GCS_BUCKET,
            blob_name=storage_path,
            signed_url_config=SignedUrlConfig(
                expiration=expiration_seconds,
                method="GET",
                response_disposition=f'inline; filename="{report_id}.pdf"',
            ),
        )
    return {"url": url, "expiresInSeconds": str(expiration_seconds)}


def set_report_rag_index(
    db: firestore.Client,
    request: ReportRagIndexRequest,
) -> dict[str, Any]:
    ref = _reports_collection(db, request.userId, request.propertyId).document(
        request.reportId
    )
    snap = ref.get()
    if not snap.exists:
        raise ValueError("Report not found")

    data = snap.to_dict() or {}
    if data.get("status") == "generating":
        raise ValueError("Cannot change Docs chat indexing while the report is generating")

    if request.includeInDocsChat:
        if not report_docs_chat_rag_enabled():
            raise ValueError(
                "Report Docs chat indexing is not enabled for this environment"
            )
        if data.get("status") != "ready":
            raise ValueError("Only ready reports can be indexed for Docs chat")
        md_gs_uri = str(data.get("mdGsUri") or "").strip()
        md_storage_path = str(data.get("mdStoragePath") or "").strip()
        if not md_gs_uri:
            raise ValueError("Report has no markdown companion yet")

        if (
            data.get("includeInDocsChat")
            and data.get("ragGsUri") == md_gs_uri
            and data.get("ragCompanionDocId")
        ):
            return {
                "ok": True,
                "includeInDocsChat": True,
                "ragCompanionDocId": str(data["ragCompanionDocId"]),
            }

        old_rag = str(data.get("ragGsUri") or "").strip()
        if old_rag and old_rag != md_gs_uri:
            _delete_report_rag_uris([old_rag])

        companion_doc_id = (
            str(data["ragCompanionDocId"])
            if data.get("ragCompanionDocId")
            else uuid.uuid4().hex
        )
        _upsert_report_rag_companion_doc(
            db,
            user_id=request.userId,
            property_id=request.propertyId,
            report_id=request.reportId,
            report_title=str(data.get("title") or "Property report"),
            md_gs_uri=md_gs_uri,
            md_storage_path=md_storage_path,
            companion_doc_id=companion_doc_id,
        )

        if not data.get("includeInDocsChat"):
            check_and_record_monthly_document_creations(db, request.userId, 1)

        message_id = _publish_report_rag_import(
            user_id=request.userId,
            gcs_urls=[md_gs_uri],
            context_doc_ids=[companion_doc_id],
        )
        ref.update(
            {
                "includeInDocsChat": True,
                "ragCompanionDocId": companion_doc_id,
                "ragGsUri": md_gs_uri,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        return {
            "ok": True,
            "includeInDocsChat": True,
            "ragCompanionDocId": companion_doc_id,
            "messageId": message_id,
        }

    warnings: list[str] = []
    old_rag = str(data.get("ragGsUri") or "").strip()
    if old_rag:
        warnings.extend(_delete_report_rag_uris([old_rag]))
    _delete_report_rag_companion_doc(
        db, request.userId, data.get("ragCompanionDocId")
    )
    ref.update(
        {
            "includeInDocsChat": False,
            "ragGsUri": firestore.DELETE_FIELD,
            "ragCompanionDocId": firestore.DELETE_FIELD,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )
    result: dict[str, Any] = {"ok": True, "includeInDocsChat": False}
    if warnings:
        result["warnings"] = warnings
    return result
