"""
Pydantic models for Gemini Maps Grounding API.

Supports:
- Google Maps Grounding tool configuration
- GenerateContent with Maps Grounding
- Response parsing and grounding metadata
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class LatLng(BaseModel):
    """Latitude and longitude coordinates."""
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude (-90 to 90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude (-180 to 180)")


class RetrievalConfig(BaseModel):
    """Retrieval configuration for Maps Grounding."""
    lat_lng: Optional[LatLng] = Field(
        None,
        description="User location for location-aware queries"
    )


class ToolConfig(BaseModel):
    """Tool configuration for Maps Grounding."""
    retrieval_config: Optional[RetrievalConfig] = Field(
        None,
        description="Retrieval configuration with location context"
    )


class MapsChunk(BaseModel):
    """Google Maps chunk data."""
    title: Optional[str] = Field(None, description="Place title")
    uri: Optional[str] = Field(None, description="Google Maps URI")
    place_id: Optional[str] = Field(None, description="Google Maps Place ID")
    review_id: Optional[str] = Field(None, description="Review ID if from a review")


class GroundingChunk(BaseModel):
    """Grounding chunk containing Maps data."""
    maps: Optional[MapsChunk] = Field(None, description="Google Maps chunk data")
    start_index: Optional[int] = Field(None, description="Start index in response text")
    end_index: Optional[int] = Field(None, description="End index in response text")


class GroundingMetadata(BaseModel):
    """Grounding metadata from Maps Grounding."""
    grounding_chunks: Optional[List[GroundingChunk]] = Field(
        None,
        description="List of grounding chunks with Maps citations"
    )
    retrieval_queries: Optional[List[str]] = Field(
        None,
        description="Queries used for retrieval"
    )
    
    @property
    def maps_citations(self) -> List[MapsChunk]:
        """Get all Maps citations from grounding chunks."""
        citations = []
        if self.grounding_chunks:
            for chunk in self.grounding_chunks:
                if chunk.maps:
                    citations.append(chunk.maps)
        return citations
    
    @property
    def has_maps_citations(self) -> bool:
        """Check if response has Maps citations."""
        return len(self.maps_citations) > 0


class GenerateContentConfig(BaseModel):
    """Configuration for generateContent with Maps Grounding."""
    model: str = Field(
        default="gemini-3-pro-preview",
        description="Model to use (must support Maps Grounding)"
    )
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Temperature")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top-p sampling")
    top_k: Optional[int] = Field(None, ge=1, description="Top-k sampling")
    max_output_tokens: Optional[int] = Field(None, ge=1, description="Max output tokens")
    enable_maps_grounding: bool = Field(
        default=True,
        description="Enable Google Maps Grounding tool"
    )
    enable_widget: bool = Field(
        default=False,
        description="Enable Google Maps widget context token in response"
    )
    user_location: Optional[LatLng] = Field(
        None,
        description="User location for location-aware queries"
    )
    response_mime_type: Optional[str] = Field(
        None,
        description="Response MIME type (e.g., 'application/json')"
    )
    response_schema: Optional[Dict[str, Any]] = Field(
        None,
        description="Response schema for structured output"
    )


class GenerateContentResponse(BaseModel):
    """Response from generateContent with Maps Grounding."""
    text: str = Field(..., description="Generated text content")
    grounding_metadata: Optional[GroundingMetadata] = Field(
        None,
        description="Grounding metadata including Maps citations"
    )
    google_maps_widget_context_token: Optional[str] = Field(
        None,
        description="Context token for rendering Google Maps widget"
    )
    model: Optional[str] = Field(None, description="Model used")
    finish_reason: Optional[str] = Field(None, description="Finish reason")
    usage_metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Token usage metadata"
    )
    
    @property
    def maps_citations(self) -> List[MapsChunk]:
        """Get all Maps citations from grounding metadata."""
        if self.grounding_metadata:
            return self.grounding_metadata.maps_citations
        return []
    
    @property
    def has_maps_grounding(self) -> bool:
        """Check if response used Maps Grounding."""
        return self.grounding_metadata is not None and self.grounding_metadata.has_maps_citations
    
    @property
    def has_widget_token(self) -> bool:
        """Check if response includes widget context token."""
        return self.google_maps_widget_context_token is not None
    
    @property
    def prompt_token_count(self) -> Optional[int]:
        """Get prompt token count from usage metadata."""
        if self.usage_metadata:
            return self.usage_metadata.get("prompt_token_count")
        return None
    
    @property
    def candidates_token_count(self) -> Optional[int]:
        """Get candidates token count from usage metadata."""
        if self.usage_metadata:
            return self.usage_metadata.get("candidates_token_count")
        return None
    
    @property
    def total_token_count(self) -> Optional[int]:
        """Get total token count from usage metadata."""
        if self.usage_metadata:
            return self.usage_metadata.get("total_token_count")
        return None

