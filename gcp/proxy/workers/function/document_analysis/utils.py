import base64
import json
import logging

logger = logging.getLogger(__name__)


def parse_pubsub_message(request) -> dict:
    """Decode JSON payload from a Pub/Sub push request."""
    if "data" not in request:
        return {}
    try:
        return json.loads(base64.b64decode(request["data"]).decode("utf-8"))
    except Exception as e:
        logger.error("Failed to decode Pub/Sub payload: %s", e)
        return {}
