import logging
import base64
import json

logger = logging.getLogger(__name__)

def parse_pubsub_message(request) -> dict:
    """
    Extracts and decodes the JSON payload from a Pub/Sub request.
    Returns an empty dict if decoding fails or no data is present.
    """
    if 'data' not in request:
        return {}
    
    try:
        return json.loads(base64.b64decode(request['data']).decode('utf-8'))
    except Exception as e:
        logger.error(f"Failed to decode payload: {e}")
        return {}

