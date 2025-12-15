"""
Checkpoint Service

Handles publishing checkpoint analysis requests to Pub/Sub for async processing.
"""

import os
import json
import logging
from google.cloud import pubsub_v1
from schemas.checkpoint import AnalyzeCheckpointRequest

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
CHECKPOINT_ANALYSIS_TOPIC = os.environ.get("CHECKPOINT_ANALYSIS_TOPIC", "checkpoint-analysis-topic")

if not PROJECT_ID:
    logger.warning("GCP_PROJECT_ID not set, checkpoint analysis publishing may fail")

def publish_checkpoint_analysis(request: AnalyzeCheckpointRequest) -> str:
    """
    Publishes a checkpoint analysis request to Pub/Sub for async processing.
    
    Args:
        request: AnalyzeCheckpointRequest with checkpoint details
        
    Returns:
        Message ID from Pub/Sub
    """
    try:
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(PROJECT_ID, CHECKPOINT_ANALYSIS_TOPIC)
        
        payload = {
            "imageUrl": request.imageUrl,
            "contentType": request.contentType,
            "location": request.location,
            "checkpointId": request.checkpointId,
            "userId": request.userId,
            "propertyId": request.propertyId,
            "source": "checkpoint-analysis-api"
        }
        
        data = json.dumps(payload).encode("utf-8")
        future = publisher.publish(topic_path, data)
        message_id = future.result()
        
        logger.info(f"Published checkpoint analysis to {CHECKPOINT_ANALYSIS_TOPIC}: {message_id}")
        return message_id
        
    except Exception as e:
        logger.error(f"Failed to publish checkpoint analysis to Pub/Sub: {e}")
        raise

