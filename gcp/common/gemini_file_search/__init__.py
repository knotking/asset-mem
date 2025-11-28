"""
Gemini File Search - RAG Support for Gemini API

Provides support for Retrieval Augmented Generation (RAG) through Gemini API File Search.
Supports:
- Creating and managing File Search stores
- Uploading files to stores
- Using File Search in generateContent calls
"""

from .client import GeminiFileSearchClient, GeminiFileSearchError
from .models import (
    FileSearchStore,
    FileSearchDocument,
    FileSearchConfig,
    UploadConfig,
    GenerateContentConfig,
    GenerateContentResponse,
    GroundingMetadata,
    Citation,
)
from .config import GeminiFileSearchConfig

__all__ = [
    # Client
    "GeminiFileSearchClient",
    "GeminiFileSearchError",
    # Config
    "GeminiFileSearchConfig",
    # Models
    "FileSearchStore",
    "FileSearchDocument",
    "FileSearchConfig",
    "UploadConfig",
    "GenerateContentConfig",
    "GenerateContentResponse",
    "GroundingMetadata",
    "Citation",
]

