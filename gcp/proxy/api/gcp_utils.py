"""
GCP Utilities Module

Utilities for Google Cloud Platform operations including GCS and Pub/Sub.
"""

import tempfile
import aiohttp
from google.cloud import storage
import json
import logging
from typing import List

from constants import MAX_RETRIES, RETRY_DELAY_SECONDS, GCS_UPLOAD_TIMEOUT

logger = logging.getLogger(__name__)


async def upload_file_to_gcs(file_url: str, bucket_name: str, destination_blob_name: str) -> str:
    """
    Download file from URL and upload to GCS asynchronously.
    
    Args:
        file_url: URL to download file from
        bucket_name: GCS bucket name
        destination_blob_name: Destination blob path in bucket
        
    Returns:
        GCS URL (gs://bucket/path)
        
    Raises:
        Exception: If download or upload fails
    """
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=GCS_UPLOAD_TIMEOUT)) as session:
        async with session.get(file_url) as resp:
            if resp.status != 200:
                raise Exception(f"Failed to download file: {resp.status}")
            
            # Download content
            content = await resp.read()
            
            # Write to temp file synchronously (small overhead for async benefit)
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                tmp_file.write(content)
                tmp_file.flush()
                tmp_file_path = tmp_file.name
            
            # Upload to GCS (synchronous operation, but file is already downloaded)
            blob.upload_from_filename(tmp_file_path)
            
            # Clean up temp file
            import os
            try:
                os.unlink(tmp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temp file {tmp_file_path}: {e}")
    
    return f"gs://{bucket_name}/{destination_blob_name}"

def get_user_gcs_files(bucket_name: str, folder_name: str, user_id: str) -> List[str]:
    """
    Fetch all file names for a user from GCS bucket under telegram-uploads/{user_id}/
    Returns a list of file names (full GCS paths).
    """
    from google.cloud import storage
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    user_prefix = f"{folder_name}/{user_id}/"
    blobs = bucket.list_blobs(prefix=user_prefix)
    return [blob.name for blob in blobs if not blob.name.endswith("/")]




def publish_event(project_id: str, topic_id: str, gcs_urls: List[str], user_id: str, user_query: str, source: str) -> str:
    """
    Publish event to Pub/Sub topic.
    
    Args:
        project_id: GCP project ID
        topic_id: Pub/Sub topic ID
        gcs_urls: List of GCS URLs
        user_id: User identifier
        user_query: User query text
        source: Event source identifier
        
    Returns:
        Published message ID
    """
    from google.cloud import pubsub_v1
    
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(project_id, topic_id)

    event = {
        "gcs_urls": gcs_urls,
        "user_id": user_id,
        "user_query": user_query,
        "source": source
    }

    data = json.dumps(event).encode("utf-8")
    future = publisher.publish(topic_path, data)
    message_id = future.result()
    logger.info(f"Published message ID: {message_id}")
    return message_id

def listen_to_event(project_id: str, subscription_id: str, callback) -> None:
    """
    Listen to a Pub/Sub subscription and call the callback for each message.
    
    Args:
        project_id: GCP project ID
        subscription_id: Pub/Sub subscription ID
        callback: Callback function that accepts message data (decoded as string)
    """
    from google.cloud import pubsub_v1
    
    subscriber = pubsub_v1.SubscriberClient()
    subscription_path = subscriber.subscription_path(project_id, subscription_id)

    def _callback(message):
        try:
            callback(message.data.decode("utf-8"))
            message.ack()
        except Exception as e:
            logger.error(f"Error processing Pub/Sub message: {e}", exc_info=True)
            message.nack()  # Nack on error to retry

    streaming_pull_future = subscriber.subscribe(subscription_path, callback=_callback)
    logger.info(f"Listening for messages on {subscription_path}...")
    try:
        streaming_pull_future.result()
    except KeyboardInterrupt:
        logger.info("Stopping Pub/Sub listener...")
        streaming_pull_future.cancel()