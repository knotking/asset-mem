"""
Inspection Report Agent

Analyzes property inspection reports and extracts structured information including
issues, severity levels, cost estimates, and actionable recommendations.
"""

import os
import logging
from typing import Optional, List, Dict, Any
from google.adk.agents import Agent
from google.adk.tools import ToolContext
from dotenv import load_dotenv
from .prompts import inspection_report_agent_instruction
from ...agent_inputs import DocsInput

load_dotenv()

logger = logging.getLogger(__name__)


def ask_inspection_reports_retrieval(
    user_query: str,
    context_doc_uris: Optional[List[str]] = None,
    tool_context: ToolContext = None
) -> str:
    """
    Retrieves information from user-uploaded inspection reports using RAG.
    
    This tool searches through inspection reports that have been uploaded to the
    RAG corpus and returns relevant information based on the user's query.
    
    Args:
        user_query: Natural language query about inspection findings (e.g., 
                   "What critical issues were found?" or "Show me roof inspection results")
        context_doc_uris: Optional list of specific inspection report GCS URIs to search
        tool_context: Tool context containing user_id and session information
        
    Returns:
        Formatted text with inspection report findings, or message if no reports found
    """
    try:
        logger.info(f"ask_inspection_reports_retrieval called with query: '{user_query}'")
        logger.info(f"context_doc_uris: {context_doc_uris}")
        
        # Get user_id from context
        user_id = tool_context.state.get("user_id") or tool_context._invocation_context.session.user_id
        logger.info(f"Retrieved user_id from context: {user_id}")
        
        if not user_id:
            logger.error("Missing user_id in tool context")
            return "Error: User ID not found. Please try again."
        
        # Import RAG dependencies
        try:
            from google.cloud import storage
            from vertexai.preview import rag
            import vertexai
        except ImportError as e:
            logger.error(f"Failed to import required libraries: {e}")
            return "Error: System configuration issue. Please contact support."
        
        # Get configuration
        project_id = os.environ.get("GCP_PROJECT_ID")
        location = os.environ.get("GCP_LOCATION", "us-central1")
        rag_corpus = os.environ.get("USER_UPLOAD_RAG_CORPUS")
        gcs_bucket = os.environ.get("GOOGLE_CLOUD_BUCKET")
        user_upload_folder = os.environ.get("USER_UPLOAD_FOLDER", "uploads")
        
        if not all([project_id, rag_corpus, gcs_bucket]):
            logger.error("Missing required environment variables")
            return "Error: System configuration incomplete. Please contact support."
        
        logger.info(f"Using RAG corpus: {rag_corpus}")
        
        # Initialize Vertex AI
        vertexai.init(project=project_id, location=location)
        
        # Get user's file IDs from import results
        file_ids = []
        try:
            storage_client = storage.Client()
            bucket = storage_client.bucket(gcs_bucket)
            
            # Read import result files to get file IDs
            import_results_prefix = f"{user_upload_folder}/{user_id}/import-results/"
            blobs = bucket.list_blobs(prefix=import_results_prefix)
            
            for blob in blobs:
                if blob.name.endswith('.json') or blob.name.endswith('.ndjson'):
                    content = blob.download_as_text()
                    # Parse NDJSON or JSON
                    import json
                    lines = content.strip().split('\n') if blob.name.endswith('.ndjson') else [content]
                    
                    for line in lines:
                        try:
                            data = json.loads(line)
                            # Extract file IDs from import results
                            if isinstance(data, dict):
                                if 'imported_rag_files_count' in data:
                                    # This is a summary object
                                    continue
                                if 'rag_file_chunk_results' in data:
                                    # Extract from chunk results
                                    for chunk_result in data.get('rag_file_chunk_results', []):
                                        file_id = chunk_result.get('rag_file', {}).get('name', '')
                                        if file_id and file_id not in file_ids:
                                            file_ids.append(file_id)
                        except json.JSONDecodeError:
                            continue
            
            logger.info(f"Found {len(file_ids)} file IDs for user {user_id}")
            
            # If context_doc_uris provided, filter file_ids to only those matching
            if context_doc_uris and file_ids:
                # Extract filenames from context_doc_uris
                context_filenames = []
                for uri in context_doc_uris:
                    # Extract filename from GCS URI (gs://bucket/path/to/file.pdf)
                    if '/' in uri:
                        filename = uri.split('/')[-1]
                        context_filenames.append(filename)
                
                if context_filenames:
                    # Filter file_ids to only those that match context documents
                    filtered_file_ids = []
                    for file_id in file_ids:
                        # file_id format: projects/.../locations/.../ragCorpora/.../ragFiles/...
                        # Check if any context filename is in the file_id
                        for filename in context_filenames:
                            if filename in file_id or filename.replace(' ', '_') in file_id:
                                filtered_file_ids.append(file_id)
                                break
                    
                    if filtered_file_ids:
                        file_ids = filtered_file_ids
                        logger.info(f"Filtered to {len(file_ids)} file IDs matching context documents")
        
        except Exception as e:
            logger.warning(f"Error retrieving file IDs: {e}")
            # Continue with query even if we can't filter by file IDs
        
        # Perform RAG retrieval
        try:
            # Build RAG retrieval config
            rag_retrieval_config = rag.RagRetrievalConfig(
                top_k=10,
                filter=rag.Filter(
                    file_ids=file_ids if file_ids else None
                )
            )
            
            # Query the RAG corpus
            response = rag.retrieval_query(
                rag_resources=[
                    rag.RagResource(
                        rag_corpus=rag_corpus,
                    )
                ],
                text=user_query,
                rag_retrieval_config=rag_retrieval_config
            )
            
            # Extract relevant contexts from response
            contexts = []
            if hasattr(response, 'contexts') and response.contexts:
                for context in response.contexts.contexts:
                    if hasattr(context, 'text') and context.text:
                        contexts.append(context.text)
            
            logger.info(f"Retrieved {len(contexts)} context chunks from RAG")
            
            if not contexts:
                return (
                    "No relevant information found in your uploaded inspection reports. "
                    "This could mean:\n"
                    "1. No inspection reports have been uploaded yet\n"
                    "2. The uploaded reports don't contain information about this topic\n"
                    "3. Please try rephrasing your question\n\n"
                    "To upload an inspection report, go to Property Documents and select "
                    "'Inspection Report' as the document type."
                )
            
            # Format the contexts for the agent
            formatted_response = "### Inspection Report Findings\n\n"
            formatted_response += f"Based on your uploaded inspection reports, here's what I found:\n\n"
            
            for i, context_text in enumerate(contexts[:5], 1):  # Limit to top 5 most relevant
                formatted_response += f"**Finding {i}:**\n{context_text}\n\n"
            
            formatted_response += "\n---\n\n"
            formatted_response += "Use the information above to answer the user's query and provide structured analysis."
            
            return formatted_response
            
        except Exception as e:
            logger.error(f"Error during RAG retrieval: {e}", exc_info=True)
            return f"Error retrieving inspection report data: {str(e)}"
        
    except Exception as e:
        logger.error(f"Error in ask_inspection_reports_retrieval: {e}", exc_info=True)
        return f"An error occurred while searching inspection reports: {str(e)}"


# Create the inspection report agent
inspection_report_agent = Agent(
    model='gemini-2.5-flash',
    name='inspection_report_agent',
    instruction=inspection_report_agent_instruction(),
    input_schema=DocsInput,  # Reuse DocsInput schema (user_query, context_doc_uris, etc.)
    tools=[
        ask_inspection_reports_retrieval
    ],
    disallow_transfer_to_parent=True,
    output_key='inspection_report_result'
)

__all__ = ["inspection_report_agent"]
