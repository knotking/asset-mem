"""Pub/Sub worker: Gemini document extraction and Firestore doc update."""

import logging

import firebase_admin
from firebase_admin import firestore

from common.gemini_document_extract import extract_document_fields
from common.observability.logging_context import install_auth_uid_logging_if_needed
from common.observability.pubsub_context import worker_request_scope
from common.token import (
    TokenQuotaExceeded,
    accumulate_google_genai_generate_response,
    check_token_quota_or_raise,
    new_llm_usage_sink,
    persist_firestore_token_totals,
)
from utils import parse_pubsub_message

logging.basicConfig(level=logging.INFO)
install_auth_uid_logging_if_needed()
logger = logging.getLogger(__name__)


def pubsub_document_analysis(request, context):
    """Process a document analysis message from Pub/Sub."""
    payload = parse_pubsub_message(request)
    doc_id = payload.get("docId")
    user_id = payload.get("userId")
    doc_url = payload.get("docUrl")
    content_type = payload.get("contentType")

    if not doc_id or not user_id or not doc_url or not content_type:
        logger.warning("Missing required fields in payload: %s", payload)
        return

    with worker_request_scope(payload):
        logger.debug(
            "document_analysis start docId=%s content_type=%s docUrl_len=%s",
            doc_id,
            content_type,
            len(doc_url or ""),
        )
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app()

        db = firestore.client()
        llm_usage = new_llm_usage_sink()
        doc_ref = db.collection("users").document(user_id).collection("docs").document(doc_id)

        try:
            snap = doc_ref.get()
            if not snap.exists:
                logger.warning("Doc not found: users/%s/docs/%s", user_id, doc_id)
                return

            data = snap.to_dict() or {}
            if data.get("userId") != user_id:
                logger.warning("userId field mismatch on doc %s", doc_id)
                return

            stored_gs = data.get("gsURI")
            if stored_gs and stored_gs != doc_url:
                logger.warning(
                    "gsURI mismatch doc=%s stored=%s payload=%s", doc_id, stored_gs, doc_url
                )
                doc_ref.update(
                    {
                        "status": "failed",
                        "summary": "Document analysis aborted: file reference mismatch.",
                    }
                )
                return

            try:
                check_token_quota_or_raise(db, user_id)
            except TokenQuotaExceeded as e:
                logger.warning(
                    "Document analysis skipped: token quota exceeded user=%s period=%s",
                    user_id,
                    e.period_key,
                )
                doc_ref.update(
                    {
                        "status": "failed",
                        "summary": "Monthly AI token limit reached.",
                        "docAnalysisQuotaExceeded": True,
                        "docAnalysisQuotaPeriod": e.period_key,
                        "docAnalysisQuotaUsed": e.used,
                        "docAnalysisQuotaLimit": e.limit,
                    }
                )
                return

            fields, raw = extract_document_fields(doc_url, content_type)
            if raw is not None:
                accumulate_google_genai_generate_response(llm_usage, raw)

            doc_ref.update(
                {
                    "documentType": fields["documentType"],
                    "propertyAddress": fields["propertyAddress"],
                    "keyEntities": fields["keyEntities"],
                    "summary": fields["summary"],
                    "status": "complete",
                }
            )
            logger.info("Document analysis completed docId=%s userId=%s", doc_id, user_id)

        except Exception as e:
            logger.error("Document analysis failed docId=%s: %s", doc_id, e, exc_info=True)
            try:
                doc_ref.update(
                    {
                        "status": "failed",
                        "summary": f"Analysis failed: {e!s}",
                    }
                )
            except Exception as upd_err:
                logger.error("Failed to mark doc failed: %s", upd_err, exc_info=True)
        finally:
            persist_firestore_token_totals(
                user_id,
                llm_usage,
                worker_llm_call_increment=llm_usage.get("gemini_calls", 0),
            )
