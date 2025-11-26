"""
Gemini File Search Worker - Cloud Function

This Cloud Function handles:
1. File upload processing from Pub/Sub messages
2. File refresh operations for expiring files
3. Publishing results to the result topic

Triggered by:
- file-search-upload-topic: New file upload requests
- file-search-refresh-topic: File refresh requests (scheduled)

Environment Variables:
- GEMINI_API_KEY: Gemini API key
- GCP_PROJECT_ID: GCP project ID
- GCS_BUCKET: GCS bucket for file storage
- FILE_SEARCH_RESULT_TOPIC: Pub/Sub topic for results
"""

import base64
import json
import os
import logging
import asyncio
import tempfile
import hashlib
import mimetypes
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import google.generativeai as genai
from google.cloud import firestore
from google.cloud import storage
from google.cloud import pubsub_v1

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
GCS_BUCKET = os.environ.get("GCS_BUCKET")
FILE_SEARCH_RESULT_TOPIC = os.environ.get("FILE_SEARCH_RESULT_TOPIC")
GEMINI_FILE_EXPIRY_HOURS = 48
GEMINI_FILE_REFRESH_HOURS = 6

# Initialize clients
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

firestore_client = firestore.Client(project=GCP_PROJECT_ID) if GCP_PROJECT_ID else None
storage_client = storage.Client(project=GCP_PROJECT_ID) if GCP_PROJECT_ID else None
publisher = pubsub_v1.PublisherClient()


def publish_result(
    user_id: str,
    success: bool,
    gcs_urls: List[str],
    file_ids: List[str],
    error_message: str = "",
    source: str = "file_search_worker",
) -> None:
    """Publish processing result to the result topic."""
    if not FILE_SEARCH_RESULT_TOPIC or not GCP_PROJECT_ID:
        logger.warning("FILE_SEARCH_RESULT_TOPIC not configured, skipping publish")
        return

    topic_path = publisher.topic_path(GCP_PROJECT_ID, FILE_SEARCH_RESULT_TOPIC)

    payload = {
        "user_id": user_id,
        "success": success,
        "gcs_urls": gcs_urls,
        "file_ids": file_ids,
        "error_message": error_message,
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        future = publisher.publish(topic_path, json.dumps(payload).encode("utf-8"))
        message_id = future.result()
        logger.info(f"Published result to {FILE_SEARCH_RESULT_TOPIC}: {message_id}")
    except Exception as e:
        logger.error(f"Failed to publish result: {e}")


def parse_gcs_url(gcs_url: str) -> tuple[str, str]:
    """Parse GCS URL into bucket name and blob path."""
    if not gcs_url.startswith("gs://"):
        raise ValueError(f"Invalid GCS URL: {gcs_url}")

    path = gcs_url[5:]  # Remove "gs://"
    parts = path.split("/", 1)

    if len(parts) != 2:
        raise ValueError(f"Invalid GCS URL: {gcs_url}")

    return parts[0], parts[1]


def download_from_gcs(gcs_url: str) -> tuple[bytes, str, int]:
    """
    Download file from GCS.
    
    Returns:
        Tuple of (file_content, filename, file_size)
    """
    bucket_name, blob_path = parse_gcs_url(gcs_url)
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(blob_path)

    if not blob.exists():
        raise FileNotFoundError(f"File not found: {gcs_url}")

    file_content = blob.download_as_bytes()
    filename = blob_path.split("/")[-1]

    return file_content, filename, len(file_content)


def upload_to_gemini(
    file_content: bytes,
    filename: str,
    mime_type: str,
) -> Any:
    """Upload file content to Gemini Files API."""
    # Write to temp file for upload
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name

    try:
        # Upload using genai library
        gemini_file = genai.upload_file(
            path=tmp_path,
            display_name=filename,
            mime_type=mime_type,
        )

        # Wait for processing to complete (synchronous)
        import time
        while gemini_file.state.name == "PROCESSING":
            time.sleep(1)
            gemini_file = genai.get_file(gemini_file.name)

        if gemini_file.state.name == "FAILED":
            raise Exception(f"File processing failed: {gemini_file.state.name}")

        return gemini_file

    finally:
        # Clean up temp file
        os.unlink(tmp_path)


def find_duplicate_file(user_id: str, file_hash: str) -> Optional[Dict[str, Any]]:
    """Find existing file with same hash for deduplication."""
    if not firestore_client:
        return None

    query = (
        firestore_client.collection("gemini_files")
        .where("user_id", "==", user_id)
        .where("file_hash", "==", file_hash)
        .where("status", "==", "active")
        .limit(1)
    )

    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        return data

    return None


def save_file_metadata(metadata: Dict[str, Any]) -> None:
    """Save file metadata to Firestore."""
    if not firestore_client:
        logger.warning("Firestore client not initialized, skipping save")
        return

    doc_ref = firestore_client.collection("gemini_files").document(metadata["id"])
    doc_ref.set(metadata)


def process_file_upload(
    user_id: str,
    gcs_url: str,
    property_id: Optional[str] = None,
    custom_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Process a single file upload.
    
    Args:
        user_id: User ID
        gcs_url: GCS URL of the file
        property_id: Optional property ID
        custom_metadata: Optional additional metadata
        
    Returns:
        File metadata dict
    """
    custom_metadata = custom_metadata or {}
    now = datetime.now(timezone.utc)

    # Download from GCS
    file_content, filename, file_size = download_from_gcs(gcs_url)
    file_hash = hashlib.sha256(file_content).hexdigest()

    # Check for duplicate
    existing = find_duplicate_file(user_id, file_hash)
    if existing:
        logger.info(f"Found existing file with same hash: {existing['id']}")
        return existing

    # Determine MIME type
    mime_type, _ = mimetypes.guess_type(filename)
    if not mime_type:
        mime_type = "application/octet-stream"

    # Create document ID
    doc_id = f"{user_id}_{now.strftime('%Y%m%d%H%M%S')}_{file_hash[:8]}"

    # Create initial metadata
    metadata = {
        "id": doc_id,
        "user_id": user_id,
        "property_id": property_id,
        "gcs_url": gcs_url,
        "gemini_file_id": "",
        "gemini_file_uri": "",
        "original_filename": filename,
        "mime_type": mime_type,
        "file_size_bytes": file_size,
        "file_hash": file_hash,
        "status": "processing",
        "created_at": now,
        "expires_at": now + timedelta(hours=GEMINI_FILE_EXPIRY_HOURS),
        "last_refreshed_at": None,
        "error_message": None,
        "metadata": custom_metadata,
    }

    # Save initial record
    save_file_metadata(metadata)

    try:
        # Upload to Gemini
        gemini_file = upload_to_gemini(file_content, filename, mime_type)

        # Update metadata
        metadata["gemini_file_id"] = gemini_file.name
        metadata["gemini_file_uri"] = gemini_file.uri
        metadata["status"] = "active"
        metadata["expires_at"] = now + timedelta(hours=GEMINI_FILE_EXPIRY_HOURS)

        save_file_metadata(metadata)
        logger.info(f"File uploaded successfully: {gemini_file.name}")

        return metadata

    except Exception as e:
        logger.error(f"Failed to upload to Gemini: {e}")
        metadata["status"] = "failed"
        metadata["error_message"] = str(e)
        save_file_metadata(metadata)
        raise


def refresh_file(doc_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Refresh a file by re-uploading to Gemini.
    
    Returns updated metadata or None if refresh failed.
    """
    if not firestore_client:
        return None

    doc_ref = firestore_client.collection("gemini_files").document(doc_id)
    doc = doc_ref.get()

    if not doc.exists:
        logger.warning(f"File not found for refresh: {doc_id}")
        return None

    metadata = doc.to_dict()
    metadata["id"] = doc.id

    if metadata.get("user_id") != user_id:
        logger.warning(f"User mismatch for file refresh: {doc_id}")
        return None

    if metadata.get("status") != "active":
        logger.warning(f"Cannot refresh file with status {metadata.get('status')}")
        return metadata

    try:
        # Download from GCS
        file_content, filename, _ = download_from_gcs(metadata["gcs_url"])

        # Delete old Gemini file if exists
        old_gemini_id = metadata.get("gemini_file_id")
        if old_gemini_id:
            try:
                genai.delete_file(old_gemini_id)
            except Exception as e:
                logger.warning(f"Failed to delete old Gemini file: {e}")

        # Upload new file
        gemini_file = upload_to_gemini(file_content, filename, metadata["mime_type"])

        # Update metadata
        now = datetime.now(timezone.utc)
        metadata["gemini_file_id"] = gemini_file.name
        metadata["gemini_file_uri"] = gemini_file.uri
        metadata["expires_at"] = now + timedelta(hours=GEMINI_FILE_EXPIRY_HOURS)
        metadata["last_refreshed_at"] = now
        metadata["status"] = "active"
        metadata["error_message"] = None

        save_file_metadata(metadata)
        logger.info(f"File refreshed: {doc_id}")

        return metadata

    except Exception as e:
        logger.error(f"Failed to refresh file: {e}")
        metadata["status"] = "failed"
        metadata["error_message"] = f"Refresh failed: {str(e)}"
        save_file_metadata(metadata)
        return metadata


def refresh_expiring_files(hours_before_expiry: int = GEMINI_FILE_REFRESH_HOURS) -> Dict[str, Any]:
    """
    Refresh all files expiring within the specified hours.
    
    Returns summary of refresh operations.
    """
    if not firestore_client:
        return {"error": "Firestore client not initialized"}

    threshold = datetime.now(timezone.utc) + timedelta(hours=hours_before_expiry)

    query = (
        firestore_client.collection("gemini_files")
        .where("status", "==", "active")
        .where("expires_at", "<", threshold)
    )

    refreshed = 0
    failed = 0
    errors = []

    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id

        try:
            result = refresh_file(data["id"], data["user_id"])
            if result and result.get("status") == "active":
                refreshed += 1
            else:
                failed += 1
                errors.append(f"{data['id']}: {result.get('error_message', 'Unknown error')}")
        except Exception as e:
            failed += 1
            errors.append(f"{data['id']}: {str(e)}")

    return {
        "refreshed": refreshed,
        "failed": failed,
        "errors": errors,
    }


# ============================================================================
# Cloud Function Entry Points
# ============================================================================

def file_search_upload(request, context):
    """
    Cloud Function entry point for file upload processing.
    
    Triggered by: file-search-upload-topic
    
    Payload format:
    {
        "user_id": "string",
        "gcs_urls": ["gs://bucket/path/file.pdf"],
        "property_id": "optional string",
        "metadata": {}
    }
    """
    logger.info("file_search_upload triggered")

    # Parse Pub/Sub message
    if "data" in request:
        payload = json.loads(base64.b64decode(request["data"]).decode("utf-8"))
    else:
        payload = {}

    user_id = payload.get("user_id")
    gcs_urls = payload.get("gcs_urls", [])
    property_id = payload.get("property_id")
    custom_metadata = payload.get("metadata", {})

    if not user_id:
        logger.error("No user_id in payload")
        return

    if not gcs_urls:
        logger.warning("No gcs_urls in payload")
        return

    logger.info(f"Processing {len(gcs_urls)} files for user {user_id}")

    file_ids = []
    errors = []

    for gcs_url in gcs_urls:
        try:
            metadata = process_file_upload(
                user_id=user_id,
                gcs_url=gcs_url,
                property_id=property_id,
                custom_metadata=custom_metadata,
            )
            file_ids.append(metadata["gemini_file_id"])
            logger.info(f"Processed: {gcs_url} -> {metadata['gemini_file_id']}")
        except Exception as e:
            error_msg = f"{gcs_url}: {str(e)}"
            errors.append(error_msg)
            logger.error(f"Failed to process: {error_msg}")

    # Publish result
    publish_result(
        user_id=user_id,
        success=len(errors) == 0,
        gcs_urls=gcs_urls,
        file_ids=file_ids,
        error_message="; ".join(errors) if errors else "",
    )

    logger.info(f"Completed: {len(file_ids)} uploaded, {len(errors)} failed")


def file_search_refresh(request, context):
    """
    Cloud Function entry point for file refresh operations.
    
    Triggered by: file-search-refresh-topic (scheduled every 6 hours)
    
    Payload format:
    {
        "action": "refresh_expiring_files",
        "hours_before_expiry": 6
    }
    """
    logger.info("file_search_refresh triggered")

    # Parse Pub/Sub message
    if "data" in request:
        payload = json.loads(base64.b64decode(request["data"]).decode("utf-8"))
    else:
        payload = {}

    action = payload.get("action", "refresh_expiring_files")
    hours_before_expiry = payload.get("hours_before_expiry", GEMINI_FILE_REFRESH_HOURS)

    if action == "refresh_expiring_files":
        result = refresh_expiring_files(hours_before_expiry)
        logger.info(f"Refresh complete: {result}")
    elif action == "refresh_single":
        # Refresh a single file
        doc_id = payload.get("doc_id")
        user_id = payload.get("user_id")
        if doc_id and user_id:
            result = refresh_file(doc_id, user_id)
            logger.info(f"Single file refresh: {result}")
        else:
            logger.error("Missing doc_id or user_id for single refresh")
    else:
        logger.warning(f"Unknown action: {action}")


# ============================================================================
# Local Testing
# ============================================================================

if __name__ == "__main__":
    # Test payload
    test_payload = {
        "user_id": "test_user",
        "gcs_urls": ["gs://test-bucket/test-file.pdf"],
        "property_id": "test_property",
    }

    # Simulate Pub/Sub message
    test_request = {
        "data": base64.b64encode(json.dumps(test_payload).encode("utf-8")).decode("utf-8")
    }

    print("Testing file_search_upload...")
    file_search_upload(test_request, None)

