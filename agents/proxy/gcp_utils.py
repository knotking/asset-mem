import tempfile
import aiohttp
from google.cloud import storage
import json


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
from google.cloud import pubsub_v1


def publish_event(project_id, topic_id, gcs_urls, user_id, user_query):
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(project_id, topic_id)

    event = {
        "gcs_urls": gcs_urls,
        "user_id": user_id,
        "user_query": user_query
    }

    data = json.dumps(event).encode("utf-8")
    future = publisher.publish(topic_path, data)
    print(f"Published message ID: {future.result()}")