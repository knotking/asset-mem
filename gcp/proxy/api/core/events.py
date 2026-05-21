"""FastAPI lifespan: proxy observability startup and Pub/Sub result listener.

On shutdown, cancels the streaming pull and joins the listener thread (bounded wait)
so Cloud Run scale-in/deploy does not leave dangling pull callbacks.
"""
import asyncio
import json
import logging
import threading
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from google.api_core.exceptions import GoogleAPIError

from core.config import settings
from core.observability_startup import setup_proxy_observability
from schemas.agent import UserUploadResultEvent
from utils.gcp import subscribe_to_event

logger = logging.getLogger(__name__)

_pubsub_pull_future = None
_pubsub_thread: Optional[threading.Thread] = None


async def on_event_user_upload_result(message: str):
    try:
        event_obj = UserUploadResultEvent.model_validate(json.loads(message))
        logger.info("Parsed user upload result event: %s", event_obj)
        # Original logic in main.py appeared to stop here or was incomplete.
        # Placeholder for further processing if needed.
    except Exception as e:
        logger.exception("Failed to parse user upload result event: %s", e)


def _run_pubsub_listener(loop: asyncio.AbstractEventLoop) -> None:
    global _pubsub_pull_future

    def sync_callback(message: str):
        asyncio.run_coroutine_threadsafe(on_event_user_upload_result(message), loop)

    if not settings.GCP_PROJECT_ID or not settings.USER_UPLOAD_RESULT_SUBSCRIPTION:
        logger.warning("PubSub configuration missing, skipping listener.")
        return

    try:
        _pubsub_pull_future = subscribe_to_event(
            settings.GCP_PROJECT_ID,
            settings.USER_UPLOAD_RESULT_SUBSCRIPTION,
            sync_callback,
        )
        _pubsub_pull_future.result()
    except GoogleAPIError as e:
        logger.exception("Pub/Sub listener API error: %s", e)
    except Exception as e:
        if "Cancelled" in type(e).__name__ or "cancelled" in str(e).lower():
            logger.info("Pub/Sub listener cancelled")
        else:
            logger.exception("Pub/Sub listener stopped: %s", e)


def _shutdown_pubsub_listener() -> None:
    global _pubsub_pull_future, _pubsub_thread

    if _pubsub_pull_future is not None:
        logger.info("Cancelling Pub/Sub streaming pull...")
        _pubsub_pull_future.cancel()
        _pubsub_pull_future = None

    if _pubsub_thread is not None and _pubsub_thread.is_alive():
        _pubsub_thread.join(timeout=10)
        if _pubsub_thread.is_alive():
            logger.warning("Pub/Sub listener thread did not exit within 10s")
    _pubsub_thread = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pubsub_thread

    setup_proxy_observability()

    loop = asyncio.get_running_loop()
    _pubsub_thread = threading.Thread(
        target=_run_pubsub_listener,
        args=(loop,),
        name="pubsub-user-upload-result",
        daemon=True,
    )
    _pubsub_thread.start()

    yield

    _shutdown_pubsub_listener()
