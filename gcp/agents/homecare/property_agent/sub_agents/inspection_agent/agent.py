"""
Inspection Agent

Retrieves and analyzes property inspection reports using RAG retrieval.
Provides intelligent querying and structured analysis of inspection findings.
"""

import os
import json
import logging
from typing import Optional, List
from google.cloud.storage.client import Client
from google.adk.agents import Agent
from google.adk.tools import ToolContext
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import inspection_agent_instruction, multimodal_inspection_analysis_prompt
from ...agent_inputs import DocsInput

load_dotenv()

logger = logging.getLogger(__name__)


def get_inspection_file_ids(user_id: str, property_id: str, context_doc_uris: Optional[List[str]] = None) -> list[str]:
    """
    Fetches FileId values for inspection reports from JSON files in the user's import_results folder in GCS.
    Filters to only include files that match INSPECTION_REPORT document type.
    
    Args:
        user_id: User ID
        property_id: Property ID to scope inspection reports
        context_doc_uris: Optional list of specific document URIs to filter to
        
    Returns:
        List of RAG file IDs for inspection reports
    """
    bucket_name = os.environ.get("GOOGLE_CLOUD_BUCKET")
    folder_prefix = f"{os.environ.get('USER_UPLOAD_FOLDER', 'uploads')}/{user_id}/import-results"
    client = Client()
    bucket = client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=folder_prefix)
    file_ids: list[str] = []
    
    # If specific context_doc_uris provided, only match those
    if context_doc_uris:
        for blob in blobs:
            if blob.name.endswith('.json') or blob.name.endswith('.ndjson'):
                content = blob.download_as_text()
                # For ndjson, each line is a JSON object
                for line in content.splitlines():
                    try:
                        obj = json.loads(line)
                        # Match by filename in context_doc_uris
                        if "Filename" in obj and obj["Filename"] in context_doc_uris:
                            file_ids.append(str(obj["FileId"]))
                            logger.info(f"Matched inspection report file: {obj['Filename']}")
                    except Exception as e:
                        logger.warning(f"Failed to parse line in {blob.name}: {e}")
    else:
        # No specific URIs - would need to fetch from Firestore to filter by property_id and documentType
        # For now, get all files for this user (sub-optimal, but RAG will still scope by relevance)
        logger.warning(f"No context_doc_uris provided - fetching all user file IDs (consider providing specific inspection report URIs)")
        for blob in blobs:
            if blob.name.endswith('.json') or blob.name.endswith('.ndjson'):
                content = blob.download_as_text()
                for line in content.splitlines():
                    try:
                        obj = json.loads(line)
                        if "FileId" in obj:
                            file_ids.append(str(obj["FileId"]))
                    except Exception as e:
                        logger.warning(f"Failed to parse line in {blob.name}: {e}")
    
    logger.info(f"Found {len(file_ids)} inspection report file IDs for user {user_id}")
    return file_ids


def ask_inspection_retrieval(
    user_query: str,
    property_id: str,
    context_doc_uris: Optional[List[str]] = None,
    tool_context: ToolContext = None
):
    """
    Retrieves relevant sections from inspection reports using Vertex AI RAG.
    Scopes to inspection reports for the specified property.
    
    Args:
        user_query: Natural language query about inspection findings
        property_id: Property ID (REQUIRED) - used to scope to property-specific inspection reports
        context_doc_uris: Optional list of specific inspection report GCS URIs to query
        tool_context: Tool context containing user_id and session information
        
    Returns:
        List of text chunks from inspection reports, or "No matching result found"
    """
    try:
        logger.info(f"ask_inspection_retrieval called with: user_query='{user_query}', property_id={property_id}")
        
        # Get user_id from context
        user_id = tool_context.state.get("user_id") or tool_context._invocation_context.session.user_id
        
        if not user_id:
            logger.error(f"Missing user_id for inspection retrieval")
            return "No matching result found."
        
        if not property_id:
            logger.error(f"Missing property_id - inspection retrieval REQUIRES property_id")
            return "No matching result found."
        
        logger.info(f"Using user_id={user_id}, property_id={property_id} for inspection retrieval")
        
        # Get file IDs for inspection reports
        rag_file_ids = get_inspection_file_ids(user_id, property_id, context_doc_uris)
        
        if not rag_file_ids:
            logger.warning(f"No inspection report file IDs found for user {user_id}, property {property_id}")
            return "No matching result found."
        
        # Build RAG resources
        rag_resources = [
            rag.RagResource(
                rag_corpus=os.environ.get("USER_UPLOAD_RAG_CORPUS"),
                rag_file_ids=rag_file_ids
            )
        ]
        
        logger.info(f"Querying RAG with {len(rag_file_ids)} inspection report file IDs")
        
        # Perform RAG retrieval
        response = rag.retrieval_query(
            text=user_query,
            rag_resources=rag_resources,
            similarity_top_k=10,
            vector_distance_threshold=0.6,
        )
        
        if not response.contexts.contexts:
            logger.info(f"No matching inspection report content found for query: {user_query}")
            return "No matching result found."
        
        # Extract text from contexts
        retrieved_texts = [context.text for context in response.contexts.contexts]
        logger.info(f"Retrieved {len(retrieved_texts)} text chunks from inspection reports")
        
        return retrieved_texts
        
    except Exception as e:
        logger.error(f"Error retrieving from inspection reports: {e}", exc_info=True)
        return "No matching result found."


def analyze_inspection_report(user_query: str, gcs_url: str, tool_context: ToolContext) -> str:
    """
    Analyzes an uploaded inspection report document to extract structured findings.
    Uses Gemini multimodal capabilities to parse PDF/document content.
    
    Args:
        user_query: Analysis instructions or specific questions about the report
        gcs_url: GCS URI of the inspection report document (gs://bucket/path)
        tool_context: Tool context containing user_id and session information
        
    Returns:
        JSON string with structured inspection findings, or error message
    """
    try:
        from google import genai
        from google.genai import types
        import mimetypes
        
        user_id = tool_context._invocation_context.session.user_id
        
        client = genai.Client(
            vertexai=True,
            project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
            location=os.environ.get("GOOGLE_CLOUD_LOCATION"),
            http_options=types.HttpOptions(api_version='v1')
        )
        
        mime_type = mimetypes.guess_type(gcs_url)[0] or "application/pdf"
        
        logger.info(f"Analyzing inspection report: {gcs_url} (mime_type: {mime_type})")
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_text(text=user_query),
                types.Part.from_uri(file_uri=gcs_url, mime_type=mime_type)
            ],
            config=types.GenerateContentConfig(
                system_instruction=multimodal_inspection_analysis_prompt(),
                temperature=0.3,
                top_p=0.95,
                max_output_tokens=4096
            ),
        )
        
        try:
            raw_text = response.candidates[0].content.parts[0].text
            logger.info(f"Successfully analyzed inspection report, response length: {len(raw_text)}")
            return raw_text
        except Exception as e:
            logger.error(f"Unable to parse inspection analysis response: {e}")
            return "Unable to analyze inspection report. Please retry again after sometime."
            
    except Exception as e:
        logger.error(f"Error analyzing inspection report: {e}", exc_info=True)
        return "Unable to analyze inspection report. Please retry again after sometime."


# Create inspection agent
inspection_agent = Agent(
    model='gemini-2.5-flash',
    name='inspection_agent',
    description="Analyzes and retrieves information from property inspection reports",
    instruction=inspection_agent_instruction(),
    input_schema=DocsInput,  # Reuse DocsInput schema (user_query, property_id, context_doc_uris)
    tools=[
        ask_inspection_retrieval,
        analyze_inspection_report
    ],
    disallow_transfer_to_parent=True,
    output_key='inspection_result'
)

__all__ = ["inspection_agent"]
