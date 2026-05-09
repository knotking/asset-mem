"""
Gemini Google Search Grounding Client for Google Search Grounding operations.

Provides async methods for:
- Generating content with Google Search Grounding enabled
- Accessing web search citations and grounding metadata
- Combining Google Search with URL context tool
"""

import asyncio
import logging
from typing import Optional, Dict, Any

from .config import GeminiGoogleSearchConfig
from .models import (
    GenerateContentConfig,
    GenerateContentResponse,
    GroundingMetadata,
    GroundingChunk,
    GroundingSupport,
    WebChunk,
)

logger = logging.getLogger(__name__)


class GeminiGoogleSearchError(Exception):
    """Base exception for Gemini Google Search Grounding client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class GeminiGoogleSearchClient:
    """
    Client for Gemini Google Search Grounding API operations.
    
    Supports generating content with Google Search Grounding tool enabled.
    
    Example:
        config = GeminiGoogleSearchConfig.from_env()
        client = GeminiGoogleSearchClient(config)
        
        # Generate content with Google Search Grounding
        response = await client.generate_content(
            contents="Who won the euro 2024?",
            enable_google_search=True
        )
        print(response.text)
        print(f"Search queries: {response.search_queries}")
        print(f"Citations: {response.web_citations}")
    """
    
    def __init__(self, config: GeminiGoogleSearchConfig):
        """
        Initialize Gemini Google Search Grounding client.
        
        Args:
            config: GeminiGoogleSearchConfig instance
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
        model: str = "gemini-3.1-flash-lite-preview",
        enable_google_search: bool = True,
        enable_url_context: bool = False,
        temperature: Optional[float] = None,
        max_output_tokens: Optional[int] = None,
        response_mime_type: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
    ) -> GenerateContentResponse:
        """
        Generate content using Google Search Grounding tool.
        
        Args:
            contents: User prompt/question (should benefit from real-time web search)
            model: Model to use (must support Google Search Grounding)
            enable_google_search: Enable Google Search Grounding tool (default: True)
            enable_url_context: Enable URL context tool (can be combined, default: False)
            temperature: Temperature for generation
            max_output_tokens: Maximum output tokens
            response_mime_type: Response MIME type (e.g., 'application/json')
            response_schema: Response schema for structured output
            
        Returns:
            GenerateContentResponse: Generated content with Google Search grounding metadata
            
        Example:
            response = await client.generate_content(
                contents="Who won the euro 2024?",
                enable_google_search=True
            )
            print(response.text)
            print(f"Search queries: {response.search_queries}")
            print(f"Citations: {response.web_citations}")
        """
        client = self._get_client()
        
        try:
            from google.genai import types
            
            # Build tools list
            tools = []
            if enable_google_search:
                tools.append({"google_search": {}})
            if enable_url_context:
                tools.append({"url_context": {}})
            
            # Build config dict
            config_dict = {}
            if tools:
                config_dict["tools"] = tools
            
            if temperature is not None:
                config_dict["temperature"] = temperature
            if max_output_tokens is not None:
                config_dict["max_output_tokens"] = max_output_tokens
            if response_mime_type:
                config_dict["response_mime_type"] = response_mime_type
            if response_schema:
                config_dict["response_schema"] = response_schema
            
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
            
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                
                # Parse grounding metadata
                if hasattr(candidate, "grounding_metadata"):
                    gm = candidate.grounding_metadata
                    
                    # Parse web search queries
                    web_search_queries = None
                    if hasattr(gm, "web_search_queries"):
                        web_search_queries = list(gm.web_search_queries) if gm.web_search_queries else None
                    
                    # Parse search entry point
                    search_entry_point = None
                    if hasattr(gm, "search_entry_point"):
                        sep = gm.search_entry_point
                        if sep:
                            # Convert to dict if it's an object
                            if hasattr(sep, "rendered_content"):
                                search_entry_point = {
                                    "rendered_content": getattr(sep, "rendered_content", None)
                                }
                            else:
                                search_entry_point = sep if isinstance(sep, dict) else None
                    
                    # Parse grounding chunks
                    grounding_chunks = []
                    if hasattr(gm, "grounding_chunks"):
                        for chunk in gm.grounding_chunks:
                            web_chunk = None
                            if hasattr(chunk, "web"):
                                web_data = chunk.web
                                if web_data:
                                    web_chunk = WebChunk(
                                        uri=getattr(web_data, "uri", None),
                                        title=getattr(web_data, "title", None),
                                    )
                            
                            grounding_chunks.append(GroundingChunk(web=web_chunk))
                    
                    # Parse grounding supports
                    grounding_supports = []
                    if hasattr(gm, "grounding_supports"):
                        for support in gm.grounding_supports:
                            segment = None
                            if hasattr(support, "segment"):
                                seg = support.segment
                                if seg:
                                    segment = {
                                        "start_index": getattr(seg, "start_index", None),
                                        "end_index": getattr(seg, "end_index", None),
                                        "text": getattr(seg, "text", None),
                                    }
                            
                            chunk_indices = None
                            if hasattr(support, "grounding_chunk_indices"):
                                indices = support.grounding_chunk_indices
                                chunk_indices = list(indices) if indices else None
                            
                            grounding_supports.append(GroundingSupport(
                                segment=segment,
                                grounding_chunk_indices=chunk_indices,
                            ))
                    
                    grounding_metadata = GroundingMetadata(
                        web_search_queries=web_search_queries,
                        search_entry_point=search_entry_point,
                        grounding_chunks=grounding_chunks if grounding_chunks else None,
                        grounding_supports=grounding_supports if grounding_supports else None,
                    )
            
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
                model=model,
                finish_reason=getattr(response, "finish_reason", None),
                usage_metadata=usage_metadata,
            )
            
        except Exception as e:
            logger.error(f"Failed to generate content: {e}")
            raise GeminiGoogleSearchError(
                message=f"Failed to generate content: {e}",
                details={
                    "model": model,
                    "enable_google_search": enable_google_search,
                    "enable_url_context": enable_url_context,
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
            contents: User prompt/question (should benefit from real-time web search)
            config: GenerateContentConfig instance
            
        Returns:
            GenerateContentResponse: Generated content with Google Search grounding metadata
            
        Example:
            config = GenerateContentConfig(
                model="gemini-3.1-flash-lite-preview",
                enable_google_search=True,
                enable_url_context=False,
                temperature=0.7
            )
            response = await client.generate_content_with_config(
                contents="What are the latest developments in AI?",
                config=config
            )
        """
        return await self.generate_content(
            contents=contents,
            model=config.model,
            enable_google_search=config.enable_google_search,
            enable_url_context=config.enable_url_context,
            temperature=config.temperature,
            max_output_tokens=config.max_output_tokens,
            response_mime_type=config.response_mime_type,
            response_schema=config.response_schema,
        )

