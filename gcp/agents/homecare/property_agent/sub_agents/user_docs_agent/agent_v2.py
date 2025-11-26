"""
User Docs Agent v2 - Using Shared File Search Library

This version uses the shared file search abstraction, allowing it to work with
both Vertex AI RAG and Gemini File Search backends.
"""

import os
import sys
import logging
from typing import Optional, List

from pydantic import Field
from google.adk.agents import Agent
from google.adk.tools import ToolContext
from dotenv import load_dotenv

from .prompts import user_docs_agent_instruction
from ...agent_inputs import DocsInput

# Add path to shared library
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../../../.."))

from shared.file_search import get_file_search_manager, VertexAIRAGBackend

load_dotenv()

logger: logging.Logger = logging.getLogger("user_docs_agent")


def ask_user_docs_retrieval_v2(
    user_query: str,
    context_doc_uris: Optional[List[str]] = None,
    tool_context: ToolContext = None
):
    """
    Retrieves relevant information from user documents using the shared file search library.
    
    This version uses the abstraction layer, which allows for easy switching between
    Vertex AI RAG and Gemini File Search backends.
    
    Args:
        user_query: The user's search query
        context_doc_uris: Optional list of specific document URIs to search
        tool_context: Tool execution context
        
    Returns:
        Retrieved context text or "No matching result found."
    """
    try:
        # Get user ID from context
        user_id = tool_context.state.get("user_id") or tool_context._invocation_context.session.user_id
        
        # Initialize the file search backend (Vertex AI RAG)
        backend = get_file_search_manager(
            backend="vertex",
            project_id=os.environ.get("GCP_PROJECT_ID"),
            location=os.environ.get("GCP_LOCATION", "us-central1"),
            corpus_name=os.environ.get("USER_UPLOAD_RAG_CORPUS"),
            gcs_bucket=os.environ.get("GOOGLE_CLOUD_BUCKET"),
            use_genai=False  # Use native Vertex AI RAG for retrieval
        )
        
        # Get file IDs for the user
        if isinstance(backend, VertexAIRAGBackend):
            file_ids = backend.get_user_file_ids(user_id, context_doc_uris)
        else:
            file_ids = []
        
        if not file_ids:
            logger.info(f"No file IDs found for user {user_id}")
            return "No matching result found."
        
        # Get the corpus name
        corpus_name = backend.get_user_store_name(user_id)
        if not corpus_name:
            logger.warning(f"No corpus found for user {user_id}")
            return "No matching result found."
        
        # Query the documents
        result = backend.query(
            query=user_query,
            store_names=[corpus_name],
            file_ids=file_ids,
            similarity_top_k=10,
            vector_distance_threshold=0.6,
        )
        
        # Return the result
        if result.text == "No matching result found.":
            return "No matching result found."
        
        # For Vertex AI RAG, the result contains the raw retrieved chunks
        # Format them for the agent
        if result.grounding_chunks:
            return [chunk.chunk_text for chunk in result.grounding_chunks if chunk.chunk_text]
        else:
            return result.text
        
    except Exception as e:
        logger.error(f"Error in user docs retrieval: {e}", exc_info=True)
        return "No matching result found."


# Agent using the new retrieval function
user_docs_agent_v2 = Agent(
    model='gemini-2.5-flash',
    name='ask_user_docs_agent_v2',
    instruction=user_docs_agent_instruction(),
    input_schema=DocsInput,
    tools=[
        ask_user_docs_retrieval_v2
    ],
    disallow_transfer_to_parent=True,
    output_key='user_docs_result'
)

__all__ = ["user_docs_agent_v2", "ask_user_docs_retrieval_v2"]

