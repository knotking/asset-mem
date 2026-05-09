
import os

from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import knowledge_base_instructions
from ...agent_inputs import DocsInput
from ...model_config import GLOBAL_GEMINI_MODEL

load_dotenv()

ask_knowledge_base_retrieval = VertexAiRagRetrieval(
    name='ask_knowledge_base_retrieval',
    description=(
        'Use this tool to retrieve documentation and reference materials for the question from the RAG corpus,'
    ),
    rag_resources=[
        rag.RagResource(
            # please fill in your own rag corpus
            # here is a sample rag corpus for testing purpose
            # e.g. projects/123/locations/us-central1/ragCorpora/456
            rag_corpus=os.environ.get("KNOWLEDGE_BASE_RAG_CORPUS")
        )
    ],
    similarity_top_k=10,
    vector_distance_threshold=0.6,
)

knowledge_base_agent = Agent(
    model=GLOBAL_GEMINI_MODEL,
    name='ask_knowledge_base_agent',
    instruction=knowledge_base_instructions(),
    input_schema=DocsInput,
    tools=[
        ask_knowledge_base_retrieval,
    ],
    disallow_transfer_to_parent=True,
    output_key='knowledge_base_results'
)

__all__ = ["knowledge_base_agent"]