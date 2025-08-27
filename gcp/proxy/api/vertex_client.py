import os
import logging
import vertexai
from vertexai import agent_engines
from vertexai.agent_engines import AgentEngine
from typing import Optional, Dict, Any, List, Callable
 
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




async def stream_agent_answers(
    chat_id: int,
    user_query: str,
    gcs_files: Optional[List[str]] = None,
):
    if not reasoning_engine_resource:
        yield "Sorry, my AI brain is not connected right now. Please try again later."
        return
    session = get_or_create_reasoning_engine_session(chat_id)
    if not session:
        yield "Sorry, I couldn't create an active session. Please try again later."
        return
    session_id = session["id"]
    if gcs_files:
        gcs_files_str = ", ".join(gcs_files)
        message = f"Analyse {gcs_files_str}"
        if user_query:
            message += f" and user asked: {user_query}"
    else:
        message = user_query

    for event in reasoning_engine_resource.stream_query(
        user_id=str(chat_id), session_id=session_id, message=message
    ):
        # You can yield the whole event, or just the text/agent_name/etc.
        transfer_message = extract_event_data_with_transfer_target(event)
        if transfer_message:
            yield transfer_message
        else:
            # Extract and yield text parts
            parts = event.get("content", {}).get("parts", [])
            for part in parts:
                if isinstance(part, dict) and "text" in part and part["text"]:
                    yield f"[{prettify_name(event.get('author',''))}]: {part['text']}"


def extract_event_data_with_transfer_target(event_data: dict) -> str | None:
    """
    Extracts agent, tool names (can be multiple), and specifically the transfer target agent
    from a parsed event dictionary, returning a formatted string.
    Returns None if:
    1. content.parts[0].text exists.
    2. content.parts[0].function_response.response.result is None.
    """
    try:
        author_agent = event_data.get('author')
        called_tools = []
        responded_tools = []
        transfer_target_agent = None

        logger.info(f"Extracting from event data: {event_data}")

        content_parts = event_data.get('content', {}).get('parts', [])

        # --- NEW LOGIC (Combined): Return None based on content type ---
        if content_parts:
            first_part = content_parts[0]
            if 'text' in first_part:
                logger.info("Content contains direct text; returning None for tool/transfer extraction.")
                return None
            elif 'function_response' in first_part:
                response_result = first_part['function_response'].get('response', {}).get('result')
                if response_result is None:
                    logger.info("Function response result is None; returning None for this event.")
                    return None
        # --- END NEW LOGIC ---

        # Check for transfer_to_agent in actions (useful for function_response events, even if result is not None)
        actions = event_data.get('actions', {})
        if 'transfer_to_agent' in actions:
            transfer_target_agent = actions.get('transfer_to_agent')

        for part in content_parts:
            # Handle function_call events
            if 'function_call' in part:
                function_call_data = part['function_call']
                current_tool_name = function_call_data.get('name')
                if current_tool_name:
                    called_tools.append(current_tool_name)
                    
                    # Special handling for 'transfer_to_agent' function call
                    if current_tool_name == 'transfer_to_agent' and 'args' in function_call_data:
                        if 'agent_name' in function_call_data['args']:
                            transfer_target_agent = function_call_data['args']['agent_name']
            
            # Handle function_response events (only if result was not None, as per early exit)
            elif 'function_response' in part:
                function_response_data = part['function_response']
                current_tool_name = function_response_data.get('name')
                if current_tool_name and current_tool_name != 'transfer_to_agent':
                    if current_tool_name not in responded_tools:
                        responded_tools.append(current_tool_name)

        # --- Construct the final string response ---
        if not author_agent:
            logger.warning("No author agent found in event data.")
            return None

        result_parts = [f"Agent: {prettify_name(author_agent)}"]

        if transfer_target_agent:
            result_parts.append(f"Transferred To: {prettify_name(transfer_target_agent)}")

        if called_tools and not transfer_target_agent:
            result_parts.append(f"Called: {', '.join(prettify_name(tool) for tool in called_tools)}")
        if responded_tools:
            result_parts.append(f"Responded: {', '.join(prettify_name(tool) for tool in responded_tools)}")

        return ", ".join(result_parts) + "  \n"

    except (IndexError, KeyError) as e:
        logger.error(f"Error parsing event: {e}")
        return None

def prettify_name(name: str) -> str:
    """
    Converts a snake_case name like 'homecare_agent' to 'Homecare Agent'.
    """
    if not name:
        return ""
    return f"**{\" ".join(word.capitalize() for word in name.split("_"))}**"
