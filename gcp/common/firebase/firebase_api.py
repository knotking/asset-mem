# gcp/common/firebase/firebase_api.py
"""
Firebase API handlers for agent queries, streaming, and file uploads.

This module provides Firebase-specific API handlers that can be used
by proxy services and other GCP services.
"""
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List
import json

from .client import FirebaseClient, FirebaseConfig

logger = logging.getLogger(__name__)

# Initialize Firebase client
_firebase_client: Optional[FirebaseClient] = None

def get_firebase_client() -> FirebaseClient:
    """Get or create Firebase client instance."""
    global _firebase_client
    if _firebase_client is None:
        config = FirebaseConfig.from_env()
        _firebase_client = FirebaseClient(config)
    return _firebase_client


def _import_proxy_modules():
    """
    Import proxy-specific modules.
    This allows firebase_api to work from common while still using proxy modules.
    """
    # Add proxy/api to path if not already there
    proxy_api_path = Path(__file__).parent.parent.parent / "proxy" / "api"
    if str(proxy_api_path) not in sys.path:
        sys.path.insert(0, str(proxy_api_path))
    
    # Import proxy-specific modules
    from vertex_client import stream_agent_answers, publish_doc_to_secure_store
    from models import AgentRequest
    
    return stream_agent_answers, publish_doc_to_secure_store, AgentRequest


async def stream_firebase_agent_answers(request) -> Any:
    """
    Stream Firebase agent answers.
    
    Args:
        request: AgentRequest instance with user_id, user_query, etc.
        
    Yields:
        JSON strings with agent responses
    """
    stream_agent_answers, _, AgentRequest = _import_proxy_modules()
    
    logger.info(f"Processing Firebase message. Data: {request.user_id}, {request.user_query}, {request.context_doc_uris}, {request.diagnosis_uris}, {request.session_id}, {request.property_address}")
    if not request.user_id:
        logger.warning("User ID not provided for streaming.")
        yield json.dumps({"status": "error", "message": "User ID is required"})
        return

    try:
        logger.info(f"Authenticated user_id for streaming: {request.user_id}")

        async for event_part in stream_agent_answers(
            request=request
        ):
            if isinstance(event_part, dict) and "message" in event_part:
                logger.info(f"streaming dict message: {event_part}")
                yield event_part["message"]
            else:
                yield event_part

    except Exception as e:
        logger.error(f"Error in Firebase streaming handler: {e}")
        yield json.dumps({"status": "error", "message": f"Internal server error: {e}"})


def handle_firebase_file_upload(request) -> Dict[str, Any]:
    """
    Handle Firebase file upload.
    
    Args:
        request: AgentRequest instance with context_doc_uris, user_query, user_id
        
    Returns:
        Dict with status and message
    """
    _, publish_doc_to_secure_store, _ = _import_proxy_modules()
    
    result = publish_doc_to_secure_store(gcs_urls=request.context_doc_uris, user_query=request.user_query, user_id=request.user_id)
    logger.info(f"handle_firebase_file_upload: {result}")
    return {"status": "success", "message": "Files are published for upload"}


async def handle_firebase_agent_query(request) -> Dict[str, Any]:
    """
    Handles incoming Firebase messages.
    Verifies the Firebase ID token, extracts user_id, and processes the message further.
    
    Args:
        request: AgentRequest instance with user_id, user_query, etc.
        
    Returns:
        Dict with status and message
    """
    stream_agent_answers, _, _ = _import_proxy_modules()
    
    logger.info(f"Processing Firebase message. Data: {request.user_id}, {request.user_query}, {request.context_doc_uris}, {request.diagnosis_uris}, {request.session_id}, {request.property_address}")

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
            # event_part can be a string (from text parts) or a dict (from transfer messages)
            parts = event.get("content", {}).get("parts", [])
            for part in parts:
                if isinstance(part, dict) and "text" in part and part["text"]:
                    full_response_content.append(part['text'])
            # You might need to refine how you process event_part based on its actual structure

        final_response = " ".join(full_response_content).strip()
        if not final_response:
            final_response = "No response from agent."

        return {"status": "success", "message": final_response}

    except Exception as e:
        logger.error(f"Error processing message: {e}")
        return {"status": "error", "message": f"Internal server error: {e}"}

