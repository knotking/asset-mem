"""
Gemini URL Context - URL Context Support for Gemini API

Provides support for URL context tool in Gemini API generateContent calls.
Supports:
- Generating content with URL context tool enabled
- Extracting and analyzing content from URLs
- Combining URL context with other tools (e.g., Google Search)
"""

from .client import GeminiURLContextClient, GeminiURLContextError
from .models import (
    GenerateContentConfig,
    GenerateContentResponse,
    URLContextMetadata,
    URLRetrievalStatus,
)
from .config import GeminiURLContextConfig

__all__ = [
    # Client
    "GeminiURLContextClient",
    "GeminiURLContextError",
    # Config
    "GeminiURLContextConfig",
    # Models
    "GenerateContentConfig",
    "GenerateContentResponse",
    "URLContextMetadata",
    "URLRetrievalStatus",
]

