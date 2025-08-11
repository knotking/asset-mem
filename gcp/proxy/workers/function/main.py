import base64
import json
import os
import requests
from datetime import datetime, timezone

from vertexai import rag
import vertexai

import logging
from google.cloud import pubsub_v1

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
        # Prompt for summary in JSON format
        prompt = (
            "You are an expert homecare document and image classifier. "
            "Given the following file, analyze its content and return a JSON object with: "
            "- title: a short title for the document or image\n"
            "- type: one of ['product_manual', 'warranty', 'insurance', 'appliance_issue', 'plumbing_issue', 'electrical_issue', 'structural_issue', 'hvac_issue', 'other']\n"
            "- summary: a brief summary of the content or what is shown in the image\n"
            "If the file is an image, describe what is shown and classify the type of homecare issue if possible (e.g., appliance, plumbing, electrical, structural, HVAC, etc). "
            "If it is a document, summarize its purpose and classify its type. "
            "If you detect a model number, serial number, or brand of an appliance in the file, mention these details in the summary. "
            "Respond ONLY with a valid JSON object."
        )

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
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_text(text="Analyse the following file and classify its type:"),
                types.Part.from_uri(file_uri=gcs_url, mime_type=mime_type)
            ],
            config=types.GenerateContentConfig(system_instruction=prompt)
        )
        try:
            import re
            raw_text = response.candidates[0].content.parts[0].text
            # Use regex to extract the first JSON object
            match = re.search(r'\{[\s\S]*\}', raw_text)
            if match:
                json_str = match.group(0)
                result_json = pyjson.loads(json_str)
            else:
                raise ValueError("No JSON object found in model output")
            logger.info(f"Classified document {gcs_url} as {result_json}")
            return result_json
        except Exception as parse_e:
            logger.error(f"Failed to parse LLM response as JSON: {parse_e}, raw: {getattr(response.candidates[0].content.parts[0], 'text', str(response))}")
            return {"title": "unknown", "type": "unknown", "summary": "Could not classify"}
    except Exception as e:
        logger.error(f"Failed to classify document type for {gcs_url}: {e}")
        return {"title": "unknown", "type": "unknown", "summary": "Error during classification"}

def import_to_rag_corpus(gcs_urls, user_id:str):
    logger.info(f"Importing files to RAG corpus: {gcs_urls}, corpus: {RAG_CORPUS}")
    try:
        llmParserConfig = rag.LlmParserConfig(
            model_name="gemini-2.5-flash"
        )
        # Classify each document type
        doc_types = {}
        document_urls = []
        for url in gcs_urls:
            doc_info = classify_document_type(url)
            doc_types[url] = doc_info
            # Only import if type is a document (not image)
            # if doc_info["type"] in ["product_manual", "warranty", "insurance", "other"]:
            #     document_urls.append(url)
            document_urls.append(url)  # Always import for now
        result = None
        import_result_sink: str = f"gs://{GCS_BUCKET}/uploads/{user_id}/import-results/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.ndjson"
        logger.info(f"Import result sink: {import_result_sink}")
        if document_urls:
            result = rag.import_files(
                corpus_name=RAG_CORPUS,
                paths=document_urls,
                llm_parser=llmParserConfig,
                import_result_sink=import_result_sink
                
            )
            logger.info(f"Import result: {result}")
            
        else:
            logger.info("No document files to import to RAG corpus.")
      
        logger.info(f"Document types: {doc_types}")
        return True, {"import_result": result, "doc_types": doc_types}
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
    rag_files = list(rag.list_files(corpus_name=RAG_CORPUS))
    logger.info(f"RAG corpus files after import: {rag_files}")

    if success:
        result_str = str(result_msg)
    else:
        result_str = f"Failed to import to RAG corpus: {result_msg}"

    data = {
        "gcs_urls": gcs_urls,
        "user_id": user_id,
        "user_query": user_query,
        # "result": result_str,
        "source": source
    }

    # Publish to Pub/Sub topic
    try:
        publisher = pubsub_v1.PublisherClient()
        future = publisher.publish(topic=USER_UPLOAD_RESULT_TOPIC, data=json.dumps(data).encode("utf-8"))
        logger.info(f"Published result to Pub/Sub topic {USER_UPLOAD_RESULT_TOPIC}: {future.result()}")
    except Exception as e:
        logger.error(f"Failed to publish to Pub/Sub topic: {e}")