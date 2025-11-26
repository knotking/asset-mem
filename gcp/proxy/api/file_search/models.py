# Gemini File Search API Data Models
# Pydantic models for file metadata, search stores, and API requests/responses

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
import uuid


class FileStatus(str, Enum):
    """Status of a file in the Gemini File Search system."""
    PENDING = "pending"           # File uploaded, not yet processed
    PROCESSING = "processing"     # File being processed by Gemini
    ACTIVE = "active"             # File ready for search
    FAILED = "failed"             # Processing failed
    EXPIRED = "expired"           # File TTL expired (Gemini files expire after 48 hours)
    DELETED = "deleted"           # File manually deleted


class StoreType(str, Enum):
    """Type of file search store."""
    USER_DOCUMENTS = "USER_DOCUMENTS"       # User-uploaded documents
    PROPERTY_DOCUMENTS = "PROPERTY_DOCUMENTS"  # Property-specific documents
    KNOWLEDGE_BASE = "KNOWLEDGE_BASE"       # General knowledge base


class FileMetadata(BaseModel):
    """
    Metadata for a file stored in Gemini File Search.
    Maps user context (user_id, property_id) to Gemini file resources.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # User context
    user_id: str
    property_id: Optional[str] = None
    
    # File information
    original_filename: str
    gcs_url: str                           # Original GCS location (e.g., "gs://bucket/path")
    mime_type: str
    file_size_bytes: int = 0
    
    # Gemini File Search references
    gemini_file_id: Optional[str] = None   # e.g., "files/abc123"
    gemini_file_uri: Optional[str] = None   # Gemini file URI
    store_id: Optional[str] = None          # Reference to FileSearchStore
    
    # Status tracking
    status: FileStatus = FileStatus.PENDING
    error_message: Optional[str] = None
    
    # Timestamps (UTC)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None   # Gemini files expire after 48 hours
    
    # Additional metadata
    tags: List[str] = Field(default_factory=list)
    custom_metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # Document analysis results (if available)
    document_type: Optional[str] = None
    extracted_address: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class FileSearchStore(BaseModel):
    """
    A Gemini File Search Store groups files for a specific user/property context.
    Stores are created per user or per property for efficient querying.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Context
    user_id: str
    property_id: Optional[str] = None
    store_type: StoreType = StoreType.USER_DOCUMENTS
    
    # Gemini references
    gemini_store_name: Optional[str] = None  # e.g., "fileSearchStores/xyz789"
    display_name: str
    
    # Configuration
    max_files: int = 100                     # Maximum files per store
    
    # Status
    is_active: bool = True
    file_count: int = 0
    
    # Timestamps (UTC)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class FileUploadRequest(BaseModel):
    """Request to upload a file to Gemini File Search."""
    user_id: str
    gcs_url: str                            # GCS URL of the file to upload (e.g., "gs://bucket/path")
    property_id: Optional[str] = None
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    custom_metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # If True, add to existing store; if False, create new store
    use_existing_store: bool = True
    store_type: StoreType = StoreType.USER_DOCUMENTS


class FileSearchQuery(BaseModel):
    """Query parameters for searching files."""
    user_id: str
    query: str
    property_id: Optional[str] = None
    store_ids: Optional[List[str]] = None   # Specific stores to search
    file_ids: Optional[List[str]] = None    # Specific files to search (metadata IDs)
    gemini_file_ids: Optional[List[str]] = None  # Direct Gemini file IDs (e.g., "files/abc123")
    max_results: int = 10
    include_citations: bool = True


class FileSearchResult(BaseModel):
    """Result from a file search query."""
    query: str
    results: List[Dict[str, Any]] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    total_results: int = 0
    files_searched: List[str] = Field(default_factory=list)
    
    # Performance metrics
    search_duration_ms: Optional[float] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class FileListRequest(BaseModel):
    """Request to list files for a user."""
    user_id: str
    property_id: Optional[str] = None
    status: Optional[FileStatus] = None
    limit: int = 100
    offset: int = 0
    order_by: str = "created_at"
    order_desc: bool = True


class FileDeleteRequest(BaseModel):
    """Request to delete files."""
    user_id: str
    file_ids: List[str]
    delete_from_gemini: bool = True


class StoreCreateRequest(BaseModel):
    """Request to create a new file search store."""
    user_id: str
    property_id: Optional[str] = None
    display_name: str
    store_type: StoreType = StoreType.USER_DOCUMENTS


class BatchUploadRequest(BaseModel):
    """Request to upload multiple files."""
    user_id: str
    files: List[FileUploadRequest]
    property_id: Optional[str] = None


class FileUploadResponse(BaseModel):
    """Response from file upload operation."""
    success: bool
    file_id: Optional[str] = None
    gemini_file_id: Optional[str] = None
    status: FileStatus = FileStatus.PENDING
    message: str = ""
    error: Optional[str] = None


class BatchUploadResponse(BaseModel):
    """Response from batch upload operation."""
    success: bool
    total_files: int
    successful_uploads: int
    failed_uploads: int
    results: List[FileUploadResponse] = Field(default_factory=list)

