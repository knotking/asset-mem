import logging
import base64
import json

logger = logging.getLogger(__name__)

_RAG_COUNT_FIELDS = (
    ("imported_rag_files_count", "importedRagFilesCount"),
    ("failed_rag_files_count", "failedRagFilesCount"),
    ("skipped_rag_files_count", "skippedRagFilesCount"),
)


def _read_rag_count(source, snake_key: str, camel_key: str) -> int:
    for key in (snake_key, camel_key):
        value = None
        if isinstance(source, dict):
            value = source.get(key)
        else:
            value = getattr(source, key, None)
        if value is None or value == "":
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue
    return 0


def normalize_import_result_counts(result) -> dict[str, int]:
    """Read Vertex ImportRagFilesResponse counts into stable snake_case keys."""
    if result is None:
        return {}
    return {
        snake: _read_rag_count(result, snake, camel)
        for snake, camel in _RAG_COUNT_FIELDS
    }


def serialize_import_result(result):
    """Convert ImportRagFilesResponse or similar objects to a serializable dict."""
    if result is None:
        return {}

    normalized = normalize_import_result_counts(result)
    if any(normalized.values()):
        return normalized

    if hasattr(result, "to_dict"):
        raw = result.to_dict()
        if isinstance(raw, dict):
            normalized = normalize_import_result_counts(raw)
            if any(normalized.values()):
                return normalized

    return normalized

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

