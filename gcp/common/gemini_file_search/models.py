"""
Pydantic models for Gemini File Search API.

Supports:
- File Search store management
- File upload and import
- GenerateContent with File Search
- Response parsing and citations
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class FileSearchStore(BaseModel):
    """File Search store model."""
    name: str = Field(..., description="Full resource name (e.g., 'fileSearchStores/xxxxx')")
    display_name: Optional[str] = Field(None, description="Display name for the store")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    
    @property
    def store_id(self) -> str:
        """Extract store ID from name."""
        if "/" in self.name:
            return self.name.split("/")[-1]
        return self.name


class FileSearchDocument(BaseModel):
    """File Search document model."""
    name: str = Field(..., description="Full resource name")
    display_name: Optional[str] = Field(None, description="Display name")
    mime_type: Optional[str] = Field(None, description="MIME type of the document")
    size_bytes: Optional[int] = Field(None, description="Size in bytes")
    create_time: Optional[datetime] = Field(None, description="Creation timestamp")
    update_time: Optional[datetime] = Field(None, description="Last update timestamp")
    state: Optional[str] = Field(None, description="Document state (e.g., 'ACTIVE')")
    
    @property
    def document_id(self) -> str:
        """Extract document ID from name."""
        if "/" in self.name:
            return self.name.split("/")[-1]
        return self.name


class UploadConfig(BaseModel):
    """Configuration for uploading files to File Search store."""
    display_name: Optional[str] = Field(None, description="Display name for the file")
    mime_type: Optional[str] = Field(None, description="MIME type (auto-detected if not provided)")


class FileSearchConfig(BaseModel):
    """Configuration for File Search tool."""
    file_search_store_names: List[str] = Field(
        ...,
        description="List of File Search store names to search"
    )
    dynamic_retrieval_config: Optional[Dict[str, Any]] = Field(
        None,
        description="Dynamic retrieval configuration"
    )


class GenerateContentConfig(BaseModel):
    """Configuration for generateContent with File Search."""
    model: str = Field(
        default="gemini-3-pro-preview",
        description="Model to use (must support File Search)"
    )
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Temperature")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top-p sampling")
    top_k: Optional[int] = Field(None, ge=1, description="Top-k sampling")
    max_output_tokens: Optional[int] = Field(None, ge=1, description="Max output tokens")
    file_search: Optional[FileSearchConfig] = Field(
        None,
        description="File Search configuration"
    )
    response_mime_type: Optional[str] = Field(
        None,
        description="Response MIME type (e.g., 'application/json')"
    )
    response_schema: Optional[Dict[str, Any]] = Field(
        None,
        description="Response schema for structured output"
    )


class Citation(BaseModel):
    """Citation from File Search."""
    start_index: Optional[int] = Field(None, description="Start index in response text")
    end_index: Optional[int] = Field(None, description="End index in response text")
    uri: Optional[str] = Field(None, description="URI of the cited document")
    title: Optional[str] = Field(None, description="Title of the cited document")
    license: Optional[str] = Field(None, description="License information")


class GroundingMetadata(BaseModel):
    """Grounding metadata from File Search."""
    grounding_supports: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Grounding supports"
    )
    retrieval_queries: Optional[List[str]] = Field(
        None,
        description="Queries used for retrieval"
    )
    citations: Optional[List[Citation]] = Field(
        None,
        description="Citations from retrieved documents"
    )


class GenerateContentResponse(BaseModel):
    """Response from generateContent with File Search."""
    text: str = Field(..., description="Generated text content")
    grounding_metadata: Optional[GroundingMetadata] = Field(
        None,
        description="Grounding metadata including citations"
    )
    model: Optional[str] = Field(None, description="Model used")
    finish_reason: Optional[str] = Field(None, description="Finish reason")
    
    @property
    def citations(self) -> List[Citation]:
        """Get citations from grounding metadata."""
        if self.grounding_metadata and self.grounding_metadata.citations:
            return self.grounding_metadata.citations
        return []
    
    @property
    def has_citations(self) -> bool:
        """Check if response has citations."""
        return len(self.citations) > 0


class OperationStatus(str, Enum):
    """Operation status."""
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"


class Operation(BaseModel):
    """Long-running operation model."""
    name: str = Field(..., description="Operation name")
    done: bool = Field(default=False, description="Whether operation is complete")
    error: Optional[Dict[str, Any]] = Field(None, description="Error if operation failed")
    response: Optional[Dict[str, Any]] = Field(None, description="Response if operation succeeded")
    
    @property
    def status(self) -> OperationStatus:
        """Get operation status."""
        if self.done:
            if self.error:
                return OperationStatus.FAILED
            return OperationStatus.DONE
        return OperationStatus.PENDING

