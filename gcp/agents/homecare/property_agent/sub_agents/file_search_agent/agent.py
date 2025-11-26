"""
File Search Agent Implementation

This agent uses Gemini's File Search capabilities to search through
user-uploaded documents. It integrates with the Firestore metadata
store to track files and their Gemini file IDs.
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any

import google.generativeai as genai
from google.cloud import firestore
from google.adk.agents import Agent
from google.adk.tools import ToolContext
from dotenv import load_dotenv

from .prompts import file_search_agent_instruction, file_search_query_prompt
from ...agent_inputs import DocsInput

load_dotenv()

logger = logging.getLogger("file_search_agent")

# Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")

# Initialize Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Initialize Firestore client
_firestore_client: Optional[firestore.Client] = None


def get_firestore_client() -> firestore.Client:
    """Get or create Firestore client."""
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = firestore.Client(project=GCP_PROJECT_ID)
    return _firestore_client


def get_user_gemini_files(
    user_id: str,
    context_doc_uris: Optional[List[str]] = None,
    property_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch Gemini file metadata for a user from Firestore.
    
    Args:
        user_id: User ID to fetch files for
        context_doc_uris: Optional list of specific GCS URIs to filter by
        property_id: Optional property ID to filter by
        
    Returns:
        List of file metadata dicts with gemini_file_id, gemini_file_uri, etc.
    """
    client = get_firestore_client()
    
    # Query for active files for this user
    query = (
        client.collection("gemini_files")
        .where("user_id", "==", user_id)
        .where("status", "==", "active")
    )
    
    if property_id:
        query = query.where("property_id", "==", property_id)
    
    files = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        
        # If context_doc_uris specified, filter to matching files
        if context_doc_uris:
            if data.get("gcs_url") in context_doc_uris:
                files.append(data)
            elif data.get("original_filename") in context_doc_uris:
                files.append(data)
        else:
            files.append(data)
    
    logger.info(f"Found {len(files)} Gemini files for user {user_id}")
    return files


def search_with_gemini_files(
    query: str,
    gemini_files: List[Dict[str, Any]],
    model_name: str = "gemini-2.0-flash",
) -> str:
    """
    Search through Gemini files using the model's context capabilities.
    
    Args:
        query: Search query
        gemini_files: List of file metadata dicts
        model_name: Gemini model to use
        
    Returns:
        Search result string
    """
    if not gemini_files:
        return "No documents found to search."
    
    # Get Gemini file objects
    file_parts = []
    file_names = []
    
    for file_data in gemini_files[:20]:  # Limit to 20 files
        try:
            gemini_file_id = file_data.get("gemini_file_id")
            if gemini_file_id:
                # Extract just the file ID if it's a full path
                file_id = gemini_file_id.split("/")[-1] if "/" in gemini_file_id else gemini_file_id
                gemini_file = genai.get_file(file_id)
                file_parts.append(gemini_file)
                file_names.append(file_data.get("original_filename", gemini_file_id))
        except Exception as e:
            logger.warning(f"Failed to get Gemini file {file_data.get('gemini_file_id')}: {e}")
    
    if not file_parts:
        return "Could not access any of the uploaded documents."
    
    # Create the search prompt
    search_prompt = file_search_query_prompt(query, file_names)
    
    # Use Gemini model with file context
    model = genai.GenerativeModel(model_name)
    
    try:
        response = model.generate_content([*file_parts, search_prompt])
        return response.text
    except Exception as e:
        logger.error(f"Gemini search failed: {e}")
        return f"Error searching documents: {str(e)}"


def ask_file_search_retrieval(
    user_query: str,
    context_doc_uris: Optional[List[str]] = None,
    tool_context: ToolContext = None,
) -> str:
    """
    Tool function for searching user documents via Gemini File Search.
    
    This replaces the Vertex AI RAG retrieval in the user_docs_agent.
    
    Args:
        user_query: The search query
        context_doc_uris: Optional list of specific document URIs to search
        tool_context: ADK tool context with user info
        
    Returns:
        Search results as string
    """
    # Get user_id from tool context
    user_id = None
    if tool_context:
        user_id = tool_context.state.get("user_id")
        if not user_id and hasattr(tool_context, "_invocation_context"):
            user_id = tool_context._invocation_context.session.user_id
    
    if not user_id:
        logger.error("No user_id available for file search")
        return "Unable to search documents: user not identified."
    
    # Get property_id if available
    property_id = None
    if tool_context:
        property_id = tool_context.state.get("property_id")
    
    # Fetch user's Gemini files
    gemini_files = get_user_gemini_files(
        user_id=user_id,
        context_doc_uris=context_doc_uris,
        property_id=property_id,
    )
    
    if not gemini_files:
        logger.info(f"No Gemini files found for user {user_id}")
        if context_doc_uris:
            return f"No uploaded documents found matching: {', '.join(context_doc_uris)}"
        return "No documents have been uploaded yet."
    
    # Search using Gemini
    result = search_with_gemini_files(user_query, gemini_files)
    
    return result


# Create the File Search Agent
file_search_agent = Agent(
    model="gemini-2.5-flash",
    name="ask_file_search_agent",
    instruction=file_search_agent_instruction(),
    input_schema=DocsInput,
    tools=[ask_file_search_retrieval],
    disallow_transfer_to_parent=True,
    output_key="file_search_result",
)

__all__ = ["file_search_agent", "ask_file_search_retrieval", "get_user_gemini_files"]

