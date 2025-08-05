import os

from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import return_instructions_root
from vertexai.language_models import TextEmbeddingModel


load_dotenv()
embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-004")
def retrieve_similar_info(user_id: str, query: str):
    """
    Retrieves similar embeddings from AlloyDB for a specific user.
    """
    try:
        query_embedding = embedding_model.embed_texts(texts=[query])[0].values
        
        conn = ... # Connect to AlloyDB as before
        cursor = conn.cursor()
        
        # This is where the power of AlloyDB shines
        cursor.execute(
            """
            SELECT metadata FROM user_embeddings
            WHERE (metadata->>'user_id') = %s
            ORDER BY embedding <-> %s
            LIMIT 5
            """,
            (user_id, query_embedding)
        )
        results = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return results

    except Exception as e:
        return []

ask_user_uploads_retreival = VertexAiRagRetrieval(
    name='retrieve_rag_documentation',
    description=(
        'Use this tool to retrieve documentation and reference materials for the question from the RAG corpus,'
    ),
    rag_resources=[
        rag.RagResource(
            rag_corpus=os.environ.get("USER_UPLOADS_RAG_CORPUS"),
            rag_files_id=[]
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
        retrieve_similar_info,
        ask_user_uploads_retreival
    ]
)

__all__ = ["user_uploads_agent"]