import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from core.firebase_auth import apply_uid_to_agent_request, apply_uid_to_camel_user_id, require_firebase_uid
from schemas.agent import AgentRequest
from schemas.document import ExtractDocInfoRequest
from services.agent_service import handle_firebase_file_upload
from services.document_service import publish_document_analysis

router = APIRouter(tags=["Documents"])
logger = logging.getLogger(__name__)


@router.post("/rag-file-upload", summary="Upload RAG File", description="Upload a file for RAG (Retrieval-Augmented Generation) processing.")
async def firebase_webhook_file_upload(
    request_data: AgentRequest,
    uid: Annotated[str, Depends(require_firebase_uid)],
):
    apply_uid_to_agent_request(request_data, uid)
    logger.info(f"Firebase webhook file upload data: {request_data.model_dump_json()}")
    try:
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
    uid: Annotated[str, Depends(require_firebase_uid)],
):
    apply_uid_to_camel_user_id(request_data, uid)
    logger.info(
        "Queue document analysis: docId=%s userId=%s",
        request_data.docId,
        request_data.userId,
    )
    try:
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
