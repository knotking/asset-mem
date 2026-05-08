"""
Checkpoint Agent

Retrieves checkpoint information using Firestore Vector Search for semantic query matching.
Can optionally trigger comprehensive analysis with coverage, DIY, service, and cost recommendations.
"""

import logging
from typing import Optional, List
from google.adk.agents import Agent
from google.adk.tools import ToolContext
from google.adk.tools.agent_tool import AgentTool
from dotenv import load_dotenv
from .prompts import checkpoint_agent_instruction
from .firestore_vector_search import search_checkpoints_by_vector
from ...agent_inputs import DocsInput

load_dotenv()

logger = logging.getLogger(__name__)


def ask_checkpoints_retrieval(
    user_query: str,
    property_id: str,  # Mandatory - required for property-specific checkpoint queries
    location: Optional[str] = None,
    checkpoint_ids: Optional[List[str]] = None,
    tool_context: ToolContext = None
):
    """
    Retrieves relevant checkpoints using Firestore Vector Search based on semantic query matching.
    
    Args:
        user_query: Natural language query about checkpoints (e.g., "Show me checkpoints with water damage")
        property_id: Property ID (REQUIRED) - must be provided to query property-specific checkpoints
        location: Optional location filter (e.g., "Kitchen", "Car")
        checkpoint_ids: Optional list of specific checkpoint IDs to limit results to (when provided, only these checkpoints are considered)
        tool_context: Tool context containing user_id and session information
        
    Returns:
        List of checkpoint dictionaries with relevant checkpoint data, or empty list if no matches
    """
    try:
        logger.info(f"ask_checkpoints_retrieval called with: user_query='{user_query}', property_id={property_id}, location={location}, checkpoint_ids={checkpoint_ids}")
        
        # Get user_id from context
        user_id = tool_context.state.get("user_id") or tool_context._invocation_context.session.user_id
        logger.info(f"Retrieved user_id from context: {user_id}")
        
        # property_id is now mandatory in function signature, but check tool_context.state as fallback if somehow missing
        if not property_id:
            property_id = tool_context.state.get("property_id")
            logger.warning(f"property_id not provided as parameter, attempting to retrieve from tool_context.state: {property_id}")
        
        if not user_id:
            logger.error(f"Missing user_id: user_id={user_id}")
            return []
        
        if not property_id:
            logger.error("Missing property_id - checkpoint retrieval REQUIRES property_id. Cannot proceed without it.")
            return []
        
        logger.info(f"Using user_id={user_id}, property_id={property_id} for checkpoint retrieval")
        
        # Lazy import to avoid deployment issues
        from google.cloud import firestore
        
        # Initialize Firestore client
        db = firestore.Client()
        
        # If specific checkpoint IDs are provided, fetch those checkpoints directly
        if checkpoint_ids and len(checkpoint_ids) > 0:
            logger.info(f"Fetching specific checkpoints by ID: {checkpoint_ids} (count: {len(checkpoint_ids)})")
            checkpoints = []
            checkpoints_ref = db.collection("users").document(user_id)\
                .collection("properties").document(property_id)\
                .collection("checkpoints")
            logger.info(f"Checkpoint collection path: users/{user_id}/properties/{property_id}/checkpoints")
            
            for checkpoint_id in checkpoint_ids:
                try:
                    logger.debug(f"Fetching checkpoint document: {checkpoint_id}")
                    checkpoint_doc = checkpoints_ref.document(checkpoint_id).get()
                    if checkpoint_doc.exists:
                        checkpoint_data = checkpoint_doc.to_dict()
                        checkpoint_data["id"] = checkpoint_doc.id
                        checkpoints.append(checkpoint_data)
                        logger.info(f"Successfully fetched checkpoint {checkpoint_id}: has aiAnalysis={bool(checkpoint_data.get('aiAnalysis'))}")
                    else:
                        logger.warning(f"Checkpoint document {checkpoint_id} does not exist")
                except Exception as e:
                    logger.error(f"Error fetching checkpoint {checkpoint_id}: {e}", exc_info=True)
            
            logger.info(f"Fetched {len(checkpoints)} checkpoints out of {len(checkpoint_ids)} requested")
            if not checkpoints:
                logger.warning(f"None of the specified checkpoint IDs were found: {checkpoint_ids}")
                return []
        else:
            # Perform vector search when no specific checkpoint IDs provided
            logger.info(f"Performing vector search for query: '{user_query}' (no specific checkpoint_ids provided)")
            checkpoints = search_checkpoints_by_vector(
                db=db,
                user_id=user_id,
                property_id=property_id,
                query_text=user_query,
                limit=5,
                location=location
            )
            
            logger.info(f"Vector search returned {len(checkpoints)} checkpoints")
            if not checkpoints:
                logger.warning(f"No checkpoints found for query: {user_query}")
                return []
        
        # Format checkpoints for agent consumption
        # Extract relevant information: summary, location, detected items, issues, etc.
        logger.info(f"Formatting {len(checkpoints)} checkpoints for agent consumption")
        formatted_results = []
        for idx, checkpoint in enumerate(checkpoints):
            logger.debug(f"Processing checkpoint {idx+1}/{len(checkpoints)}: id={checkpoint.get('id')}")
            checkpoint_id = checkpoint.get("id")
            ai_analysis = checkpoint.get("aiAnalysis", {})
            
            # Build a summary text from checkpoint data
            summary_parts = []
            if ai_analysis.get("summary"):
                summary_parts.append(f"Summary: {ai_analysis['summary']}")
            
            location = checkpoint.get("location") or ai_analysis.get("detectedAsset")
            if location:
                summary_parts.append(f"Location/Asset: {location}")
            
            detected_items = ai_analysis.get("detectedItems", [])
            if detected_items:
                items_text = ", ".join(detected_items[:5])  # Limit to first 5
                summary_parts.append(f"Detected items: {items_text}")
            
            issues = ai_analysis.get("issues", [])
            if issues:
                issue_descriptions = []
                for issue in issues[:3]:  # Limit to first 3 issues
                    if isinstance(issue, dict):
                        issue_descriptions.append(issue.get("description", ""))
                    elif isinstance(issue, str):
                        issue_descriptions.append(issue)
                
                if issue_descriptions:
                    issues_text = "; ".join(issue_descriptions)
                    summary_parts.append(f"Issues: {issues_text}")
            
            conditions = ai_analysis.get("conditions", [])
            if conditions:
                conditions_text = ", ".join(conditions[:3])  # Limit to first 3
                summary_parts.append(f"Conditions: {conditions_text}")
            
            # Get checkpoint name (prefer name, fallback to location or "Checkpoint")
            checkpoint_name = checkpoint.get("name") or location or "Checkpoint"
            
            # Include checkpoint name in the text summary for agent consumption
            if checkpoint_name and checkpoint_name != "Checkpoint":
                summary_parts.insert(0, f"Checkpoint Name: {checkpoint_name}")
            
            # Build formatted checkpoint data
            formatted_checkpoint = {
                "checkpointId": checkpoint_id,  # Keep ID for internal reference
                "checkpointName": checkpoint_name,  # Add name field
                "text": "\n".join(summary_parts) if summary_parts else "No summary available",
                "location": location,
                "createdAt": checkpoint.get("createdAt"),
                "summary": ai_analysis.get("summary", ""),
                "detectedItems": detected_items,
                "conditions": conditions,
                "issues": issues[:5] if issues else [],  # Limit issues for context
                "similarity_score": checkpoint.get("similarity_score", 0.0)
            }
            
            formatted_results.append(formatted_checkpoint)
            logger.debug(f"Formatted checkpoint {idx+1}: has text={bool(formatted_checkpoint.get('text'))}, text_length={len(formatted_checkpoint.get('text', ''))}")
        
        logger.info(f"Successfully formatted {len(formatted_results)} checkpoints for query: '{user_query[:100]}'")
        if formatted_results:
            logger.info(f"Sample formatted checkpoint text (first 200 chars): {formatted_results[0].get('text', '')[:200]}")
        return formatted_results
        
    except Exception as e:
        logger.error(f"Error retrieving checkpoints: {e}", exc_info=True)
        return []


checkpoint_agent = Agent(
    model='gemini-2.5-flash',
    name='checkpoint_agent',
    instruction=checkpoint_agent_instruction(),
    input_schema=DocsInput,  # Reuse DocsInput schema (user_query, property_id, checkpoint_optional_agents, etc.)
    tools=[
        ask_checkpoints_retrieval
        # Note: checkpoint_analysis_agent will be added dynamically after initialization
        # to avoid circular import issues
    ],
    disallow_transfer_to_parent=True,
    output_key='checkpoint_result'
)

# Add checkpoint_analysis_agent as a tool after checkpoint_agent is created
# This avoids circular import issues
try:
    from ..checkpoint_analysis_agent.agent import checkpoint_analysis_agent
    checkpoint_agent.tools.append(AgentTool(checkpoint_analysis_agent))
except ImportError:
    # checkpoint_analysis_agent not available yet, will be added later
    logger.warning("checkpoint_analysis_agent not available during initialization")

__all__ = ["checkpoint_agent"]
