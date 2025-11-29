"""
Gemini Maps Grounding - Google Maps Grounding Support for Gemini API

Provides support for Google Maps Grounding tool in Gemini API generateContent calls.
Supports:
- Generating content with Google Maps Grounding enabled
- Location-aware queries and recommendations
- Google Maps widget context tokens
- Grounding metadata and citations
"""

from .client import GeminiMapsGroundingClient, GeminiMapsGroundingError
from .models import (
    GenerateContentConfig,
    GenerateContentResponse,
    GroundingMetadata,
    GroundingChunk,
    MapsChunk,
    LatLng,
    RetrievalConfig,
    ToolConfig,
)
from .config import GeminiMapsGroundingConfig

__all__ = [
    # Client
    "GeminiMapsGroundingClient",
    "GeminiMapsGroundingError",
    # Config
    "GeminiMapsGroundingConfig",
    # Models
    "GenerateContentConfig",
    "GenerateContentResponse",
    "GroundingMetadata",
    "GroundingChunk",
    "MapsChunk",
    "LatLng",
    "RetrievalConfig",
    "ToolConfig",
]

