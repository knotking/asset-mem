import base64
import json
import os
import requests
from datetime import datetime, timezone

from vertexai import rag
import vertexai

import logging
from google.cloud import pubsub_v1
from .prompts import document_classification_prompt, parsing_prompt_other
# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RAG_CORPUS = os.environ.get("RAG_CORPUS")
USER_UPLOAD_RESULT_TOPIC = os.environ.get("USER_UPLOAD_RESULT_TOPIC")  # Set your topic name in env
PROJECT = os.environ.get("GCP_PROJECT_ID")
LOCATION = os.environ.get("GCP_REGION", "us-central1")
GCS_BUCKET = os.environ.get("GCS_BUCKET")

def get_gcs_file_mime_type(gcs_url):
    """
    Guess the MIME type of a file based on its GCS URL.
    """
    import mimetypes
    mime_type, _ = mimetypes.guess_type(gcs_url)
    if not mime_type:
        ext = os.path.splitext(gcs_url)[1].lower()
        if ext in [".jpg", ".jpeg"]:
            return "image/jpeg"
        elif ext == ".png":
            return "image/png"
        elif ext == ".pdf":
            return "application/pdf"
        else:
            return "application/octet-stream"

def classify_document_type(gcs_url):
    """
    Use LLM to classify the type of document uploaded.
    Returns one of: 'product_manual', 'issue_image', 'warranty', 'insurance', or 'unknown'.
    """
    try:
       
        # Multimodal LLM: pass file path (image, pdf, text, etc.) directly to the model
        
        

        # Use google.genai with Vertex AI API configuration
        from google import genai
        from google.genai import types
        import json as pyjson

     
        client = genai.Client(
            vertexai=True,
            project=PROJECT,
            location=LOCATION,
            http_options=types.HttpOptions(api_version='v1')
        )
 
        mime_type=get_gcs_file_mime_type(gcs_url)

        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[
                types.Part.from_text(text="Analyse the following file and classify its type:"),
                types.Part.from_uri(file_uri=gcs_url, mime_type=mime_type)
            ],
            config=types.GenerateContentConfig(system_instruction=document_classification_prompt()),
        )
        try:

            raw_text = response.candidates[0].content.parts[0].text
            logger.info(f"Raw response text: {raw_text}")
            return raw_text 
        except Exception as e:

            logger.error(f"Failed to parse response: {e}")
    except Exception as e:
        logger.error(f"Error classifying document type: {e}")
        return "unknown"

def import_to_rag_corpus(gcs_urls, user_id:str):
    logger.info(f"Importing files to RAG corpus: {gcs_urls}, corpus: {RAG_CORPUS}")
    try:

        llmParserConfig = rag.LlmParserConfig(
            model_name="gemini-2.5-flash",
        )

        manual_docs = []
        other_docs = [] 
        for gcs_url in gcs_urls:
            doc_type = classify_document_type(gcs_url)
            if doc_type == "product_manual":
                manual_docs.append(gcs_url)
            else: 
                other_docs.append(gcs_url)


        logger.info(f"Manual documents: {manual_docs}")
        logger.info(f"Other documents: {other_docs}")


        # Import product manuals to RAG corpus
        if manual_docs:
            manual_docs_result =rag.import_files(
                corpus_name=RAG_CORPUS,
                paths=manual_docs,
                llm_parser=llmParserConfig,
                import_result_sink=f"gs://{GCS_BUCKET}/uploads/{user_id}/import-results/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}manuals.ndjson"
            )

        # Import other documents to RAG corpus
        if other_docs:
            llmParserConfig.custom_parsing_prompt = parsing_prompt_other()
            other_docs_result = rag.import_files(
                corpus_name=RAG_CORPUS,
                paths=other_docs,
                llm_parser=llmParserConfig,
                import_result_sink=f"gs://{GCS_BUCKET}/uploads/{user_id}/import-results/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}other.ndjson"
                )
        


        return True, {"import_result": manual_docs_result, "other_import_result": other_docs_result}
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