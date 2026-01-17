"""
Inspection Report Agent

Retrieves and analyzes inspection reports from the user's RAG corpus using
semantic search, then synthesizes structured findings, recommendations, and
issue summaries.
"""

import os
import logging
from typing import Optional, List, Union

from google.adk.agents import Agent
from google.adk.tools import ToolContext
from vertexai.preview import rag
from dotenv import load_dotenv

from .prompts import inspection_report_agent_instruction
from ...agent_inputs import DocsInput

# Reuse RAG file ID resolution from user_docs_agent
from ..user_docs_agent.agent import get_rag_file_ids

load_dotenv()
logger = logging.getLogger(__name__)


def ask_inspection_reports_retrieval(
    user_query: str,
    context_doc_uris: Optional[List[str]] = None,
    tool_context: Optional[ToolContext] = None,
) -> Union[str, List[str]]:
    """
    Retrieves relevant chunks from inspection reports in the RAG corpus.

    Uses context_doc_uris (gs:// URIs of selected inspection reports) to
    resolve RAG file IDs and perform a semantic search. Returns raw chunks
    for the agent to synthesize into structured analysis.

    Args:
        user_query: Natural language question about the inspection reports.
        context_doc_uris: GCS URIs of the inspection reports to search.
        tool_context: ADK tool context with user_id.

    Returns:
        List of text chunks from RAG, or "No matching result found." if none.
    """
    try:
        user_id = (
            (tool_context and tool_context.state.get("user_id"))
            or (tool_context and getattr(tool_context._invocation_context.session, "user_id", None))
            or ""
        )
        if not user_id:
            logger.warning("ask_inspection_reports_retrieval: missing user_id in tool_context")
            return "No matching result found."

        if not context_doc_uris:
            logger.warning("ask_inspection_reports_retrieval: context_doc_uris is required")
            return "No inspection reports were provided. Please select inspection reports to analyze."

        rag_file_ids = get_rag_file_ids(user_id, context_doc_uris)
        logger.info(f"ask_inspection_reports_retrieval: user_id={user_id}, uris={len(context_doc_uris or [])}, file_ids={len(rag_file_ids)}")

        rag_corpus = os.environ.get("USER_UPLOAD_RAG_CORPUS")
        if not rag_corpus:
            logger.error("USER_UPLOAD_RAG_CORPUS not set")
            return "No matching result found."

        rag_resources = []
        if rag_file_ids:
            rag_resources.append(
                rag.RagResource(rag_corpus=rag_corpus, rag_file_ids=rag_file_ids)
            )

        if not rag_resources:
            logger.warning(
                f"No RAG resources for user {user_id} and context_doc_uris={bool(context_doc_uris)}"
            )
            return "No matching result found in the selected inspection reports. Ensure the reports are uploaded and indexed."

        response = rag.retrieval_query(
            text=user_query,
            rag_resources=rag_resources,
            similarity_top_k=15,
            vector_distance_threshold=0.65,
        )

        if not response.contexts.contexts:
            return "No matching result found."

        return [ctx.text for ctx in response.contexts.contexts]
    except Exception as e:
        logger.error(f"ask_inspection_reports_retrieval failed: {e}", exc_info=True)
        return "An error occurred while searching the inspection reports. Please try again."


inspection_report_agent = Agent(
    model="gemini-2.5-flash",
    name="inspection_report_agent",
    instruction=inspection_report_agent_instruction(),
    input_schema=DocsInput,
    tools=[ask_inspection_reports_retrieval],
    disallow_transfer_to_parent=True,
    output_key="inspection_report_result",
)

__all__ = ["inspection_report_agent", "ask_inspection_reports_retrieval"]
