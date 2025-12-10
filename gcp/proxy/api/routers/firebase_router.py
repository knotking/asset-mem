"""
Firebase Router

Firebase webhook endpoints for agent queries, streaming, sessions, and file uploads.
"""

import logging
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import StreamingResponse

from models import AgentRequest, ExtractDocInfoRequest
from models.error_models import ErrorResponse
from optional_agents import normalize_analysis_optional_agents
from firebase_api import (
    handle_firebase_agent_query,
    stream_firebase_agent_answers,
    handle_firebase_file_upload,
)
from vertex_client import create_reasoning_engine_session, delete_reasoning_engine_session
from document_analysis import extract_doc_info
from dependencies import get_request_id, verify_webhook_secret
from config import settings
from constants import HTTP_BAD_REQUEST, HTTP_INTERNAL_SERVER_ERROR

logger = logging.getLogger(__name__)

router = APIRouter(tags=["firebase"])


async def _extract_firebase_request_data(request: Request) -> AgentRequest:
    """Extract and validate Firebase request data."""
    data = await request.json()
    user_id = data.get("user_id", "")
    if not user_id:
        logger.error("User ID is required")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID is required"
        )

    session_id = data.get("session_id", "")
    user_query = data.get("user_query", "Analyse")
    context_doc_uris = data.get("context_doc_uris", [])
    diagnosis_uris = data.get("diagnosis_uris", [])
    property_address = data.get("property_address", "")
    analysis_optional_agents = normalize_analysis_optional_agents(data.get("analysis_optional_agents"))
    
    # Extract location data
    location_type = data.get("location_type")
    location_coordinates = data.get("location_coordinates")
    location_radius = data.get("location_radius")
    
    return AgentRequest(
        user_id=user_id,
        user_query=user_query,
        context_doc_uris=context_doc_uris,
        diagnosis_uris=diagnosis_uris,
        session_id=session_id,
        property_address=property_address,
        analysis_optional_agents=analysis_optional_agents,
        location_type=location_type,
        location_coordinates=location_coordinates,
        location_radius=location_radius,
    )


@router.post("/firebase-agent-query")
async def firebase_webhook(request: Request):
    """
    Handle Firebase agent query webhook.
    
    Processes agent queries and returns complete response.
    """
    # Verify webhook secret
    if not verify_webhook_secret(request, settings.firebase_webhook_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret"
        )
    
    logger.info("Firebase query webhook received a request.")
    request_id = get_request_id(request)
    
    try:
        request_data = await _extract_firebase_request_data(request)
        logger.info(f"Firebase query webhook data: {request_data.model_dump_json()}")
        
        result = await handle_firebase_agent_query(request_data)
        return result
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}", extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing Firebase webhook: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/firebase-agent-stream")
async def firebase_streaming_webhook(request: Request):
    """
    Handle Firebase agent streaming webhook.
    
    Streams agent responses as Server-Sent Events (SSE).
    """
    # Verify webhook secret
    if not verify_webhook_secret(request, settings.firebase_webhook_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret"
        )
    
    logger.info("Firebase streaming webhook received a request.")
    request_id = get_request_id(request)
    
    try:
        request_data = await _extract_firebase_request_data(request)
        return StreamingResponse(
            stream_firebase_agent_answers(request_data),
            media_type="text/event-stream"
        )
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}", extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing Firebase streaming webhook: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/agent-session")
async def firebase_agent_session_webhook(request: Request):
    """
    Create a new agent session.
    
    Creates a new reasoning engine session for the user.
    """
    # Verify webhook secret
    if not verify_webhook_secret(request, settings.firebase_webhook_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret"
        )
    
    logger.info("Firebase agent session webhook received a request.")
    request_id = get_request_id(request)
    
    try:
        request_data = await _extract_firebase_request_data(request)
        user_id = request_data.user_id
        logger.info(f"Received session create request from user: {user_id}", extra={"request_id": request_id})
        return create_reasoning_engine_session(user_id)
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}", extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing Firebase agent session webhook: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.delete("/agent-session")
async def firebase_agent_delete_session_webhook(request: Request):
    """
    Delete an agent session.
    
    Deletes a reasoning engine session for the user.
    """
    # Verify webhook secret
    if not verify_webhook_secret(request, settings.firebase_webhook_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret"
        )
    
    logger.info("Firebase agent session delete webhook received a request.")
    request_id = get_request_id(request)
    
    try:
        data = await request.json()
        user_id = data.get("user_id", "")
        session_id = data.get("session_id", "")
        
        if not user_id or not session_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id and session_id are required"
            )
        
        logger.info(f"Received session delete request from user: {user_id}, {session_id}", extra={"request_id": request_id})
        delete_reasoning_engine_session(user_id, session_id)
        return {"status": "success", "message": "Session deleted"}
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}", extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing Firebase agent session webhook: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/rag-file-upload")
async def firebase_webhook_file_upload(request: Request):
    """
    Handle Firebase file upload webhook.
    
    Publishes uploaded files to Pub/Sub for processing.
    """
    # Verify webhook secret
    if not verify_webhook_secret(request, settings.firebase_webhook_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret"
        )
    
    logger.info("Firebase webhook file upload received a request.")
    request_id = get_request_id(request)
    
    try:
        request_data = await _extract_firebase_request_data(request)
        logger.info(f"Firebase webhook file upload data: {request_data.model_dump_json()}", extra={"request_id": request_id})
        return handle_firebase_file_upload(request_data)
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}", extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing Firebase webhook: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post("/extract-doc-info")
async def extract_document_info(request: Request):
    """
    Extract structured information from property documents using Gemini AI.
    
    This endpoint analyzes documents and extracts:
    - Document type (DEED, INSURANCE_POLICY, etc.)
    - Property address (normalized)
    - Key entities (policy numbers, dates, amounts)
    - Summary
    
    Request body:
    {
        "docUrl": "https://storage.googleapis.com/.../document.pdf",
        "contentType": "application/pdf"
    }
    """
    # Verify webhook secret
    if not verify_webhook_secret(request, settings.firebase_webhook_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook secret"
        )
    
    logger.info("Document analysis endpoint received a request.")
    request_id = get_request_id(request)
    
    try:
        data = await request.json()
        doc_request = ExtractDocInfoRequest(**data)
        logger.info(f"Analyzing document: {doc_request.docUrl}", extra={"request_id": request_id})

        result = extract_doc_info(doc_request)

        logger.info(f"Analysis complete: {result.documentType.value}", extra={"request_id": request_id})
        return result.model_dump()

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}", extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing document analysis: {e}", exc_info=True, extra={"request_id": request_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
