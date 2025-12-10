from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from firebase_api import (
    handle_firebase_agent_query,
    handle_firebase_file_upload,
    stream_firebase_agent_answers,
    create_agent_session,
    delete_agent_session
)
from models import AgentRequest
from pydantic import BaseModel

router = APIRouter()

class CreateSessionRequest(BaseModel):
    user_id: str

class DeleteSessionRequest(BaseModel):
    user_id: str
    session_id: str

@router.post("/firebase/chat")
async def chat(request: AgentRequest):
    """
    Handle chat messages from Firebase.
    """
    return await handle_firebase_agent_query(request)

@router.post("/firebase/upload")
async def upload(request: AgentRequest):
    """
    Handle file uploads from Firebase.
    """
    return handle_firebase_file_upload(request)

@router.post("/firebase/stream")
async def stream(request: AgentRequest):
    """
    Stream agent answers.
    """
    return StreamingResponse(
        stream_firebase_agent_answers(request),
        media_type="text/event-stream"
    )

@router.post("/firebase/session")
async def create_session(request: CreateSessionRequest):
    """
    Create a new agent session.
    """
    return create_agent_session(request.user_id)

@router.delete("/firebase/session")
async def delete_session(request: DeleteSessionRequest):
    """
    Delete an agent session.
    """
    return delete_agent_session(request.user_id, request.session_id)
