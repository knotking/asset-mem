from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
import logging

from schemas import AgentRequest, SessionRequest
from firebase_api import handle_firebase_agent_query, stream_firebase_agent_answers
from vertex_client import create_reasoning_engine_session, delete_reasoning_engine_session

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/firebase-agent-query")
async def firebase_webhook(request_data: AgentRequest):
    logger.info(f"Firebase query webhook data: {request_data.model_dump_json()}")
    try:
        return await handle_firebase_agent_query(request_data)
    except Exception as e:
        logger.error(f"Error processing Firebase webhook: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/firebase-agent-stream")
async def firebase_streaming_webhook(request_data: AgentRequest):
    try:
        return StreamingResponse(stream_firebase_agent_answers(request_data), media_type="text/event-stream")
    except Exception as e:
        logger.error(f"Error processing Firebase streaming webhook: {e}")
        return {"status": "error", "message": str(e)}

@router.post("/agent-session")
async def firebase_agent_session_create(request_data: AgentRequest):
    logger.info(f"Received session create request from user: {request_data.user_id}")
    try:
        return create_reasoning_engine_session(request_data.user_id)
    except Exception as e:
        logger.error(f"Error processing agent session create: {e}")
        return {"status": "error", "message": str(e)}

@router.delete("/agent-session")
async def firebase_agent_session_delete(request_data: SessionRequest):
    logger.info(f"Received session delete request from user: {request_data.user_id}, {request_data.session_id}")
    try:
        delete_reasoning_engine_session(request_data.user_id, request_data.session_id)
        return {"status": "success", "message": "Deleted Session"}
    except Exception as e:
        logger.error(f"Error processing agent session delete: {e}")
        return {"status": "error", "message": str(e)}

