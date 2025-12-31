"""Utility functions for Pub/Sub message parsing."""

import base64
import json
import logging

logger = logging.getLogger(__name__)


def parse_pubsub_message(request):
    """
    Parse Pub/Sub message from Cloud Function request.
    
    Args:
        request: Cloud Function request object
    
    Returns:
        dict: Parsed message payload
    """
    try:
        envelope = request.get_json()
        if not envelope:
            logger.error("No Pub/Sub message found in request")
            return {}
        
        if "message" not in envelope:
            logger.error("Invalid Pub/Sub message format")
            return {}
        
        pubsub_message = envelope["message"]
        
        if "data" not in pubsub_message:
            logger.error("No data found in Pub/Sub message")
            return {}
        
        # Decode base64 message
        message_data = base64.b64decode(pubsub_message["data"]).decode("utf-8")
        payload = json.loads(message_data)
        
        logger.info(f"Parsed Pub/Sub message: {payload}")
        return payload
        
    except Exception as e:
        logger.error(f"Error parsing Pub/Sub message: {e}", exc_info=True)
        return {}

