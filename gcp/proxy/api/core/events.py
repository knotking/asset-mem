import asyncio
import logging
import threading
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI
from utils.gcp import listen_to_event
from core.config import settings
from schemas.agent import UserUploadResultEvent

logger = logging.getLogger(__name__)

async def on_event_user_upload_result(message: str):
    try:
        event_obj = UserUploadResultEvent.model_validate(json.loads(message))
        logger.info(f"Parsed event: {event_obj}")
        # Original logic in main.py appeared to stop here or was incomplete.
        # Placeholder for further processing if needed.
    except Exception as e:
        logger.exception("Failed to parse user upload result event: %s", e)

def start_pubsub_listener(loop: asyncio.AbstractEventLoop):
    def sync_callback(message):
        # Schedule the coroutine on the provided event loop
        asyncio.run_coroutine_threadsafe(
            on_event_user_upload_result(message),
            loop
        )
    
    if settings.GCP_PROJECT_ID and settings.USER_UPLOAD_RESULT_SUBSCRIPTION:
        try:
            listen_to_event(
                settings.GCP_PROJECT_ID,
                settings.USER_UPLOAD_RESULT_SUBSCRIPTION,
                sync_callback
            )
        except Exception as e:
            logger.exception("Error in PubSub listener: %s", e)
    else:
        logger.warning("PubSub configuration missing, skipping listener.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    loop = asyncio.get_running_loop()
    # We start the listener in a separate thread because listen_to_event is blocking
    thread = threading.Thread(target=start_pubsub_listener, args=(loop,), daemon=True)
    thread.start()
    yield
    # Shutdown logic if any
