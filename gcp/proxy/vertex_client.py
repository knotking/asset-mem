import os
import logging
import vertexai
from vertexai import agent_engines
from vertexai.agent_engines import AgentEngine
from typing import Optional, Dict, Any, List

# Configure logging
logger = logging.getLogger(__name__)


# --- Environment Variables ---
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
GCP_REGION = os.environ.get("GCP_REGION")
REASONING_ENGINE_ID = os.environ.get("REASONING_ENGINE_ID")


# --- Vertex AI Reasoning Engine Client (Global) ---
reasoning_engine_resource:AgentEngine = None
try:
    if GCP_PROJECT_ID and GCP_REGION and REASONING_ENGINE_ID:
        vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)
        reasoning_engine_resource = agent_engines.get(REASONING_ENGINE_ID)
        logger.info(f"Vertex AI Reasoning Engine client initialized for: {REASONING_ENGINE_ID}")
    else:
        logger.warning("Missing GCP_PROJECT_ID, GCP_REGION, or REASONING_ENGINE_ID. Vertex AI client or Session Service not initialized.")
except Exception as e:
    logger.error(f"Failed to initialize Vertex AI client or Session Service: {e}", exc_info=True)
    reasoning_engine_resource = None


# --- Reasoning Engine Session Management Functions ---
def get_or_create_reasoning_engine_session(telegram_chat_id: int) -> Dict[str, Any]:
    if not reasoning_engine_resource:
        logger.error("Reasoning Engine not initialized. Cannot manage sessions.")
        raise RuntimeError("AI Agent service not ready.")
    user_id_for_session = str(telegram_chat_id)
    sessionsObj = reasoning_engine_resource.list_sessions(user_id=str(user_id_for_session))
    sessions = sessionsObj.get("sessions", [])
    session = None
    if not sessions:
        logger.info(f"No sessions found for user_id {user_id_for_session}, creating new session.")
        session = reasoning_engine_resource.create_session(user_id=user_id_for_session)
    else:
        session = sessions[-1]
    return session




def stream_agent_response(chat_id: int, session_id: str, user_text: str) -> str:
    agent_answer_parts = []

    for event in reasoning_engine_resource.stream_query(
        user_id=str(chat_id), 
        session_id=session_id, 
        message=user_text
    ):
        logger.info(f"Event: {event}")
        parts = event.get("content", {}).get("parts", [])
        if isinstance(parts, list):
            agent_answer_parts.extend([str(p.get("text", "")) for p in parts if isinstance(p, dict) and "text" in p])
        else:
            logger.warning(f"Unexpected 'parts' format: {parts}")
            agent_answer_parts.append(str(parts))
    agent_answer = "".join(agent_answer_parts) if agent_answer_parts else "How can I help you?"
    return agent_answer

def format_vertex_rag_response(response) -> str:
    logger.info(f"Formatting response: {response}")
    parts = response.get('content', {}).get('parts', [])
    if not parts or not isinstance(parts, list):
        return "Not found"
    answer_lines = []
    for p in parts:
        if isinstance(p, dict):
            if "text" in p:
                answer_lines.append(str(p["text"]))
            elif "function_call" in p and isinstance(p["function_call"], dict):
                name = p["function_call"].get("name", "unknown_function")
                answer_lines.append(f"Checking now with {name}")
            else:
                answer_lines.append(str(p))
        else:
            answer_lines.append(str(p))
    return "\n".join(answer_lines) if answer_lines else "Not found"

# --- Unified function for Telegram bot ---

def get_agent_answer(
    chat_id: int,
    user_query: str,
    gcs_files: Optional[List[str]] = None
) -> str:
    if not reasoning_engine_resource:
        logger.error("Reasoning Engine not initialized. Cannot process request.")
        return "Sorry, my AI brain is not connected right now. Please try again later."
    try:
        session = get_or_create_reasoning_engine_session(chat_id)
        if not session:
            logger.error(f"Failed to create session for user_id {chat_id}")
            return "Sorry, I couldn't create an active session. Please try again later."
        session_id = session["id"]
        logger.info(f"Using Session ID: {session_id}")

        if gcs_files:
            # If GCS files are provided, format the message accordingly
            gcs_files_str = ", ".join(gcs_files)
            message = f"I have uploaded document(s) {gcs_files_str} What does this document(s) contain" 
            if user_query:
                message += f" and user asked: {user_query}"
        else:
            # If no GCS files, just use the user query
            message = user_query
        message = f"Get analysis for documents {gcs_files} where user asked: {user_query}" if gcs_files else user_query

        response = None
        for event in reasoning_engine_resource.stream_query(user_id=str(chat_id), session_id=session_id, message=message):
            response = event  # The last event will have the full response

        if response:
            return format_vertex_rag_response(response)
        return "How can I help you?"
    except Exception as e:
        logger.error(f"Error getting agent answer: {e}", exc_info=True)
        return "Oops! Unable to process your request. Please try again later."