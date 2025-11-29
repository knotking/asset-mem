"""
Gemini Google Search Grounding - Google Search Grounding Support for Gemini API

Provides support for Google Search Grounding tool in Gemini API generateContent calls.
Supports:
- Generating content with Google Search Grounding enabled
- Accessing web search citations and grounding metadata
- Combining Google Search with URL context tool
- Inline citation formatting
"""

from .client import GeminiGoogleSearchClient, GeminiGoogleSearchError
from .models import (
    GenerateContentConfig,
    GenerateContentResponse,
    GroundingMetadata,
    GroundingChunk,
    GroundingSupport,
    WebChunk,
)
from .config import GeminiGoogleSearchConfig

__all__ = [
    # Client
    "GeminiGoogleSearchClient",
    "GeminiGoogleSearchError",
    # Config
    "GeminiGoogleSearchConfig",
    # Models
    "GenerateContentConfig",
    "GenerateContentResponse",
    "GroundingMetadata",
    "GroundingChunk",
    "GroundingSupport",
    "WebChunk",
]

