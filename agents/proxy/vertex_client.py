import os
import logging
import vertexai
from vertexai import agent_engines

# Configure logging
logger = logging.getLogger(__name__)

# --- Environment Variables ---
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
GCP_REGION = os.environ.get("GCP_REGION")
REASONING_ENGINE_ID = os.environ.get("REASONING_ENGINE_ID")

# --- Vertex AI Reasoning Engine Client (Global) ---
reasoning_engine_resource = None
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
def get_or_create_reasoning_engine_session(telegram_chat_id: int):
    if not reasoning_engine_resource:
        logger.error("Reasoning Engine not initialized. Cannot manage sessions.")
        raise RuntimeError("AI Agent service not ready.")
    user_id_for_session = str(telegram_chat_id)
    logger.info(f"Creating new session for chat {telegram_chat_id}")
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
    for event in reasoning_engine_resource.stream_query(user_id=str(chat_id), session_id=session_id, message=user_text):
        logger.info(f"Event: {event}")
        parts = event.get("content", {}).get("parts", [])
        if isinstance(parts, list):
            agent_answer_parts.extend([str(p.get("text", "")) for p in parts if isinstance(p, dict) and "text" in p])
        else:
            logger.warning(f"Unexpected 'parts' format: {parts}")
            agent_answer_parts.append(str(parts))
    agent_answer = "".join(agent_answer_parts) if agent_answer_parts else "How can I help you?"
    return agent_answer

def format_vertex_rag_response(response: dict) -> str:
    main_answer = response['content']['parts'][0]['text']
    # citations = []
    # for chunk in response.get('grounding_metadata', {}).get('grounding_chunks', []):
    #     rag_chunk = chunk['retrieved_context']['rag_chunk']
    #     page_span = rag_chunk.get('page_span', {})
    #     first_page = page_span.get('first_page')
    #     last_page = page_span.get('last_page')
    #     if first_page and last_page and first_page != last_page:
    #         page_str = f"PP. {first_page}-{last_page}"
    #     else:
    #         page_str = f"P. {first_page or last_page or '?'}"
    #     citations.append(f"{page_str}")
    # answer_with_citations = f"{main_answer}\n\nReferences:\n"
    # for i, cite in enumerate(citations, 1):
    #     answer_with_citations += f"[{i}] {cite}\n"
    # return answer_with_citations
    return main_answer

# --- Unified function for Telegram bot ---
def get_agent_answer(chat_id: int, user_text: str) -> str:
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
        # Instead of just the answer, get the full response dict
        response = None
        agent_answer_parts = []
        for event in reasoning_engine_resource.stream_query(user_id=str(chat_id), session_id=session_id, message=user_text):
            response = event  # The last event will have the full response
            parts = event.get("content", {}).get("parts", [])
            if isinstance(parts, list):
                agent_answer_parts.extend([str(p.get("text", "")) for p in parts if isinstance(p, dict) and "text" in p])
            else:
                logger.warning(f"Unexpected 'parts' format: {parts}")
                agent_answer_parts.append(str(parts))
        if response:
            return format_vertex_rag_response(response)
        # fallback if no response
        agent_answer = "".join(agent_answer_parts) if agent_answer_parts else "How can I help you?"
        return agent_answer
    except Exception as e:
        logger.error(f"Error getting agent answer: {e}", exc_info=True)
        return "Oops! Unable to process your request. Please try again later." 