"""
Pydantic models for Gemini URL Context API.

Supports:
- URL context tool configuration
- GenerateContent with URL context
- Response parsing and URL metadata
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class URLRetrievalStatus(str, Enum):
    """URL retrieval status."""
    SUCCESS = "URL_RETRIEVAL_STATUS_SUCCESS"
    FAILED = "URL_RETRIEVAL_STATUS_FAILED"
    UNSAFE = "URL_RETRIEVAL_STATUS_UNSAFE"
    UNSPECIFIED = "URL_RETRIEVAL_STATUS_UNSPECIFIED"


class URLMetadata(BaseModel):
    """Metadata for a single URL retrieval."""
    retrieved_url: str = Field(..., description="The URL that was retrieved")
    url_retrieval_status: URLRetrievalStatus = Field(
        ...,
        description="Status of the URL retrieval"
    )


class URLContextMetadata(BaseModel):
    """URL context metadata from the response."""
    url_metadata: List[URLMetadata] = Field(
        default_factory=list,
        description="List of URLs retrieved and their status"
    )
    
    @property
    def successful_urls(self) -> List[str]:
        """Get list of successfully retrieved URLs."""
        return [
            meta.retrieved_url
            for meta in self.url_metadata
            if meta.url_retrieval_status == URLRetrievalStatus.SUCCESS
        ]
    
    @property
    def failed_urls(self) -> List[str]:
        """Get list of failed URLs."""
        return [
            meta.retrieved_url
            for meta in self.url_metadata
            if meta.url_retrieval_status == URLRetrievalStatus.FAILED
        ]
    
    @property
    def unsafe_urls(self) -> List[str]:
        """Get list of URLs that failed safety checks."""
        return [
            meta.retrieved_url
            for meta in self.url_metadata
            if meta.url_retrieval_status == URLRetrievalStatus.UNSAFE
        ]
    
    @property
    def has_successful_urls(self) -> bool:
        """Check if any URLs were successfully retrieved."""
        return len(self.successful_urls) > 0


class GenerateContentConfig(BaseModel):
    """Configuration for generateContent with URL context."""
    model: str = Field(
        default="gemini-3.1-flash-lite",
        description="Model to use (must support URL context)"
    )
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Temperature")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top-p sampling")
    top_k: Optional[int] = Field(None, ge=1, description="Top-k sampling")
    max_output_tokens: Optional[int] = Field(None, ge=1, description="Max output tokens")
    enable_url_context: bool = Field(
        default=True,
        description="Enable URL context tool"
    )
    enable_google_search: bool = Field(
        default=False,
        description="Enable Google Search tool (can be combined with URL context)"
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
    """Response from generateContent with URL context."""
    text: str = Field(..., description="Generated text content")
    url_context_metadata: Optional[URLContextMetadata] = Field(
        None,
        description="Metadata about URLs retrieved for context"
    )
    model: Optional[str] = Field(None, description="Model used")
    finish_reason: Optional[str] = Field(None, description="Finish reason")
    usage_metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Token usage metadata"
    )
    
    @property
    def retrieved_urls(self) -> List[str]:
        """Get list of successfully retrieved URLs."""
        if self.url_context_metadata:
            return self.url_context_metadata.successful_urls
        return []
    
    @property
    def has_url_context(self) -> bool:
        """Check if response used URL context."""
        return self.url_context_metadata is not None and self.url_context_metadata.has_successful_urls
    
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
    
    @property
    def tool_use_prompt_token_count(self) -> Optional[int]:
        """Get tool use prompt token count (includes URL content tokens)."""
        if self.usage_metadata:
            return self.usage_metadata.get("tool_use_prompt_token_count")
        return None

