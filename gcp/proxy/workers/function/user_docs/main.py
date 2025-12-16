import json
import logging
from datetime import datetime, timezone
from google.cloud import pubsub_v1

from config import Config
from rag_service import RagService
from utils import parse_pubsub_message
from exceptions import WorkerError

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def pubsub_to_user_docs(request, context):
    """Background Cloud Function to be triggered by Pub/Sub."""
    payload = parse_pubsub_message(request)
    
    gcs_urls = payload.get("gcs_urls", [])
    user_id = payload.get("user_id")
    user_query = payload.get("user_query", "")
    source = payload.get("source", "unknown")

    if not user_id or not gcs_urls:
        logger.warning("No user_id or gcs_urls in payload, skipping.")
        return

    logger.info(f"Payload: {gcs_urls}, {user_id}, {user_query}")
    
    success = False
    result_msg = ""
    
    try:
        rag_service = RagService()
        result_msg = rag_service.import_files(gcs_urls, user_id)
        success = True
    except WorkerError as e:
        logger.error(f"Worker Error: {e}")
        result_msg = str(e)
    except Exception as e:
        logger.error(f"Unexpected Error: {e}")
        result_msg = f"Unexpected error: {str(e)}"
    
    logger.info(f"Result: {result_msg}")

    data = {
        "gcs_urls": gcs_urls,
        "user_id": user_id,
        "user_query": user_query,
        "result": result_msg,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "success": success,
        "error": "" if success else str(result_msg),
        "source": source
    }

    _publish_result(data)

def _publish_result(data):
    """Publishes the result to the configured Pub/Sub topic."""
    try:
        if Config.USER_UPLOAD_RESULT_TOPIC:
            publisher = pubsub_v1.PublisherClient()
            future = publisher.publish(topic=Config.USER_UPLOAD_RESULT_TOPIC, data=json.dumps(data).encode("utf-8"))
            logger.info(f"Published result to Pub/Sub topic {Config.USER_UPLOAD_RESULT_TOPIC}: {future.result()}")
        else:
            logger.warning("USER_UPLOAD_RESULT_TOPIC not set, skipping publish.")
    except Exception as e:
        logger.error(f"Failed to publish to Pub/Sub topic: {e}")

