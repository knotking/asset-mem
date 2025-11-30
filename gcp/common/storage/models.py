"""
Pydantic models for GCP Storage API.

Supports:
- Bucket management
- Blob operations
- Metadata handling
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum


class StorageClass(str, Enum):
    """Storage class options."""
    STANDARD = "STANDARD"
    NEARLINE = "NEARLINE"
    COLDLINE = "COLDLINE"
    ARCHIVE = "ARCHIVE"


class PredefinedAcl(str, Enum):
    """Predefined ACL options."""
    AUTHENTICATED_READ = "authenticatedRead"
    BUCKET_OWNER_FULL_CONTROL = "bucketOwnerFullControl"
    BUCKET_OWNER_READ = "bucketOwnerRead"
    PRIVATE = "private"
    PROJECT_PRIVATE = "projectPrivate"
    PUBLIC_READ = "publicRead"
    PUBLIC_READ_WRITE = "publicReadWrite"


class BucketMetadata(BaseModel):
    """Bucket metadata model."""
    name: str = Field(..., description="Bucket name")
    location: Optional[str] = Field(None, description="Bucket location")
    storage_class: Optional[str] = Field(None, description="Storage class")
    created: Optional[datetime] = Field(None, description="Creation timestamp")
    updated: Optional[datetime] = Field(None, description="Last update timestamp")
    labels: Optional[Dict[str, str]] = Field(None, description="Bucket labels")
    versioning_enabled: Optional[bool] = Field(None, description="Whether versioning is enabled")
    lifecycle_rules: Optional[List[Dict[str, Any]]] = Field(None, description="Lifecycle rules")
    cors: Optional[List[Dict[str, Any]]] = Field(None, description="CORS configuration")
    website: Optional[Dict[str, Any]] = Field(None, description="Website configuration")
    encryption: Optional[Dict[str, Any]] = Field(None, description="Encryption configuration")


class Bucket(BaseModel):
    """Bucket model."""
    name: str = Field(..., description="Bucket name")
    metadata: Optional[BucketMetadata] = Field(None, description="Bucket metadata")


class BlobMetadata(BaseModel):
    """Blob metadata model."""
    name: str = Field(..., description="Blob name")
    bucket: str = Field(..., description="Bucket name")
    size: Optional[int] = Field(None, description="Size in bytes")
    content_type: Optional[str] = Field(None, description="Content type (MIME type)")
    etag: Optional[str] = Field(None, description="ETag")
    md5_hash: Optional[str] = Field(None, description="MD5 hash")
    crc32c: Optional[str] = Field(None, description="CRC32C checksum")
    created: Optional[datetime] = Field(None, description="Creation timestamp")
    updated: Optional[datetime] = Field(None, description="Last update timestamp")
    time_deleted: Optional[datetime] = Field(None, description="Deletion timestamp")
    metadata: Optional[Dict[str, str]] = Field(None, description="Custom metadata")
    cache_control: Optional[str] = Field(None, description="Cache control header")
    content_disposition: Optional[str] = Field(None, description="Content disposition header")
    content_encoding: Optional[str] = Field(None, description="Content encoding")
    content_language: Optional[str] = Field(None, description="Content language")
    storage_class: Optional[str] = Field(None, description="Storage class")
    generation: Optional[int] = Field(None, description="Generation number")
    metageneration: Optional[int] = Field(None, description="Metageneration number")


class Blob(BaseModel):
    """Blob model."""
    name: str = Field(..., description="Blob name")
    bucket: str = Field(..., description="Bucket name")
    metadata: Optional[BlobMetadata] = Field(None, description="Blob metadata")
    
    @property
    def path(self) -> str:
        """Get full path: gs://bucket/name"""
        return f"gs://{self.bucket}/{self.name}"


class UploadConfig(BaseModel):
    """Configuration for uploading blobs."""
    content_type: Optional[str] = Field(None, description="Content type (MIME type)")
    metadata: Optional[Dict[str, str]] = Field(None, description="Custom metadata")
    cache_control: Optional[str] = Field(None, description="Cache control header")
    content_disposition: Optional[str] = Field(None, description="Content disposition header")
    content_encoding: Optional[str] = Field(None, description="Content encoding")
    content_language: Optional[str] = Field(None, description="Content language")
    predefined_acl: Optional[str] = Field(None, description="Predefined ACL")
    if_generation_match: Optional[int] = Field(None, description="Upload only if generation matches")
    if_generation_not_match: Optional[int] = Field(None, description="Upload only if generation doesn't match")
    if_metageneration_match: Optional[int] = Field(None, description="Upload only if metageneration matches")
    if_metageneration_not_match: Optional[int] = Field(None, description="Upload only if metageneration doesn't match")


class DownloadConfig(BaseModel):
    """Configuration for downloading blobs."""
    start: Optional[int] = Field(None, description="Start byte offset")
    end: Optional[int] = Field(None, description="End byte offset")
    if_generation_match: Optional[int] = Field(None, description="Download only if generation matches")
    if_generation_not_match: Optional[int] = Field(None, description="Download only if generation doesn't match")
    if_metageneration_match: Optional[int] = Field(None, description="Download only if metageneration matches")
    if_metageneration_not_match: Optional[int] = Field(None, description="Download only if metageneration doesn't match")


class CopyConfig(BaseModel):
    """Configuration for copying blobs."""
    content_type: Optional[str] = Field(None, description="Content type (MIME type)")
    metadata: Optional[Dict[str, str]] = Field(None, description="Custom metadata")
    cache_control: Optional[str] = Field(None, description="Cache control header")
    content_disposition: Optional[str] = Field(None, description="Content disposition header")
    content_encoding: Optional[str] = Field(None, description="Content encoding")
    content_language: Optional[str] = Field(None, description="Content language")
    predefined_acl: Optional[str] = Field(None, description="Predefined ACL")
    if_generation_match: Optional[int] = Field(None, description="Copy only if generation matches")
    if_generation_not_match: Optional[int] = Field(None, description="Copy only if generation doesn't match")
    if_metageneration_match: Optional[int] = Field(None, description="Copy only if metageneration matches")
    if_metageneration_not_match: Optional[int] = Field(None, description="Copy only if metageneration doesn't match")
    if_source_generation_match: Optional[int] = Field(None, description="Copy only if source generation matches")
    if_source_generation_not_match: Optional[int] = Field(None, description="Copy only if source generation doesn't match")
    if_source_metageneration_match: Optional[int] = Field(None, description="Copy only if source metageneration matches")
    if_source_metageneration_not_match: Optional[int] = Field(None, description="Copy only if source metageneration doesn't match")


class SignedUrlConfig(BaseModel):
    """Configuration for generating signed URLs."""
    expiration: int = Field(3600, description="Expiration time in seconds (default: 3600)")
    method: str = Field("GET", description="HTTP method (default: GET)")
    content_type: Optional[str] = Field(None, description="Content type for PUT requests")
    response_type: Optional[str] = Field(None, description="Response content type")
    response_disposition: Optional[str] = Field(None, description="Response content disposition")
    version: Optional[str] = Field("v4", description="Signature version (v2 or v4, default: v4)")

