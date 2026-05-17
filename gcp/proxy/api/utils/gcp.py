import tempfile
import aiohttp
from google.cloud import storage
import json
import logging

logger = logging.getLogger(__name__)


async def upload_file_to_gcs(file_url: str, bucket_name: str, destination_blob_name: str) -> str:
    """Download file from Telegram and upload to GCS. Returns the GCS URL."""
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    async with aiohttp.ClientSession() as session:
        async with session.get(file_url) as resp:
            if resp.status != 200:
                raise Exception(f"Failed to download file: {resp.status}")
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                tmp_file.write(await resp.read())
                tmp_file.flush()
                blob.upload_from_filename(tmp_file.name)
    return f"gs://{bucket_name}/{destination_blob_name}"

def get_user_gcs_files(bucket_name: str, folder_name: str, user_id: str) -> list:
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


def publish_event(project_id, topic_id, gcs_urls, user_id, user_query, source):
    from google.cloud import pubsub_v1

    from common.observability.logging_context import pubsub_payload_with_correlation

    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(project_id, topic_id)

    event = pubsub_payload_with_correlation({
        "gcs_urls": gcs_urls,
        "user_id": user_id,
        "user_query": user_query,
        "source": source,
    })

    data = json.dumps(event).encode("utf-8")
    future = publisher.publish(topic_path, data)
    logger.info(f"Published message ID: {future.result()}")

def listen_to_event(project_id, subscription_id, callback):
    from google.cloud import pubsub_v1
    """
    Listen to a Pub/Sub subscription and call the callback for each message.
    The callback should accept one argument: the message data (decoded as string).
    """
    subscriber = pubsub_v1.SubscriberClient()
    subscription_path = subscriber.subscription_path(project_id, subscription_id)

    def _callback(message):
        callback(message.data.decode("utf-8"))
        message.ack()

    streaming_pull_future = subscriber.subscribe(subscription_path, callback=_callback)
    logger.info(f"Listening for messages on {subscription_path}...")
    try:
        streaming_pull_future.result()
    except KeyboardInterrupt:
        streaming_pull_future.cancel()

