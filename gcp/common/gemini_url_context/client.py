"""
Gemini URL Context Client for URL context operations.

Provides async methods for:
- Generating content with URL context tool enabled
- Extracting and analyzing content from URLs
- Combining URL context with other tools (e.g., Google Search)
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List

from .config import GeminiURLContextConfig
from .models import (
    GenerateContentConfig,
    GenerateContentResponse,
    URLContextMetadata,
    URLMetadata,
    URLRetrievalStatus,
)

logger = logging.getLogger(__name__)


class GeminiURLContextError(Exception):
    """Base exception for Gemini URL Context client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class GeminiURLContextClient:
    """
    Client for Gemini URL Context API operations.
    
    Supports generating content with URL context tool enabled.
    
    Example:
        config = GeminiURLContextConfig.from_env()
        client = GeminiURLContextClient(config)
        
        # Generate content with URLs in the prompt
        response = await client.generate_content(
            contents="Compare the recipes at https://example.com/recipe1 and https://example.com/recipe2",
            enable_url_context=True
        )
        print(response.text)
        print(f"Retrieved URLs: {response.retrieved_urls}")
    """
    
    def __init__(self, config: GeminiURLContextConfig):
        """
        Initialize Gemini URL Context client.
        
        Args:
            config: GeminiURLContextConfig instance
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
        model: str = "gemini-3-flash",
        enable_url_context: bool = True,
        enable_google_search: bool = False,
        temperature: Optional[float] = None,
        max_output_tokens: Optional[int] = None,
        response_mime_type: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
    ) -> GenerateContentResponse:
        """
        Generate content using URL context tool.
        
        The URLs should be included in the contents string. The model will
        automatically extract and retrieve content from URLs mentioned in the prompt.
        
        Args:
            contents: User prompt/question (can include URLs)
            model: Model to use (must support URL context)
            enable_url_context: Enable URL context tool (default: True)
            enable_google_search: Enable Google Search tool (can be combined)
            temperature: Temperature for generation
            max_output_tokens: Maximum output tokens
            response_mime_type: Response MIME type (e.g., 'application/json')
            response_schema: Response schema for structured output
            
        Returns:
            GenerateContentResponse: Generated content with URL metadata
            
        Example:
            response = await client.generate_content(
                contents="Compare the recipes at https://example.com/recipe1 and https://example.com/recipe2",
                enable_url_context=True
            )
            print(response.text)
            print(f"Retrieved URLs: {response.retrieved_urls}")
        """
        client = self._get_client()
        
        try:
            from google.genai import types
            
            # Build tools list
            # URL context tool is specified as {"url_context": {}} per API docs
            tools = []
            if enable_url_context:
                tools.append({"url_context": {}})
            if enable_google_search:
                # Google Search can also be combined with URL context
                tools.append({"google_search": {}})
            
            # Build config
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
            
            # Parse URL context metadata
            url_context_metadata = None
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "url_context_metadata"):
                    url_meta = candidate.url_context_metadata
                    url_metadata_list = []
                    
                    if hasattr(url_meta, "url_metadata"):
                        for meta in url_meta.url_metadata:
                            # Parse status string to enum
                            status_str = getattr(meta, "url_retrieval_status", "URL_RETRIEVAL_STATUS_UNSPECIFIED")
                            try:
                                status = URLRetrievalStatus(status_str)
                            except ValueError:
                                status = URLRetrievalStatus.UNSPECIFIED
                            
                            url_metadata_list.append(URLMetadata(
                                retrieved_url=getattr(meta, "retrieved_url", ""),
                                url_retrieval_status=status
                            ))
                    
                    url_context_metadata = URLContextMetadata(
                        url_metadata=url_metadata_list
                    )
            
            # Parse usage metadata
            usage_metadata = None
            if hasattr(response, "usage_metadata"):
                um = response.usage_metadata
                usage_metadata = {
                    "prompt_token_count": getattr(um, "prompt_token_count", None),
                    "candidates_token_count": getattr(um, "candidates_token_count", None),
                    "total_token_count": getattr(um, "total_token_count", None),
                    "tool_use_prompt_token_count": getattr(um, "tool_use_prompt_token_count", None),
                }
            
            return GenerateContentResponse(
                text=text,
                url_context_metadata=url_context_metadata,
                model=model,
                finish_reason=getattr(response, "finish_reason", None),
                usage_metadata=usage_metadata,
            )
            
        except Exception as e:
            logger.error(f"Failed to generate content: {e}")
            raise GeminiURLContextError(
                message=f"Failed to generate content: {e}",
                details={
                    "model": model,
                    "enable_url_context": enable_url_context,
                    "enable_google_search": enable_google_search,
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
            contents: User prompt/question (can include URLs)
            config: GenerateContentConfig instance
            
        Returns:
            GenerateContentResponse: Generated content with URL metadata
            
        Example:
            config = GenerateContentConfig(
                model="gemini-3-flash",
                enable_url_context=True,
                enable_google_search=True,
                temperature=0.7
            )
            response = await client.generate_content_with_config(
                contents="Analyze these URLs: https://example.com/page1 https://example.com/page2",
                config=config
            )
        """
        return await self.generate_content(
            contents=contents,
            model=config.model,
            enable_url_context=config.enable_url_context,
            enable_google_search=config.enable_google_search,
            temperature=config.temperature,
            max_output_tokens=config.max_output_tokens,
            response_mime_type=config.response_mime_type,
            response_schema=config.response_schema,
        )

