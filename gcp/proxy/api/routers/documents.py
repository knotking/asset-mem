import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from google.cloud import firestore

from common.plan_limits import PlanLimitExceeded, check_and_record_monthly_document_creations
from core.auth_deps import RATE_BUCKET_AGENT, RATE_BUCKET_DOCUMENTS, authenticated_user
from utils.plan_limit_http import plan_limit_exceeded_response
from core.firebase_auth import apply_uid_to_agent_request, apply_uid_to_camel_user_id
from schemas.agent import AgentRequest
from schemas.document import ExtractDocInfoRequest
from services.agent_service import handle_firebase_file_upload
from services.document_service import publish_document_analysis

router = APIRouter(tags=["Documents"])
logger = logging.getLogger(__name__)


@router.post("/rag-file-upload", summary="Upload RAG File", description="Upload a file for RAG (Retrieval-Augmented Generation) processing.")
async def firebase_webhook_file_upload(
    request_data: AgentRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_AGENT))],
):
    apply_uid_to_agent_request(request_data, uid)
    logger.info(f"Firebase webhook file upload data: {request_data.model_dump_json()}")
    try:
        uris = request_data.context_doc_uris or []
        if uris:
            db = firestore.Client()
            try:
                check_and_record_monthly_document_creations(db, uid, len(uris))
            except PlanLimitExceeded as e:
                return plan_limit_exceeded_response(e)
        return handle_firebase_file_upload(request_data)
    except Exception as e:
        logger.exception("Error processing Firebase webhook (rag upload): %s", e)
        return {"status": "error", "message": str(e)}


@router.post(
    "/extract-doc-info",
    summary="Queue document extraction",
    description=(
        "Publishes document analysis to Pub/Sub. The worker updates the Firestore doc "
        "(`users/{userId}/docs/{docId}`) when complete. Clients should listen on that document."
    ),
)
async def extract_document_info_endpoint(
    request_data: ExtractDocInfoRequest,
    uid: Annotated[str, Depends(authenticated_user(RATE_BUCKET_DOCUMENTS))],
):
    apply_uid_to_camel_user_id(request_data, uid)
    logger.info(
        "Queue document analysis: docId=%s userId=%s",
        request_data.docId,
        request_data.userId,
    )
    try:
        db = firestore.Client()
        try:
            check_and_record_monthly_document_creations(db, request_data.userId, 1)
        except PlanLimitExceeded as e:
            return plan_limit_exceeded_response(e)

        message_id = publish_document_analysis(request_data)
        return JSONResponse(
            status_code=202,
            content={
                "status": "accepted",
                "message": "Document analysis queued for processing",
                "docId": request_data.docId,
                "messageId": message_id,
            },
        )
    except Exception as e:
        logger.error("Error publishing document analysis: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e
