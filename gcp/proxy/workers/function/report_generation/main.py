"""Pub/Sub worker: generate property snapshot report PDF."""

from __future__ import annotations

import base64
import json
import logging
import os
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import firestore
from google.cloud import storage

from comparison_narrative import generate_comparison_narrative
from md_companion import upload_report_markdown_companion
from pdf_renderer import html_to_pdf_bytes, render_report_html
from property_metrics import load_property_metrics, rollup_metrics_from_checkpoints
from report_narrative import generate_comparison_overview, generate_executive_summary
from snapshot_builder import build_comparison_report_content, build_snapshot_report_content

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _resolve_gcs_bucket() -> str | None:
    for key in ("GOOGLE_CLOUD_BUCKET", "GCS_BUCKET_NAME", "GCS_BUCKET"):
        value = (os.environ.get(key) or "").strip()
        if value:
            return value
    return None


GCS_BUCKET = _resolve_gcs_bucket()


def _report_docs_chat_rag_enabled() -> bool:
    raw = (os.environ.get("REPORT_DOCS_CHAT_RAG_ENABLED") or "").strip().lower()
    return raw in ("1", "true", "yes", "on")


def _ensure_firebase() -> firestore.Client:
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app()
    return firestore.client()


def _parse_event(request):
    if hasattr(request, "get_json"):
        return request.get_json(silent=True) or {}
    if isinstance(request, dict):
        return request
    return {}


def _decode_pubsub_payload(event: dict) -> dict:
    if "data" in event:
        raw = event["data"]
        if isinstance(raw, str):
            decoded = base64.b64decode(raw).decode("utf-8")
            return json.loads(decoded)
    return event


def _load_checkpoints(db: firestore.Client, user_id: str, property_id: str, ids: list[str]):
    ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("checkpoints")
    )
    out = []
    for cp_id in ids:
        snap = ref.document(cp_id).get()
        if snap.exists:
            data = snap.to_dict() or {}
            data["id"] = snap.id
            out.append(data)
    return out


def process_report_generation(payload: dict) -> None:
    user_id = payload.get("userId")
    property_id = payload.get("propertyId")
    report_id = payload.get("reportId")
    revision = int(payload.get("revision") or 1)
    checkpoint_ids = payload.get("checkpointIds") or []

    if not all([user_id, property_id, report_id, checkpoint_ids]):
        raise ValueError("Missing required report generation fields")

    db = _ensure_firebase()
    report_ref = (
        db.collection("users")
        .document(user_id)
        .collection("properties")
        .document(property_id)
        .collection("reports")
        .document(report_id)
    )
    report_snap = report_ref.get()
    if not report_snap.exists:
        logger.warning(
            "Report doc missing; skipping stale generation job reportId=%s user=%s property=%s",
            report_id,
            user_id,
            property_id,
        )
        return

    llm_usage: dict[str, int] | None = None
    try:
        from common.token import new_llm_usage_sink, persist_firestore_token_totals

        llm_usage = new_llm_usage_sink()
    except ImportError:
        llm_usage = None

    try:
        prop_snap = (
            db.collection("users")
            .document(user_id)
            .collection("properties")
            .document(property_id)
            .get()
        )
        property_doc = prop_snap.to_dict() if prop_snap.exists else {}

        checkpoints = _load_checkpoints(db, user_id, property_id, checkpoint_ids)
        if len(checkpoints) != len(checkpoint_ids):
            raise ValueError("One or more checkpoints were not found")

        mode = str(payload.get("mode") or "snapshot")
        if mode == "comparison":
            checkpoints_by_id = {str(cp["id"]): cp for cp in checkpoints}
            purpose = str(payload.get("purpose") or "rental_security")
            raw_pairs = payload.get("comparisonPairs") or []
            enriched_pairs: list[dict] = []
            for pair in raw_pairs:
                row = dict(pair)
                comparison = checkpoints_by_id.get(
                    str(row.get("comparisonCheckpointId") or "")
                ) or {}
                visual_diff = comparison.get("visualDiff") or {}
                if not visual_diff.get("summary"):
                    baseline = checkpoints_by_id.get(
                        str(row.get("baselineCheckpointId") or "")
                    ) or {}
                    narrative = generate_comparison_narrative(
                        location=str(row.get("location") or "Location"),
                        baseline_analysis=baseline.get("aiAnalysis") or {},
                        comparison_analysis=comparison.get("aiAnalysis") or {},
                        purpose=purpose,
                        usage_sink=llm_usage,
                    )
                    if narrative:
                        row["_geminiSummary"] = narrative
                enriched_pairs.append(row)
            content_snapshot, chat_markdown = build_comparison_report_content(
                property_doc=property_doc,
                property_id=property_id,
                checkpoints_by_id=checkpoints_by_id,
                purpose=purpose,
                baseline_range=payload.get("baselineRange"),
                comparison_range=payload.get("comparisonRange"),
                comparison_pairs=enriched_pairs,
                baseline_only_ids=payload.get("baselineOnlyCheckpointIds"),
                comparison_only_ids=payload.get("comparisonOnlyCheckpointIds"),
            )
            metrics = rollup_metrics_from_checkpoints(
                checkpoints,
                load_property_metrics(db, user_id, property_id),
            )
            content_snapshot["metrics"] = metrics
            pair_summaries = [
                str(row.get("summary") or "")
                for row in content_snapshot.get("comparisonPairs") or []
                if row.get("summary")
            ]
            overview = generate_comparison_overview(
                property_name=str(property_doc.get("name") or "Property"),
                purpose=purpose,
                pair_summaries=pair_summaries,
                metrics=metrics,
                usage_sink=llm_usage,
            )
            if overview:
                content_snapshot["narrative"] = {
                    "executiveSummary": overview,
                    "comparisonSummary": overview,
                }
        else:
            purpose = str(payload.get("purpose") or "realtor_visit")
            content_snapshot, chat_markdown = build_snapshot_report_content(
                property_doc=property_doc,
                property_id=property_id,
                checkpoints=checkpoints,
                purpose=purpose,
                snapshot_range=payload.get("snapshotRange"),
            )
            metrics = rollup_metrics_from_checkpoints(
                checkpoints,
                load_property_metrics(db, user_id, property_id),
            )
            content_snapshot["metrics"] = metrics
            summary = generate_executive_summary(
                property_name=str(property_doc.get("name") or "Property"),
                purpose=purpose,
                checkpoints=checkpoints,
                metrics=metrics,
                usage_sink=llm_usage,
            )
            if summary:
                content_snapshot["narrative"] = {"executiveSummary": summary}

        template = payload.get("template") or {}
        html = render_report_html(
            title=str(payload.get("title") or "Property Report"),
            content_snapshot=content_snapshot,
            template=template,
            custom_notes=payload.get("customNotes"),
        )
        pdf_bytes = html_to_pdf_bytes(
            html,
            document_title=str(payload.get("title") or "Property Report"),
            property_name=str(property_doc.get("name") or ""),
        )

        if not GCS_BUCKET:
            raise RuntimeError("GCS bucket not configured")

        storage_path = (
            f"uploads/{user_id}/properties/{property_id}/reports/"
            f"{report_id}/v{revision}.pdf"
        )
        client = storage.Client()
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(storage_path)
        blob.upload_from_string(pdf_bytes, content_type="application/pdf")
        gs_uri = f"gs://{GCS_BUCKET}/{storage_path}"

        md_storage_path, md_gs_uri = upload_report_markdown_companion(
            bucket_name=GCS_BUCKET,
            user_id=user_id,
            property_id=property_id,
            report_id=report_id,
            revision=revision,
            chat_markdown=chat_markdown,
        )

        update_fields: dict = {
            "status": "ready",
            "contentSnapshot": content_snapshot,
            "chatMarkdown": chat_markdown,
            "pdfStoragePath": storage_path,
            "pdfGsUri": gs_uri,
            "mdStoragePath": md_storage_path,
            "mdGsUri": md_gs_uri,
            "generatedAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "failureReason": firestore.DELETE_FIELD,
        }
        include_in_docs_chat = (
            bool(payload.get("includeInDocsChat")) and _report_docs_chat_rag_enabled()
        )
        if include_in_docs_chat:
            update_fields["ragGsUri"] = md_gs_uri

        report_ref.update(update_fields)

        if include_in_docs_chat:
            _publish_report_rag_import(
                user_id=user_id,
                gcs_urls=[md_gs_uri],
                context_doc_ids=[payload.get("ragCompanionDocId")]
                if payload.get("ragCompanionDocId")
                else [],
            )
        if llm_usage is not None:
            try:
                from common.token import persist_firestore_token_totals

                persist_firestore_token_totals(
                    str(user_id),
                    llm_usage,
                    worker_llm_call_increment=llm_usage.get("gemini_calls", 0),
                )
            except Exception as persist_exc:
                logger.warning("Report worker token persist failed: %s", persist_exc)

        logger.info(
            "Report ready user=%s property=%s report=%s revision=%s",
            user_id,
            property_id,
            report_id,
            revision,
        )
    except Exception as e:
        logger.exception("Report generation failed reportId=%s", report_id)
        if report_ref.get().exists:
            report_ref.update(
                {
                    "status": "failed",
                    "failureReason": str(e)[:500],
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                }
            )
        raise


def _publish_report_rag_import(
    *,
    user_id: str,
    gcs_urls: list[str],
    context_doc_ids: list[str],
) -> None:
    topic = (os.environ.get("USER_UPLOAD_TOPIC") or "").strip()
    project = (os.environ.get("GCP_PROJECT_ID") or "").strip()
    if not topic or not project:
        logger.warning("USER_UPLOAD_TOPIC or GCP_PROJECT_ID not set; skipping report RAG import")
        return
    from google.cloud import pubsub_v1

    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(project, topic)
    body = {
        "gcs_urls": gcs_urls,
        "user_id": user_id,
        "user_query": "Property report companion for Docs chat",
        "source": "report-rag-index",
        "context_doc_ids": context_doc_ids,
    }
    publisher.publish(topic_path, data=json.dumps(body).encode("utf-8")).result()
    logger.info(
        "Published report RAG import user=%s urls=%d doc_ids=%s",
        user_id,
        len(gcs_urls),
        context_doc_ids,
    )


def pubsub_to_report_generation(request, context=None):
    """Cloud Function entry point."""
    event = _parse_event(request)
    payload = _decode_pubsub_payload(event)
    process_report_generation(payload)
    return {"status": "ok"}


if __name__ == "__main__":
    import sys

    process_report_generation(json.loads(sys.argv[1]))
