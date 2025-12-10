"""
Dependency Injection

Shared dependencies for FastAPI endpoints.
"""

import logging
from typing import Optional
from fastapi import Request

from config import settings
from vertex_client import reasoning_engine_resource

logger = logging.getLogger(__name__)


def get_request_id(request: Request) -> str:
    """Get request ID from request state."""
    return getattr(request.state, "request_id", "unknown")


def get_reasoning_engine():
    """Get Vertex AI Reasoning Engine resource."""
    if not reasoning_engine_resource:
        raise RuntimeError("Reasoning Engine not initialized")
    return reasoning_engine_resource


def verify_webhook_secret(request: Request, expected_secret: Optional[str]) -> bool:
    """
    Verify webhook secret from header or path.
    
    Checks X-Webhook-Secret header first, then falls back to path-based verification
    for backward compatibility.
    """
    if not expected_secret:
        return False
    
    # Check header first (preferred method)
    header_secret = request.headers.get("X-Webhook-Secret")
    if header_secret == expected_secret:
        return True
    
    # Fallback to path-based verification for backward compatibility
    # This allows existing integrations to continue working
    path_secret = request.url.path.split("/")[1] if len(request.url.path.split("/")) > 1 else None
    return path_secret == expected_secret
