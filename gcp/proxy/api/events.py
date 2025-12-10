import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Union
from pydantic import BaseModel, Field
from gcp_utils import listen_to_event

logger: logging.Logger = logging.getLogger(__name__)

class UserUploadResultEvent(BaseModel):
    user_id: str
    user_query: str
    gcs_urls: List[str]
    success: bool = Field(default=True)
    error: str = Field(default="")
    source: str = Field(default="unknown")
    result: Union[Dict[str, Any], str] = Field(default_factory=dict)

async def on_event_user_upload_result(message: str):
    """Handle user upload result events from PubSub."""
    try:
        event_obj = UserUploadResultEvent.model_validate(json.loads(message))
        logger.info(f"Parsed event: {event_obj}")
        # Add any additional processing logic here
    except Exception as e:
        logger.error(f"Failed to parse user upload result event: {e}")

def start_pubsub_listener(loop: asyncio.AbstractEventLoop):
    """Start the PubSub listener in a background thread."""
    def sync_callback(message):
        # Schedule the coroutine on the main event loop
        asyncio.run_coroutine_threadsafe(
            on_event_user_upload_result(message),
            loop
        )
    
    project_id = os.environ.get("GCP_PROJECT_ID")
    subscription_id = os.environ.get("USER_UPLOAD_RESULT_SUBSCRIPTION")
    
    if project_id and subscription_id:
        logger.info(f"Starting PubSub listener for {subscription_id} in {project_id}")
        listen_to_event(
            project_id,
            subscription_id,
            sync_callback
        )
    else:
        logger.warning("GCP_PROJECT_ID or USER_UPLOAD_RESULT_SUBSCRIPTION not set. PubSub listener not started.")
