import os
import random
import json
from typing import Optional, List
from pydantic import Field


from google.cloud.storage.client import Client

from google.adk.agents import Agent

from google.adk.tools import ToolContext
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import user_docs_agent_instruction
import logging
from ...agent_inputs import DocsInput
    

load_dotenv()

logger: logging.Logger = logging.getLogger("__name__")

def get_user_file_ids(user_id: str, context_doc_uris: Optional[List[str]] = None ) -> list[str]:
    """
    Fetches all FileId values from JSON files in the user's import_results folder in GCS.
    """
    bucket_name = os.environ.get("GOOGLE_CLOUD_BUCKET")
    folder_prefix = f"{os.environ.get('USER_UPLOAD_FOLDER', 'uploads')}/{user_id}/import-results"
    client = Client()
    bucket = client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=folder_prefix)
    file_ids: list[str] = []
    

    for blob in blobs:
        if blob.name.endswith('.json') or blob.name.endswith('.ndjson'):
            content = blob.download_as_text()
            # For ndjson, each line is a JSON object
            for line in content.splitlines():
                try:
                    obj = json.loads(line)
                    if "Filename" in obj and obj["Filename"] in context_doc_uris:
                        file_ids.append(str(obj["FileId"]))
                except Exception as e:
                    logger.warning(f"Failed to parse line in {blob.name}: {e}")

    
    return file_ids

def get_rag_file_ids(user_id: str, context_doc_uris: Optional[List[str]] = None) -> list[str]:
    """
    Fetches the RAG IDs for the user from the environment variable.
    """
    file_ids = get_user_file_ids(user_id, context_doc_uris)
    logger.warning(f"Fetched {len(file_ids)} file IDs for user {user_id} from GCS.")
    return file_ids

def ask_user_docs_retreival( user_query: str, context_doc_uris: Optional[List[str]] = None, tool_context: ToolContext = None):

    
    user_id = tool_context.state.get("user_id") or tool_context._invocation_context.session.user_id
    
    rag_file_ids = get_rag_file_ids(user_id, context_doc_uris)
    
    rag_resources = []
    if rag_file_ids:
        rag_resources.append(rag.RagResource(rag_corpus=os.environ.get("USER_UPLOAD_RAG_CORPUS"), rag_file_ids=rag_file_ids))
    
    if not rag_resources:
        logger.warning(f"No RAG resources (file IDs or context URIs) found for user {user_id}.")
        return "No matching result found."
    
    response = rag.retrieval_query(
        text=user_query,
        rag_resources=rag_resources,
        similarity_top_k=10,
        vector_distance_threshold=0.6,
    )

    return (
        f'No matching result found.'
        if not response.contexts.contexts
        else [context.text for context in response.contexts.contexts]
    )

user_docs_agent = Agent(
    model='gemini-2.5-flash',
    name='ask_user_docs_agent',
    instruction=user_docs_agent_instruction(),
    input_schema=DocsInput,
    tools=[
        ask_user_docs_retreival
    ],
    disallow_transfer_to_parent=True,
    output_key='user_docs_result'

)

__all__ = ["user_docs_agent"]