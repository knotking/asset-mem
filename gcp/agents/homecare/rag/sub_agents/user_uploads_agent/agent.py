import os

from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import return_instructions_root


load_dotenv()


def ask_user_uploads_retreival(rag_file_ids=[]):
    print("Using rag files:", rag_file_ids)
    return VertexAiRagRetrieval(
        name='retrieve_rag_documentation',
        description=(
            'Use this tool to retrieve documentation and reference materials for the question from the RAG corpus,'
        ),
        rag_resources=[
        rag.RagResource(
            rag_corpus=os.environ.get("USER_UPLOADS_RAG_CORPUS"),
            rag_file_ids=rag_file_ids
        )
    ],
    similarity_top_k=10,
    vector_distance_threshold=0.6,
    )


user_uploads_agent = Agent(
    model='gemini-2.5-flash',
    name='ask_user_uploads_agent',
    instruction=return_instructions_root(),
    tools=[
        ask_user_uploads_retreival()
    ]
)

__all__ = ["user_uploads_agent"]