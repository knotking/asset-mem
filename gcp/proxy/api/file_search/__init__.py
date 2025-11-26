# Gemini File Search API Service
# Provides file upload, storage management, and retrieval for RAG-based document search

from .service import GeminiFileSearchService
from .models import (
    FileMetadata,
    FileSearchStore,
    FileUploadRequest,
    FileSearchQuery,
    FileSearchResult,
    FileStatus,
    StoreType,
)
from .firestore_client import FileSearchFirestoreClient

__all__ = [
    "GeminiFileSearchService",
    "FileMetadata",
    "FileSearchStore",
    "FileUploadRequest",
    "FileSearchQuery",
    "FileSearchResult",
    "FileStatus",
    "StoreType",
    "FileSearchFirestoreClient",
]

