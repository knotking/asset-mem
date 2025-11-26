import os
import logging
import vertexai
from vertexai import agent_engines
from vertexai.agent_engines import AgentEngine
from typing import Optional, Dict, Any, List, Callable
import json
# from pydantic import BaseModel
from models import AgentRequest
from optional_agents import ANALYSIS_OPTIONAL_AGENT_ORDER
 
# Configure logging
logger = logging.getLogger(__name__)

_DISPLAY_NAME_MAP = {
    "property_agent": "Property Agent",
    "doculink_agent": "Doculink Agent",
    "diagnostic_agent": "Diagnostic Agent",
    "ask_knowledge_base_agent": "Scanning HomeGeekAI catalog",
    "ask_user_docs_agent": "Scanning your documents",
    "transfer_to_agent": "Transfer to Agent",
    "ask_knowledge_base_retrieval": "Accessing HomeGeekAI catalog",
    "ask_user_docs_retrieval": "Accessing your documents",
    "analyse_multimodal_data": "Analyzing Multimodal Data",
    "research_agent": "Researching Solutions",
    "service_provider_agent": "Service Provider Agent",
    "product_recommendations_agent": "Product Recommendations Agent",
    "cost_estimation_agent": "Cost Estimation Agent"
}

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

def publish_doc_to_secure_store(gcs_urls:list[str], user_query:str, user_id: str ) -> dict:
    """Publishes a structured payload to a secure storage."""
    try:
        from google.cloud import pubsub_v1  # <-- Fix import
        publisher = pubsub_v1.PublisherClient()
        
        topic_path = publisher.topic_path(os.environ.get("GCP_PROJECT_ID"), os.environ.get("USER_UPLOAD_TOPIC")) # Assuming only topic name, or pass full path
        payload = {
            "gcs_urls": gcs_urls,
            "user_id": user_id,
            "user_query": user_query,
            "source": 'rag-file-upload'  # Add source parameter
        }
        data = json.dumps(payload).encode("utf-8")
        future = publisher.publish(topic_path, data)
        return "Data published to Pub/Sub successfully with ID: {}".format(future.result())
    except Exception as e:
        logger.error(f"Failed to publish data to Pub/Sub: {e}")
        return {"error": str(e)}  

# --- Reasoning Engine Session Management Functions ---
def get_or_create_reasoning_engine_session(chat_id: str) -> Dict[str, Any]:
    if not reasoning_engine_resource:
        logger.error("Reasoning Engine not initialized. Cannot manage sessions.")
        raise RuntimeError("AI Agent service not ready.")
    sessionsObj = reasoning_engine_resource.list_sessions(user_id=chat_id)
    sessions = sessionsObj.get("sessions", [])
    session = None
    if not sessions:
        logger.info(f"No sessions found for user_id {chat_id}, creating new session.")
        session = reasoning_engine_resource.create_session(user_id=chat_id)
    else:
        session = sessions[-1]
    return session

def create_reasoning_engine_session(user_id: str) -> Dict[str, Any]:
    session = reasoning_engine_resource.create_session(user_id=user_id)
    return session

def delete_reasoning_engine_session(user_id: str, session_id: str):
    reasoning_engine_resource.delete_session(user_id=user_id, session_id=session_id)


async def stream_agent_answers(
    request: AgentRequest,
    parse_response: Optional[bool] = True
):
    if not reasoning_engine_resource:
        yield "Sorry, my AI brain is not connected right now. Please try again later."
        return
    user_id = request.user_id
    session_id = request.session_id
    user_query = request.user_query
    context_doc_uris = request.context_doc_uris
    diagnosis_uris = request.diagnosis_uris
    property_address = request.property_address
    location_data = request.location_data
    # Use user's selection if provided, otherwise default to all agents
    # Note: Empty list means "only triage, no optional agents"
    analysis_optional_agents = request.analysis_optional_agents if request.analysis_optional_agents is not None else ANALYSIS_OPTIONAL_AGENT_ORDER
    if not session_id:
        logger.info('Session ID not found. trying to create a new one')
        session = get_or_create_reasoning_engine_session(user_id)
        if not session:
            yield "Sorry, I couldn't create an active session. Please try again later."
            return
        session_id = session["id"]
        logger.info(f"Using session ID: {session_id}")
    
    payload: Dict[str, Any] = {"user_query": user_query}

    if context_doc_uris:
        payload["context_doc_uris"] = context_doc_uris

    if diagnosis_uris:
        payload["diagnosis_uris"] = diagnosis_uris
    
    if property_address:
        payload["property_address"] = property_address
    
    # Include location_data if provided (used when property_address is not available)
    if location_data:
        payload["location_data"] = {
            "latitude": location_data.latitude,
            "longitude": location_data.longitude,
            "radius_miles": location_data.radius_miles
        }

    if analysis_optional_agents:
        payload["analysis_optional_agents"] = analysis_optional_agents

    message = json.dumps(payload)

    for event in reasoning_engine_resource.stream_query(
        user_id=user_id, session_id=session_id, message=message
    ):
        if parse_response:
        # You can yield the whole event, or just the text/agent_name/etc.
            transfer_message = extract_event_data_with_transfer_target(event)
            if transfer_message:
                yield transfer_message
            else:
                # Extract and yield text parts
                parts = event.get("content", {}).get("parts", [])
                for part in parts:
                    if isinstance(part, dict) and "text" in part and part["text"]:
                        yield f"{prettify_name(event.get('author',''))}: {part['text']}"
        else:
            yield event

        
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

        result_parts = [f"{prettify_name(author_agent)}"]

        if transfer_target_agent:
            result_parts.append(f"TransferredTo: {prettify_name(transfer_target_agent)}")

        if called_tools and not transfer_target_agent:
            result_parts.append(f"Executing: {', '.join(format_name(tool, bold=False) for tool in called_tools)}")
        if responded_tools:
            result_parts.append(f"Completed: {', '.join(format_name(tool, bold=False) for tool in responded_tools)}")

        return " ".join(result_parts) + "  \n\n"

    except (IndexError, KeyError) as e:
        logger.error(f"Error parsing event: {e}")
        return None

def format_name(name: str, bold: bool = True) -> str:
    """
    Converts a snake_case name like 'homecare_agent' to 'Homecare Agent'
    and optionally bolds the output.
    """
    if not name:
        return ""
    formatted_name = _DISPLAY_NAME_MAP.get(name, " ".join(word.capitalize() for word in name.split("_")))
    return f"**{formatted_name}**" if bold else formatted_name

def prettify_name(name: str) -> str:
    """
    Converts a snake_case name like 'homecare_agent' to 'Homecare Agent' and bolds it.
    """
    return format_name(name, bold=True)
