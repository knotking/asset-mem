import os
import logging

logger = logging.getLogger(__name__)

def parse_location_from_corpus(corpus_path: str) -> str:
    """Extract location from RAG corpus path."""
    if not corpus_path:
        return "us-central1"  # default fallback
    try:
        parts = corpus_path.split("/")
        location_idx = parts.index("locations") + 1
        return parts[location_idx]
    except (ValueError, IndexError):
        logger.warning(f"Could not parse location from RAG_CORPUS: {corpus_path}, using default")
        return "us-central1"

class Config:
    RAG_CORPUS = os.environ.get("RAG_CORPUS")
    USER_UPLOAD_RESULT_TOPIC = os.environ.get("USER_UPLOAD_RESULT_TOPIC")
    PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
    GCS_BUCKET = os.environ.get("GCS_BUCKET")
    USER_UPLOAD_FOLDER = os.environ.get("USER_UPLOAD_FOLDER", "uploads")
    
    # Derived configuration
    LOCATION = parse_location_from_corpus(RAG_CORPUS)

    @classmethod
    def validate(cls):
        """Validate critical configuration variables."""
        missing = []
        if not cls.RAG_CORPUS:
            missing.append("RAG_CORPUS")
        if not cls.GCS_BUCKET:
            missing.append("GCS_BUCKET")
        
        if missing:
            return False, f"Missing environment variables: {', '.join(missing)}"
        return True, None

