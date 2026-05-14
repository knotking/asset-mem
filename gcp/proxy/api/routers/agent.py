from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import logging

from schemas.agent import AgentRequest, SessionRequest
from services.agent_service import handle_firebase_agent_query, stream_firebase_agent_answers
from services.vertex_service import create_reasoning_engine_session, delete_reasoning_engine_session
from common.token import TokenQuotaExceeded

router = APIRouter(tags=["Agent"])
logger = logging.getLogger(__name__)

@router.post("/firebase-agent-query", summary="Handle Agent Query", description="Process a query from the agent and return a response.")
async def firebase_webhook(request_data: AgentRequest):
    logger.info(f"Firebase query webhook data: {request_data.model_dump_json()}")
    try:
        return await handle_firebase_agent_query(request_data)
    except Exception as e:
        logger.exception("Error processing Firebase webhook: %s", e)
        return {"status": "error", "message": str(e)}

@router.post("/firebase-agent-stream", summary="Stream Agent Response", description="Process a query from the agent and stream the response.")
async def firebase_streaming_webhook(request_data: AgentRequest):
    try:
        return StreamingResponse(stream_firebase_agent_answers(request_data), media_type="text/event-stream")
    except Exception as e:
        logger.exception("Error processing Firebase streaming webhook: %s", e)
        return {"status": "error", "message": str(e)}

@router.post("/agent-session", summary="Create Agent Session", description="Create a new session for the agent.")
async def firebase_agent_session_create(request_data: AgentRequest):
    logger.info(f"Received session create request from user: {request_data.user_id}")
    try:
        return create_reasoning_engine_session(request_data.user_id)
    except TokenQuotaExceeded as e:
        return {
            "status": "error",
            "code": "TOKEN_QUOTA_EXCEEDED",
            "message": "Monthly AI token limit reached. Usage resets at the start of next month (UTC).",
            "used": e.used,
            "limit": e.limit,
            "period": e.period_key,
        }
    except Exception as e:
        logger.exception("Error processing agent session create: %s", e)
        return {"status": "error", "message": str(e)}

@router.delete("/agent-session", summary="Delete Agent Session", description="Delete an existing agent session.")
async def firebase_agent_session_delete(request_data: SessionRequest):
    logger.info(f"Received session delete request from user: {request_data.user_id}, {request_data.session_id}")
    try:
        delete_reasoning_engine_session(request_data.user_id, request_data.session_id)
        return {"status": "success", "message": "Deleted Session"}
    except Exception as e:
        logger.exception("Error processing agent session delete: %s", e)
        return {"status": "error", "message": str(e)}
