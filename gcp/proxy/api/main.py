"""
GCP Proxy API Main Application

FastAPI application serving as a backend proxy for various services.
"""

import os
import logging
import asyncio
import threading
import json
from typing import Dict, Any, Union, List
from pydantic import BaseModel, Field

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from middleware import (
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
    LoggingMiddleware,
    ErrorHandlingMiddleware,
)
from routers import firebase_router, telegram_router, document_router, service_broker_router
from vertex_client import reasoning_engine_resource
from gcp_utils import listen_to_event

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="GCP Proxy API for agent queries, document analysis, and webhook handling",
)

# Add middleware (order matters - last added is first executed)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
# Firebase router with backward-compatible path support
if settings.firebase_webhook_secret:
    # Support both new router paths and legacy paths for backward compatibility
    app.include_router(
        firebase_router.router,
        prefix=f"/{settings.firebase_webhook_secret}",
        tags=["firebase"]
    )

# Telegram router with backward-compatible path support
if settings.telegram_webhook_secret:
    app.include_router(
        telegram_router.router,
        prefix=f"/{settings.telegram_webhook_secret}",
        tags=["telegram"]
    )

# Document router (can be accessed via Firebase router or independently)
app.include_router(document_router.router)

# Service broker router
if settings.firebase_webhook_secret:
    app.include_router(
        service_broker_router.router,
        prefix=f"/{settings.firebase_webhook_secret}",
        tags=["service-broker"]
    )

# Get main event loop for background processing
main_loop = asyncio.get_event_loop()


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Returns service status and dependency health information.
    """
    status_info = {
        "status": "ok",
        "version": settings.app_version,
        "dependencies": {}
    }
    
    # Check Reasoning Engine
    if reasoning_engine_resource:
        status_info["dependencies"]["reasoning_engine"] = "ok"
    else:
        status_info["dependencies"]["reasoning_engine"] = "not_initialized"
        status_info["status"] = "degraded"
    
    # Check configuration
    try:
        settings.validate_required()
        status_info["dependencies"]["configuration"] = "ok"
    except ValueError as e:
        status_info["dependencies"]["configuration"] = f"error: {str(e)}"
        status_info["status"] = "degraded"
    
    return status_info


# Pub/Sub event handler
class UserUploadResultEvent(BaseModel):
    """Model for user upload result events."""
    
    user_id: str
    user_query: str
    gcs_urls: List[str]
    success: bool = Field(default=True)
    error: str = Field(default="")
    source: str = Field(default="unknown")
    result: Union[Dict[str, Any], str] = Field(default_factory=dict)


async def on_event_user_upload_result(message: str):
    """Handle user upload result events from Pub/Sub."""
    try:
        event_obj = UserUploadResultEvent.model_validate(json.loads(message))
        logger.info(f"Parsed user upload result event: {event_obj}")
        # TODO: Implement actual event processing logic
    except Exception as e:
        logger.error(f"Failed to parse user upload result event: {e}", exc_info=True)


def start_pubsub_listener():
    """Start Pub/Sub listener in background thread."""
    def sync_callback(message):
        # Schedule the coroutine on the main event loop
        asyncio.run_coroutine_threadsafe(
            on_event_user_upload_result(message),
            main_loop
        )
    
    if settings.gcp_project_id and settings.user_upload_result_subscription:
        listen_to_event(
            settings.gcp_project_id,
            settings.user_upload_result_subscription,
            sync_callback
        )
    else:
        logger.warning("Pub/Sub listener not started: missing configuration")


# Start Pub/Sub listener in background thread
if settings.gcp_project_id and settings.user_upload_result_subscription:
    threading.Thread(target=start_pubsub_listener, daemon=True).start()
else:
    logger.info("Pub/Sub listener not configured, skipping startup")

