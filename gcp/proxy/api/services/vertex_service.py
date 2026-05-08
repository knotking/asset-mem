import os
import logging
import vertexai
from vertexai import agent_engines
from vertexai.agent_engines import AgentEngine
from typing import Optional, Dict, Any, List, Callable
import json
from google.cloud import pubsub_v1
from google.cloud import firestore
from google.cloud.firestore_v1 import FieldFilter

from schemas.agent import AgentRequest
from services.token_usage_service import (
    accumulate_usage_from_stream_event,
    persist_user_token_usage,
)
from common.token import TokenQuotaExceeded, check_token_quota_or_raise
 
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

# --- Property ID Retrieval from Firestore Session ---
def get_property_id_from_session_by_agent_id(user_id: str, agent_session_id: str) -> Optional[str]:
    """
    Retrieves property_id from Firestore session document by querying for agentSessionId.
    
    Option 2: Retrieve property_id from session metadata stored in Firestore.
    Session documents are stored at: users/{user_id}/chats/{session_id}
    and have an agentSessionId field that matches the Vertex AI agent session ID.
    
    Args:
        user_id: User ID
        agent_session_id: Vertex AI agent session ID (used to find Firestore session document)
        
    Returns:
        property_id if found in session document, None otherwise
    """
    try:
        db = firestore.Client()
        # Query Firestore sessions collection to find document with matching agentSessionId
        chats_ref = db.collection("users").document(user_id).collection("chats")
        query = chats_ref.where(
            filter=FieldFilter("agentSessionId", "==", agent_session_id)
        ).limit(1)
        docs = query.stream()
        
        for doc in docs:
            session_data = doc.to_dict()
            property_id = session_data.get("propertyId") or session_data.get("property_id")
            if property_id:
                logger.debug(f"Found property_id '{property_id}' in Firestore session document")
                return property_id
            else:
                logger.debug(f"No property_id found in Firestore session document")
                return None
        
        logger.debug(f"No Firestore session document found with agentSessionId: {agent_session_id}")
        return None
    except Exception as e:
        logger.debug(f"Error retrieving property_id from Firestore session (non-critical): {e}")
        return None


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
    if not reasoning_engine_resource:
        raise RuntimeError("AI Agent service not ready.")
    check_token_quota_or_raise(firestore.Client(), user_id)
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

    if user_id:
        try:
            check_token_quota_or_raise(firestore.Client(), user_id)
        except TokenQuotaExceeded as e:
            err = {
                "status": "error",
                "code": "TOKEN_QUOTA_EXCEEDED",
                "message": "Monthly AI token limit reached. Usage resets at the start of next month (UTC).",
                "used": e.used,
                "limit": e.limit,
                "period": e.period_key,
            }
            if parse_response:
                yield json.dumps(err)
            else:
                yield {"proxy_error": err}
            return
    user_query = request.user_query
    context_doc_uris = request.context_doc_uris
    diagnosis_uris = request.diagnosis_uris
    checkpoint_ids = request.checkpoint_ids  # Checkpoint IDs for checkpoint context
    if checkpoint_ids:
        logger.info(f"Received checkpoint_ids in request: {checkpoint_ids} (count: {len(checkpoint_ids)})")
    else:
        logger.debug("No checkpoint_ids provided in request")
    property_address = request.property_address
    property_id = request.property_id  # Option 1: property_id from request
    primary_agent = request.primary_agent  # Primary agent selection for explicit routing
    checkpoint_optional_agents = request.checkpoint_optional_agents or []
    location_type = request.location_type
    location_coordinates = request.location_coordinates
    location_radius = request.location_radius
    
    # Geocode address to coordinates if location_type is "address" and we have an address
    if location_type == "address" and property_address and not location_coordinates:
        try:
            from common.geocoding import GeocodingClient, GeocodingConfig
            
            geocoding_config = GeocodingConfig.from_env()
            if geocoding_config.is_configured:
                geocoding_client = GeocodingClient(geocoding_config)
                geocode_response = await geocoding_client.geocode(property_address, region="us")
                
                if geocode_response.success and geocode_response.has_location:
                    location_coordinates = {
                        "lat": geocode_response.lat,
                        "lng": geocode_response.lng
                    }
                    logger.info(f"Successfully geocoded address '{property_address}' to coordinates: {location_coordinates}")
                else:
                    logger.warning(f"Failed to geocode address '{property_address}': {geocode_response.error_message}")
            else:
                logger.debug("Geocoding not configured, skipping address geocoding")
        except Exception as e:
            logger.warning(f"Error during geocoding: {e}. Continuing with address only.")
    
    # Set default radius if not specified
    if location_radius is None and (location_coordinates or location_type):
        location_radius = 5  # Default to 5 miles
        logger.debug(f"Setting default location_radius to {location_radius} miles")
    
    if not session_id:
        logger.info('Session ID not found. trying to create a new one')
        session = get_or_create_reasoning_engine_session(user_id)
        if not session:
            yield "Sorry, I couldn't create an active session. Please try again later."
            return
        session_id = session["id"]
        logger.info(f"Using session ID: {session_id}")
    
    # Option 2: Try to retrieve property_id from Firestore session if not provided in request
    # Note: This requires finding the Firestore session document. We try to find it by agentSessionId.
    if not property_id and session_id and user_id:
        try:
            property_id_from_session = get_property_id_from_session_by_agent_id(user_id, session_id)
            if property_id_from_session:
                property_id = property_id_from_session
                logger.info(f"Retrieved property_id from Firestore session: {property_id}")
        except Exception as e:
            logger.debug(f"Could not retrieve property_id from Firestore session (this is optional): {e}")
    
    payload: Dict[str, Any] = {"user_query": user_query}

    if context_doc_uris:
        payload["context_doc_uris"] = context_doc_uris

    if diagnosis_uris:
        payload["diagnosis_uris"] = diagnosis_uris
    
    # Include checkpoint_ids if provided (enables checkpoint_agent routing)
    if checkpoint_ids:
        payload["checkpoint_ids"] = checkpoint_ids
        logger.info(f"Including checkpoint_ids in agent payload: {checkpoint_ids} (count: {len(checkpoint_ids)})")
    else:
        logger.debug("No checkpoint_ids to include in agent payload")
    
    # Include property_id if available (for checkpoint queries, etc.)
    if property_id:
        logger.info(f"Including property_id in agent payload: {property_id}")
        payload["property_id"] = property_id
    
    # Include primary_agent if provided (for explicit routing)
    if primary_agent:
        payload["primary_agent"] = primary_agent
        logger.info(f"Including primary_agent in agent payload: {primary_agent}")
    
    # Include checkpoint_optional_agents if provided
    if checkpoint_optional_agents:
        payload["checkpoint_optional_agents"] = checkpoint_optional_agents
        logger.info(f"Including checkpoint_optional_agents in payload: {checkpoint_optional_agents}")
    
    # Location handling logic:
    # Always include property_address if available (for context)
    if property_address:
        payload["property_address"] = property_address
    
    # Include location metadata when location data is present
    if location_type:
        payload["location_type"] = location_type
    
    # Include coordinates (either from request or geocoded from address)
    if location_coordinates:
        payload["location_coordinates"] = location_coordinates
        logger.info(f"Including location_coordinates in payload: {location_coordinates}")
    
    # Include radius (with default of 5 miles)
    if location_radius is not None:
        payload["location_radius"] = location_radius
        logger.info(f"Including location_radius in payload: {location_radius} miles")

    message = json.dumps(payload)
    logger.info(f"Sending message to Reasoning Engine: {message}")
    usage_running = {"prompt": 0, "candidates": 0, "total_only": 0}
    stream_event_count = 0
    logger.debug(
        "Token usage: stream_query starting user_id=%s session_id=%s parse_response=%s",
        user_id,
        session_id,
        parse_response,
    )
    try:
        for event in reasoning_engine_resource.stream_query(
            user_id=user_id, session_id=session_id, message=message
        ):
            accumulate_usage_from_stream_event(
                usage_running, event, event_index=stream_event_count
            )
            stream_event_count += 1
            if parse_response:
                transfer_message = extract_event_data_with_transfer_target(event)
                if transfer_message:
                    yield transfer_message
                else:
                    parts = event.get("content", {}).get("parts", [])
                    for part in parts:
                        if isinstance(part, dict) and "text" in part and part["text"]:
                            yield f"{prettify_name(event.get('author',''))}: {part['text']}"
            else:
                yield event
    finally:
        logger.debug(
            "Token usage: stream_query finished user_id=%s session_id=%s stream_chunks=%s "
            "aggregated=%s",
            user_id,
            session_id,
            stream_event_count,
            dict(usage_running),
        )
        persist_user_token_usage(user_id, usage_running)

        
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

