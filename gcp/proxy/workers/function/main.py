import base64
import json
import os
from google.cloud.aiplatform_v1.types.vertex_rag_data_service import ImportRagFilesResponse
import requests
from datetime import datetime, timezone

from vertexai import rag
import vertexai

import logging
from google.cloud import pubsub_v1
from prompts import parsing_prompt_media
# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RAG_CORPUS = os.environ.get("RAG_CORPUS")
USER_UPLOAD_RESULT_TOPIC = os.environ.get("USER_UPLOAD_RESULT_TOPIC")  # Set your topic name in env
PROJECT = os.environ.get("GCP_PROJECT_ID")
LOCATION = os.environ.get("GCP_REGION", "us-central1")
GCS_BUCKET = os.environ.get("GCS_BUCKET")


def serialize_import_result(result):
    """Convert ImportRagFilesResponse or similar objects to a serializable dict."""
    if result is None:
        return {}
    if hasattr(result, "to_dict"):
        return result.to_dict()
    # Fallback: try to convert to string
    return str(result)

def is_media_mime_type(mime_type: str) -> bool:
    """
    Returns True if the MIME type is media (image, audio, or video), else False.
    """
    if not mime_type:
        return False
    return any(mime_type.startswith(prefix) for prefix in ("image/", "audio/", "video/"))

def import_to_rag_corpus(gcs_urls, user_id:str):
    logger.info(f"Importing files to RAG corpus: {gcs_urls}, corpus: {RAG_CORPUS}")
    try:
        import mimetypes
        llmParserConfig = rag.LlmParserConfig(
            model_name="gemini-2.5-flash",
        )

        documents_list = []
        media_list = [] 
        documents_result: ImportRagFilesResponse = None
        media_result: ImportRagFilesResponse = None    
        
        for gcs_url in gcs_urls:
            mime_type,_ = mimetypes.guess_type(gcs_url)
            if is_media_mime_type(mime_type):
                media_list.append(gcs_url)
            else:
                documents_list.append(gcs_url)

        logger.info(f"Document files: {documents_list}")
        logger.info(f"Media files: {media_list}")
        sink_path = f"gs://{GCS_BUCKET}/uploads/{user_id}/import-results/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        # Import documents to RAG corpus
        if documents_list:
            documents_result:ImportRagFilesResponse = rag.import_files(
                corpus_name=RAG_CORPUS,
                paths=documents_list,
                llm_parser=llmParserConfig,
                import_result_sink=f"{sink_path}-documents.ndjson"
            )

        # Import other documents to RAG corpus
        if media_list:
            llmParserConfig.custom_parsing_prompt = parsing_prompt_media()
            media_result = rag.import_files(
                corpus_name=RAG_CORPUS,
                paths=media_list,
                llm_parser=llmParserConfig,
                import_result_sink=f"{sink_path}-media.ndjson"
            )
        logger.info(f"Document Results: {documents_result}, Media Results: {media_result}")

        return True, {
            "document_import_result": serialize_import_result(documents_result),
            "media_import_result": serialize_import_result(media_result)
        }
    except Exception as e:
        logger.error(f"Failed to import to RAG corpus: {e}")
        return False, str(e)


def pubsub_to_user_uploads(request, context):
    """Background Cloud Function to be triggered by Pub/Sub."""
    if 'data' in request:
        payload = json.loads(base64.b64decode(request['data']).decode('utf-8'))
    else:
        payload = {}

    gcs_urls = payload.get("gcs_urls", [])
    user_id = payload.get("user_id")
    user_query = payload.get("user_query", "")
    source = payload.get("source", "unknown")

    if not user_id or not gcs_urls:
        logger.warning("No user_id or gcs_urls in payload, skipping.")
        return

    logger.info(f"Payload: {gcs_urls}, {user_id}, {user_query}")
    # Import to Vertex AI RAG corpus
    success, result_msg = import_to_rag_corpus(gcs_urls, user_id)
    # rag_files = list(rag.list_files(corpus_name=RAG_CORPUS))
    # logger.info(f"RAG corpus files after import: {rag_files}")
    logger.info(f"Result: {result_msg}")

    data   = {
        "gcs_urls": gcs_urls,
        "user_id": user_id,
        "user_query": user_query,
        "result": result_msg,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "success": success,
        "error": "" if success else result_msg,
        "source": source
    }

    # Publish to Pub/Sub topic
    try:
        publisher = pubsub_v1.PublisherClient()
        future = publisher.publish(topic=USER_UPLOAD_RESULT_TOPIC, data=json.dumps(data).encode("utf-8"))
        logger.info(f"Published result to Pub/Sub topic {USER_UPLOAD_RESULT_TOPIC}: {future.result()}")
    except Exception as e:
        logger.error(f"Failed to publish to Pub/Sub topic: {e}")

