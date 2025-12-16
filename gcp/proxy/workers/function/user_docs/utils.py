import logging
import base64
import json

logger = logging.getLogger(__name__)

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

