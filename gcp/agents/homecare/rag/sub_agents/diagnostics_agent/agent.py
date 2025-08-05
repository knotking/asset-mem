
import os
import uuid
import json
from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from vertexai.preview import rag
from dotenv import load_dotenv
from .prompts import return_instructions_root
from vertexai.language_models import TextEmbeddingModel

load_dotenv()

# Tool to store extracted text into AlloyDB as part of the RAG corpus
from google.cloud import alloydbconn
import psycopg2
from pgvector.psycopg2 import register_vector

connector = alloydbconn.create_connector()
# Example AlloyDB config from environment variables
# alloydb_config = {
#     "host": os.environ.get("ALLOYDB_HOST"),
#     "port": os.environ.get("ALLOYDB_PORT", 5432),
#     "user": os.environ.get("ALLOYDB_USER"),
#     "password": os.environ.get("ALLOYDB_PASSWORD"),
#     "dbname": os.environ.get("ALLOYDB_DBNAME", "rag")
# }
embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-004")

def store_extracted_info(user_id: str, extracted_text: str, source_uri: str, metadata: dict = None):
    """Store extracted text and metadata into AlloyDB rag_corpus table."""
    try:
        # Create embedding for the extracted text
        embeddings = embedding_model.embed_texts(texts=[extracted_text])
        embedding_vector = embeddings[0].values

        # Connect to AlloyDB
        conn = connector.connect(
            "projects/YOUR_PROJECT_ID/locations/YOUR_REGION/clusters/YOUR_CLUSTER/instances/YOUR_INSTANCE",
            "YOUR_DB_USER",
            "YOUR_DB_PASSWORD",
            "YOUR_DATABASE_NAME",
        )
        register_vector(conn)
        cursor = conn.cursor()

        # Prepare the metadata (store as JSONB for flexibility)
        full_metadata = {
            "user_id": user_id,
            "source_uri": source_uri,
            "extracted_text": extracted_text,
            **(metadata or {})
        }

        # Insert into your table (ensure you've created a table with a vector column)
        cursor.execute(
            "INSERT INTO user_embeddings (id, embedding, metadata) VALUES (%s, %s, %s)",
            (str(uuid.uuid4()), embedding_vector, json.dumps(full_metadata))
        )
        conn.commit()

        cursor.close()
        conn.close()
        print(f"Successfully stored info for user {user_id}: {extracted_text}")
        return {"status": "success", "message": "Information stored successfully."}
    except Exception as e:
        print(f"Error storing information: {e}")
        return {"status": "error", "message": str(e)}




diagnostic_agent = Agent(
    model='gemini-2.5-flash',
    name='diagnostic_agent',
    instruction=return_instructions_root(),
    tools=[
        store_extracted_info
    ]
)

__all__ = ["diagnostic_agent"]