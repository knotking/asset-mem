"""
Document analysis — enqueue only.

Publishes to Pub/Sub; a Cloud Function runs Gemini extraction and updates Firestore.
"""

import json
import logging
import os

from google.cloud import pubsub_v1

from schemas.document import ExtractDocInfoRequest

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
DOCUMENT_ANALYSIS_TOPIC = os.environ.get("DOCUMENT_ANALYSIS_TOPIC", "document-analysis-topic")

if not PROJECT_ID:
    logger.warning("GCP_PROJECT_ID not set, document analysis publishing may fail")


def publish_document_analysis(request: ExtractDocInfoRequest) -> str:
    """
    Publish a document extraction job to Pub/Sub.

    Returns the Pub/Sub message id.
    """
    if not PROJECT_ID:
        raise RuntimeError("GCP_PROJECT_ID is not configured")

    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(PROJECT_ID, DOCUMENT_ANALYSIS_TOPIC)

    payload = {
        "docId": request.docId,
        "userId": request.userId,
        "docUrl": request.docUrl,
        "contentType": request.contentType,
        "source": "document-analysis-api",
    }

    data = json.dumps(payload).encode("utf-8")
    future = publisher.publish(topic_path, data)
    message_id = future.result()
    logger.info(
        "Published document analysis topic=%s message_id=%s docId=%s content_type=%s",
        DOCUMENT_ANALYSIS_TOPIC,
        message_id,
        request.docId,
        request.contentType,
    )
    logger.debug(
        "Published document analysis docUrl_len=%s docUrl_scheme=%s",
        len(request.docUrl or ""),
        (request.docUrl.split(":")[0] if request.docUrl else ""),
    )
    return message_id
