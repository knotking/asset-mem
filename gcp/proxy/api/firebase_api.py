"""
Firebase API Module

Handlers for Firebase webhook endpoints including agent queries, streaming, and file uploads.
"""

import logging
from typing import Dict, Any
import json

from models import AgentRequest
from vertex_client import stream_agent_answers, publish_doc_to_secure_store

logger = logging.getLogger(__name__)


async def stream_firebase_agent_answers(request: AgentRequest):
    """
    Stream agent answers for Firebase requests.
    
    Args:
        request: AgentRequest with user query and context
        
    Yields:
        str: Streamed response chunks
    """
    logger.info(
        f"Processing Firebase streaming request",
        extra={
            "user_id": request.user_id,
            "session_id": request.session_id,
            "has_context_docs": bool(request.context_doc_uris),
            "has_diagnosis_docs": bool(request.diagnosis_uris),
        }
    )
    
    if not request.user_id:
        logger.warning("User ID not provided for streaming.")
        yield json.dumps({"status": "error", "message": "User ID is required"})
        return

    try:
        logger.info(f"Authenticated user_id for streaming: {request.user_id}")

        async for event_part in stream_agent_answers(request=request):
            if isinstance(event_part, dict) and "message" in event_part:
                logger.debug(f"Streaming dict message: {event_part}")
                yield event_part["message"]
            else:
                yield event_part

    except Exception as e:
        logger.error(f"Error in Firebase streaming handler: {e}", exc_info=True)
        yield json.dumps({"status": "error", "message": f"Internal server error: {e}"})


def handle_firebase_file_upload(request: AgentRequest) -> Dict[str, Any]:
    """
    Handle Firebase file upload request.
    
    Publishes uploaded files to Pub/Sub for processing.
    
    Args:
        request: AgentRequest with context_doc_uris containing file URLs
        
    Returns:
        Dict with status and message
    """
    if not request.context_doc_uris:
        return {"status": "error", "message": "No files provided"}
    
    try:
        result = publish_doc_to_secure_store(
            gcs_urls=request.context_doc_uris,
            user_query=request.user_query,
            user_id=request.user_id
        )
        logger.info(f"File upload processed: {result}")
        return {"status": "success", "message": "Files are published for upload"}
    except Exception as e:
        logger.error(f"Error handling file upload: {e}", exc_info=True)
        return {"status": "error", "message": f"Failed to process file upload: {str(e)}"}


async def handle_firebase_agent_query(request: AgentRequest) -> Dict[str, Any]:
    """
    Handle Firebase agent query request.
    
    Processes agent queries and returns complete response.
    
    Args:
        request: AgentRequest with user query and context
        
    Returns:
        Dict with status and message containing agent response
    """
    logger.info(
        f"Processing Firebase agent query",
        extra={
            "user_id": request.user_id,
            "session_id": request.session_id,
            "has_context_docs": bool(request.context_doc_uris),
            "has_diagnosis_docs": bool(request.diagnosis_uris),
        }
    )

    if not request.user_id:
        logger.warning("User ID not provided.")
        return {"status": "error", "message": "User ID is required"}

    try:
        logger.info(f"Authenticated user_id: {request.user_id}")

        full_response_content = []

        async for event in stream_agent_answers(
            request=request,
            parse_response=False
        ):
            # Extract text parts from event
            parts = event.get("content", {}).get("parts", [])
            for part in parts:
                if isinstance(part, dict) and "text" in part and part["text"]:
                    full_response_content.append(part['text'])

        final_response = " ".join(full_response_content).strip()
        if not final_response:
            final_response = "No response from agent."

        return {"status": "success", "message": final_response}

    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)
        return {"status": "error", "message": f"Internal server error: {e}"}