"""
Firebase Admin SDK common module.

Provides Firebase Admin initialization and client utilities for GCP services.
"""

from .client import FirebaseClient, FirebaseError
from .config import FirebaseConfig
from .firebase_api import (
    get_firebase_client,
    stream_firebase_agent_answers,
    handle_firebase_file_upload,
    handle_firebase_agent_query,
)

__all__ = [
    "FirebaseClient",
    "FirebaseError",
    "FirebaseConfig",
    "get_firebase_client",
    "stream_firebase_agent_answers",
    "handle_firebase_file_upload",
    "handle_firebase_agent_query",
]

