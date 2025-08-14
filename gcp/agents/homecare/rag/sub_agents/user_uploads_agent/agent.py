import os
import random
import json

from google.cloud.storage.bucket import Bucket
from google.cloud.storage.client import Client

from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from google.adk.tools import ToolContext
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import return_instructions_root, return_instructions_user_uploads
import logging
    

load_dotenv()

logger: logging.Logger = logging.getLogger("user_uploads_agent")

def get_user_file_ids(user_id: str) -> list[str]:
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
                    if "FileId" in obj:
                        file_ids.append(str(obj["FileId"]))
                except Exception as e:
                    logger.warning(f"Failed to parse line in {blob.name}: {e}")

    return file_ids

def get_rag_file_ids(user_id: str) -> list[str]:
    """
    Fetches the RAG IDs for the user from the environment variable.
    """
    file_ids = get_user_file_ids(user_id)
    logger.info(f"Fetched {len(file_ids)} file IDs for user {user_id} from GCS.")
    return file_ids

def ask_user_uploads_retreival( user_query: str, tool_context: ToolContext):

    
    user_id = tool_context.state.get("user_id") or tool_context._invocation_context.session.user_id
    
    rag_file_ids = get_rag_file_ids(user_id)
    if not rag_file_ids:
        logger.info(f"No RAG file IDs found for user {user_id}.")
        return "No relevant documents found."
    response = rag.retrieval_query(
        text=user_query,
        rag_resources=[
            rag.RagResource(
                rag_corpus=os.environ.get("USER_UPLOAD_RAG_CORPUS"),

            )
        ],
        similarity_top_k=10,
        vector_distance_threshold=0.6,
    )

    logging.debug('RAG raw response: %s', response)

    return (
        f'No matching result found.'
        if not response.contexts.contexts
        else [context.text for context in response.contexts.contexts]
    )

user_uploads_agent = Agent(
    model='gemini-2.5-flash',
    name='ask_user_uploads_agent',
    instruction=return_instructions_root(),
    tools=[
        ask_user_uploads_retreival
    ]
)

__all__ = ["user_uploads_agent"]