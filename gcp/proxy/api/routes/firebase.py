from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from firebase_api import (
    handle_firebase_agent_query,
    handle_firebase_file_upload,
    stream_firebase_agent_answers
)
from models import AgentRequest

router = APIRouter()

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
