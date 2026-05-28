import os
import json
import time
from typing import Optional, List

from google.cloud.storage.client import Client

from google.adk.agents import Agent

from google.adk.tools import ToolContext
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import user_docs_agent_instruction
import logging
from agent_framework.execution.thread_context import to_thread
from property_agent.shared.inputs import DocsInput
from ...model_config import GLOBAL_GEMINI_MODEL


load_dotenv()

logger = logging.getLogger(__name__)


def get_user_file_ids(
    user_id: str, context_doc_uris: Optional[List[str]] = None
) -> list[str]:
    """
    Fetches FileId values from JSON files in the user's import_results folder in GCS.

    If context_doc_uris is provided and not empty, returns only file IDs matching those URIs.
    If context_doc_uris is None or empty, returns ALL user file IDs (all-docs mode).
    """
    bucket_name = os.environ.get("GOOGLE_CLOUD_BUCKET")
    folder_prefix = (
        f"{os.environ.get('USER_UPLOAD_FOLDER', 'uploads')}/{user_id}/import-results"
    )
    client = Client()
    bucket = client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=folder_prefix)
    file_ids: list[str] = []

    # Determine if we're in all-docs mode (no specific docs selected)
    all_docs_mode = not context_doc_uris or len(context_doc_uris) == 0

    for blob in blobs:
        if blob.name.endswith(".json") or blob.name.endswith(".ndjson"):
            content = blob.download_as_text()
            # For ndjson, each line is a JSON object
            for line in content.splitlines():
                try:
                    obj = json.loads(line)
                    if "FileId" in obj:
                        # In all-docs mode, add all file IDs
                        # In selected-docs mode, only add if filename matches
                        if all_docs_mode:
                            file_ids.append(str(obj["FileId"]))
                        elif "Filename" in obj and obj["Filename"] in context_doc_uris:
                            file_ids.append(str(obj["FileId"]))
                except Exception as e:
                    logger.warning(f"Failed to parse line in {blob.name}: {e}")

    return file_ids


def get_rag_file_ids(
    user_id: str, context_doc_uris: Optional[List[str]] = None
) -> list[str]:
    """
    Fetches the RAG IDs for the user.

    If context_doc_uris is provided, returns only matching file IDs.
    If context_doc_uris is None/empty, returns all user file IDs.
    """
    t0 = time.monotonic()
    file_ids = get_user_file_ids(user_id, context_doc_uris)
    mode = (
        "all documents"
        if not context_doc_uris or len(context_doc_uris) == 0
        else f"{len(context_doc_uris)} selected documents"
    )
    logger.info(
        "user_docs: gcs_file_ids duration_ms=%d count=%d user_id=%s mode=%s",
        int((time.monotonic() - t0) * 1000),
        len(file_ids),
        user_id,
        mode,
    )
    return file_ids


def _ask_user_docs_retreival_sync(
    user_query: str,
    context_doc_uris: Optional[List[str]],
    user_id: str,
):
    """GCS + Vertex RAG retrieval (blocking); runs in a worker thread from ask_user_docs_retreival."""
    rag_file_ids = get_rag_file_ids(user_id, context_doc_uris)

    rag_resources = []
    if rag_file_ids:
        rag_resources.append(
            rag.RagResource(
                rag_corpus=os.environ.get("USER_UPLOAD_RAG_CORPUS"),
                rag_file_ids=rag_file_ids,
            )
        )

    if not rag_resources:
        logger.warning(
            f"No RAG resources (file IDs or context URIs) found for user {user_id}."
        )
        return "No matching result found."

    response = rag.retrieval_query(
        text=user_query,
        rag_resources=rag_resources,
        similarity_top_k=10,
        vector_distance_threshold=0.6,
    )

    return (
        "No matching result found."
        if not response.contexts.contexts
        else [context.text for context in response.contexts.contexts]
    )


async def ask_user_docs_retreival(
    user_query: str,
    context_doc_uris: Optional[List[str]] = None,
    tool_context: ToolContext = None,
):
    user_id = (
        tool_context.state.get("user_id")
        or tool_context._invocation_context.session.user_id
    )
    return await to_thread(
        _ask_user_docs_retreival_sync,
        user_query,
        context_doc_uris,
        user_id,
    )


user_docs_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name="ask_user_docs_agent",
    instruction=user_docs_agent_instruction(),
    input_schema=DocsInput,
    tools=[ask_user_docs_retreival],
    disallow_transfer_to_parent=True,
    output_key="user_docs_result",
)

__all__ = ["user_docs_agent"]
