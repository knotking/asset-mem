import base64
import json
import os
import requests
import vertexai
from vertexai import rag
import logging

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TELEGRAM_BOT_WEBHOOK_URL = os.environ.get("TELEGRAM_API_WEBHOOK_URL")  # e.g. https://your.domain.com/processing_complete
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET")  # Optional: for securing the endpoint
RAG_CORPUS = os.environ.get("RAG_CORPUS")

def import_to_rag_corpus(gcs_urls):
    logger.info(f"Importing files to RAG corpus: {gcs_urls}, corpus: {RAG_CORPUS}")
    try:
        llmParserConfig = rag.LlmParserConfig(
            model_name="gemini-2.5-flash"
        )
        result = rag.import_files(
                corpus_name=RAG_CORPUS,
                paths=gcs_urls,
                llm_parser=llmParserConfig
            )
        logger.info(f"Import result: {result}")
        return True, result
    except Exception as e:
        logger.error(f"Failed to import to RAG corpus: {e}")
        return False, str(e)


def pubsub_to_telegram(request, context):
    """Background Cloud Function to be triggered by Pub/Sub."""
    if 'data' in request:
        payload = json.loads(base64.b64decode(request['data']).decode('utf-8'))
    else:
        payload = {}

    gcs_urls = payload.get("gcs_urls", [])
    user_id = payload.get("user_id")
    user_query = payload.get("user_query", "")

    if not user_id or not gcs_urls:
        logger.warning("No user_id or gcs_urls in payload, skipping.")
        return

    logger.info(f"Payload: {gcs_urls}, {user_id}, {user_query}")
    # Import to Vertex AI RAG corpus
    success, result_msg = import_to_rag_corpus(gcs_urls)

    # Prepare POST to Telegram bot webhook
    headers = {"Content-Type": "application/json"}
    if WEBHOOK_SECRET:
        headers["X-Webhook-Secret"] = WEBHOOK_SECRET

    if success:
        result_str = str(result_msg)
    else:
        result_str = f"Failed to import to RAG corpus: {result_msg}"

    data = {
        "gcs_urls": gcs_urls,
        "user_id": user_id,
        "user_query": user_query,
        "result": result_str
    }

    try:
        resp = requests.post(TELEGRAM_BOT_WEBHOOK_URL, headers=headers, json=data, timeout=10)
        logger.info(f"POST to Telegram bot returned {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"Failed to POST to Telegram bot: {e}")