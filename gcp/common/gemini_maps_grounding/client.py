"""
Gemini Maps Grounding Client for Google Maps Grounding operations.

Provides async methods for:
- Generating content with Google Maps Grounding enabled
- Location-aware queries and recommendations
- Accessing Maps citations and widget context tokens
"""

import asyncio
import logging
from typing import Optional, Dict, Any

from .config import GeminiMapsGroundingConfig
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

logger = logging.getLogger(__name__)


class GeminiMapsGroundingError(Exception):
    """Base exception for Gemini Maps Grounding client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class GeminiMapsGroundingClient:
    """
    Client for Gemini Maps Grounding API operations.
    
    Supports generating content with Google Maps Grounding tool enabled.
    
    Example:
        config = GeminiMapsGroundingConfig.from_env()
        client = GeminiMapsGroundingClient(config)
        
        # Generate content with Maps Grounding
        response = await client.generate_content(
            contents="What are the best Italian restaurants within a 15-minute walk from here?",
            user_location=LatLng(latitude=34.050481, longitude=-118.248526)
        )
        print(response.text)
        print(f"Maps citations: {response.maps_citations}")
    """
    
    def __init__(self, config: GeminiMapsGroundingConfig):
        """
        Initialize Gemini Maps Grounding client.
        
        Args:
            config: GeminiMapsGroundingConfig instance
        """
        self.config = config
        self._client = None
    
    def _get_client(self):
        """Get or create the Gemini client."""
        if self._client is None:
            from google import genai
            
            if self.config.use_vertex_ai:
                if not self.config.project_id:
                    raise ValueError("Project ID required for Vertex AI")
                self._client = genai.Client(
                    vertexai=True,
                    project=self.config.project_id,
                    location=self.config.location
                )
            else:
                if not self.config.api_key:
                    raise ValueError("API key required when not using Vertex AI")
                self._client = genai.Client(api_key=self.config.api_key)
        
        return self._client
    
    async def close(self):
        """Close the client connection."""
        # The genai.Client doesn't require explicit closing
        # but we reset the reference
        self._client = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def generate_content(
        self,
        contents: str,
        model: str = "gemini-3.0-pro-002",
        enable_maps_grounding: bool = True,
        enable_widget: bool = False,
        user_location: Optional[LatLng] = None,
        temperature: Optional[float] = None,
        max_output_tokens: Optional[int] = None,
        response_mime_type: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
    ) -> GenerateContentResponse:
        """
        Generate content using Google Maps Grounding tool.
        
        Args:
            contents: User prompt/question (should have geographical context)
            model: Model to use (must support Maps Grounding)
            enable_maps_grounding: Enable Maps Grounding tool (default: True)
            enable_widget: Enable widget context token in response (default: False)
            user_location: User's location for location-aware queries
            temperature: Temperature for generation
            max_output_tokens: Maximum output tokens
            response_mime_type: Response MIME type (e.g., 'application/json')
            response_schema: Response schema for structured output
            
        Returns:
            GenerateContentResponse: Generated content with Maps grounding metadata
            
        Example:
            response = await client.generate_content(
                contents="What are the best Italian restaurants within a 15-minute walk from here?",
                user_location=LatLng(latitude=34.050481, longitude=-118.248526),
                enable_widget=True
            )
            print(response.text)
            print(f"Maps citations: {response.maps_citations}")
        """
        client = self._get_client()
        
        try:
            from google.genai import types
            
            # Build tools list
            tools = []
            if enable_maps_grounding:
                google_maps_tool = {"googleMaps": {}}
                if enable_widget:
                    google_maps_tool["googleMaps"]["enableWidget"] = True
                tools.append(google_maps_tool)
            
            # Build tool config with location if provided
            tool_config_dict = None
            if user_location:
                tool_config_dict = {
                    "retrievalConfig": {
                        "latLng": {
                            "latitude": user_location.latitude,
                            "longitude": user_location.longitude
                        }
                    }
                }
            
            # Build config dict - use dict format for compatibility
            config_dict = {}
            if tools:
                config_dict["tools"] = tools
            if tool_config_dict:
                config_dict["tool_config"] = tool_config_dict
            
            if temperature is not None:
                config_dict["temperature"] = temperature
            if max_output_tokens is not None:
                config_dict["max_output_tokens"] = max_output_tokens
            if response_mime_type:
                config_dict["response_mime_type"] = response_mime_type
            if response_schema:
                config_dict["response_schema"] = response_schema
            
            # Create GenerateContentConfig
            # The SDK should handle tool_config as part of the config
            config = types.GenerateContentConfig(**config_dict) if config_dict else None
            
            # Make the API call
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config
                )
            )
            
            # Parse response
            text = response.text if hasattr(response, "text") else ""
            
            # Parse grounding metadata
            grounding_metadata = None
            google_maps_widget_context_token = None
            
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                
                # Parse grounding metadata
                if hasattr(candidate, "grounding_metadata"):
                    gm = candidate.grounding_metadata
                    grounding_chunks = []
                    
                    if hasattr(gm, "grounding_chunks"):
                        for chunk in gm.grounding_chunks:
                            maps_chunk = None
                            if hasattr(chunk, "maps"):
                                maps_data = chunk.maps
                                maps_chunk = MapsChunk(
                                    title=getattr(maps_data, "title", None),
                                    uri=getattr(maps_data, "uri", None),
                                    place_id=getattr(maps_data, "place_id", None),
                                    review_id=getattr(maps_data, "review_id", None),
                                )
                            
                            grounding_chunks.append(GroundingChunk(
                                maps=maps_chunk,
                                start_index=getattr(chunk, "start_index", None),
                                end_index=getattr(chunk, "end_index", None),
                            ))
                    
                    grounding_metadata = GroundingMetadata(
                        grounding_chunks=grounding_chunks if grounding_chunks else None,
                        retrieval_queries=getattr(gm, "retrieval_queries", None),
                    )
                
                # Parse widget context token
                if hasattr(candidate, "google_maps_widget_context_token"):
                    google_maps_widget_context_token = candidate.google_maps_widget_context_token
            
            # Parse usage metadata
            usage_metadata = None
            if hasattr(response, "usage_metadata"):
                um = response.usage_metadata
                usage_metadata = {
                    "prompt_token_count": getattr(um, "prompt_token_count", None),
                    "candidates_token_count": getattr(um, "candidates_token_count", None),
                    "total_token_count": getattr(um, "total_token_count", None),
                }
            
            return GenerateContentResponse(
                text=text,
                grounding_metadata=grounding_metadata,
                google_maps_widget_context_token=google_maps_widget_context_token,
                model=model,
                finish_reason=getattr(response, "finish_reason", None),
                usage_metadata=usage_metadata,
            )
            
        except Exception as e:
            logger.error(f"Failed to generate content: {e}")
            raise GeminiMapsGroundingError(
                message=f"Failed to generate content: {e}",
                details={
                    "model": model,
                    "enable_maps_grounding": enable_maps_grounding,
                    "has_user_location": user_location is not None,
                }
            )
    
    async def generate_content_with_config(
        self,
        contents: str,
        config: GenerateContentConfig,
    ) -> GenerateContentResponse:
        """
        Generate content using a GenerateContentConfig object.
        
        Args:
            contents: User prompt/question (should have geographical context)
            config: GenerateContentConfig instance
            
        Returns:
            GenerateContentResponse: Generated content with Maps grounding metadata
            
        Example:
            config = GenerateContentConfig(
                model="gemini-3.0-pro-002",
                enable_maps_grounding=True,
                enable_widget=True,
                user_location=LatLng(latitude=34.050481, longitude=-118.248526),
                temperature=0.7
            )
            response = await client.generate_content_with_config(
                contents="Find coffee shops near me",
                config=config
            )
        """
        return await self.generate_content(
            contents=contents,
            model=config.model,
            enable_maps_grounding=config.enable_maps_grounding,
            enable_widget=config.enable_widget,
            user_location=config.user_location,
            temperature=config.temperature,
            max_output_tokens=config.max_output_tokens,
            response_mime_type=config.response_mime_type,
            response_schema=config.response_schema,
        )

