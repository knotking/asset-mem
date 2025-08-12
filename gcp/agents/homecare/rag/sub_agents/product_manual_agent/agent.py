
import os

from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import return_instructions_root

load_dotenv()

ask_product_manual_retreival = VertexAiRagRetrieval(
    name='retrieve_rag_documentation',
    description=(
        'Use this tool to retrieve documentation and reference materials for the question from the RAG corpus,'
    ),
    rag_resources=[
        rag.RagResource(
            # please fill in your own rag corpus
            # here is a sample rag corpus for testing purpose
            # e.g. projects/123/locations/us-central1/ragCorpora/456
            rag_corpus=os.environ.get("PRODUCT_MANUAL_RAG_CORPUS")
        )
    ],
    similarity_top_k=10,
    vector_distance_threshold=0.6,
)

product_manual_agent = Agent(
    model='gemini-2.5-flash',
    name='product_manual_agent',
    instruction=return_instructions_root(),
    tools=[
        ask_product_manual_retreival,
    ],
    disallow_transfer_to_parent=True
)

__all__ = ["product_manual_agent"]