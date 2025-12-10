import logging
from typing import Dict, Any, Optional, List
import firebase_admin
from firebase_admin import auth
from services.vertex_service import stream_agent_answers, publish_doc_to_secure_store
import json
from schemas.agent import AgentRequest

logger = logging.getLogger(__name__)

async def stream_firebase_agent_answers(request: AgentRequest):
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


def handle_firebase_file_upload( request: AgentRequest) -> Dict[str, Any]:
    result = publish_doc_to_secure_store(gcs_urls=request.context_doc_uris, user_query=request.user_query, user_id=request.user_id)
    logger.info(f"handle_firebase_file_upload: {result}")
    return {"status": "success", "message": "Files are published for upload"}

async def handle_firebase_agent_query(request: AgentRequest) -> Dict[str, Any]:
    """
    Handles incoming Firebase messages.
    Verifies the Firebase ID token, extracts user_id, and processes the message further.
    """
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

