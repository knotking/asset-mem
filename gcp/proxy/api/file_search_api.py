"""
File Search API Endpoints

This module provides REST API endpoints for Gemini File Search operations.
These endpoints are used by webapp and mobile app to:
- Upload files for processing
- List user's files
- Query files with semantic search
- Manage file search stores

All endpoints require user authentication (user_id in request).
"""

import logging
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from gemini_file_search import (
    GeminiFileSearchClient,
    FileUploadRequest,
    FileUploadResponse,
    CreateStoreRequest,
    FileSearchQueryRequest,
    FileSearchQueryResponse,
    GeminiFileMetadata,
    FileSearchStore,
    FileStatus,
)

logger = logging.getLogger(__name__)

# Create router for file search endpoints
router = APIRouter(prefix="/file-search", tags=["File Search"])

# Lazy-loaded client
_client: Optional[GeminiFileSearchClient] = None


def get_client() -> GeminiFileSearchClient:
    """Get or create the file search client."""
    global _client
    if _client is None:
        _client = GeminiFileSearchClient()
    return _client


# ============================================================================
# Request/Response Models
# ============================================================================

class FileUploadRequestBody(BaseModel):
    """Request body for file upload."""
    user_id: str
    gcs_urls: List[str]
    property_id: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


class CreateStoreRequestBody(BaseModel):
    """Request body for creating a file search store."""
    user_id: str
    name: str
    file_ids: List[str]
    property_id: Optional[str] = None
    description: Optional[str] = None


class QueryRequestBody(BaseModel):
    """Request body for querying files."""
    user_id: str
    query: str
    store_ids: Optional[List[str]] = None
    file_ids: Optional[List[str]] = None
    property_id: Optional[str] = None
    top_k: int = 10


class ListFilesRequestBody(BaseModel):
    """Request body for listing files."""
    user_id: str
    property_id: Optional[str] = None
    status: Optional[str] = None
    limit: int = 100


class FileMetadataResponse(BaseModel):
    """Response model for file metadata."""
    id: str
    user_id: str
    property_id: Optional[str]
    gcs_url: str
    gemini_file_id: str
    original_filename: str
    mime_type: str
    file_size_bytes: int
    status: str
    created_at: str
    expires_at: str
    
    @classmethod
    def from_metadata(cls, metadata: GeminiFileMetadata) -> "FileMetadataResponse":
        return cls(
            id=metadata.id,
            user_id=metadata.user_id,
            property_id=metadata.property_id,
            gcs_url=metadata.gcs_url,
            gemini_file_id=metadata.gemini_file_id,
            original_filename=metadata.original_filename,
            mime_type=metadata.mime_type,
            file_size_bytes=metadata.file_size_bytes,
            status=metadata.status.value,
            created_at=metadata.created_at.isoformat() if metadata.created_at else "",
            expires_at=metadata.expires_at.isoformat() if metadata.expires_at else "",
        )


class FileStoreResponse(BaseModel):
    """Response model for file search store."""
    id: str
    store_id: str
    user_id: str
    property_id: Optional[str]
    name: str
    description: Optional[str]
    file_ids: List[str]
    status: str
    created_at: str
    
    @classmethod
    def from_store(cls, store: FileSearchStore) -> "FileStoreResponse":
        return cls(
            id=store.id,
            store_id=store.store_id,
            user_id=store.user_id,
            property_id=store.property_id,
            name=store.name,
            description=store.description,
            file_ids=store.file_ids,
            status=store.status.value,
            created_at=store.created_at.isoformat() if store.created_at else "",
        )


# ============================================================================
# File Upload Endpoints
# ============================================================================

@router.post("/upload", response_model=FileUploadResponse)
async def upload_files(request: FileUploadRequestBody):
    """
    Upload files to Gemini File Search.
    
    Files are uploaded asynchronously via Pub/Sub. For immediate upload,
    use the /upload-sync endpoint.
    
    Args:
        request: FileUploadRequestBody with user_id and gcs_urls
        
    Returns:
        FileUploadResponse with status and message
    """
    logger.info(f"Upload request from user {request.user_id}: {len(request.gcs_urls)} files")
    
    try:
        client = get_client()
        
        # Publish to Pub/Sub for async processing
        message_id = client.publish_file_upload(
            user_id=request.user_id,
            gcs_urls=request.gcs_urls,
            property_id=request.property_id,
            metadata=request.metadata,
        )
        
        return FileUploadResponse(
            success=True,
            message=f"Files queued for processing. Message ID: {message_id}",
            file_ids=[],
            errors=[],
        )
        
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-sync", response_model=FileUploadResponse)
async def upload_files_sync(request: FileUploadRequestBody):
    """
    Upload files synchronously (blocking).
    
    Use this for immediate file availability. For batch uploads,
    use the async /upload endpoint.
    
    Args:
        request: FileUploadRequestBody with user_id and gcs_urls
        
    Returns:
        FileUploadResponse with file IDs
    """
    logger.info(f"Sync upload request from user {request.user_id}: {len(request.gcs_urls)} files")
    
    try:
        client = get_client()
        
        response = await client.upload_files_batch(
            FileUploadRequest(
                user_id=request.user_id,
                gcs_urls=request.gcs_urls,
                property_id=request.property_id,
                metadata=request.metadata,
            )
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Sync upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# File List/Get Endpoints
# ============================================================================

@router.post("/files/list")
async def list_files(request: ListFilesRequestBody) -> List[FileMetadataResponse]:
    """
    List files for a user.
    
    Args:
        request: ListFilesRequestBody with filters
        
    Returns:
        List of FileMetadataResponse
    """
    try:
        client = get_client()
        
        status = FileStatus(request.status) if request.status else None
        
        files = await client.list_files(
            user_id=request.user_id,
            property_id=request.property_id,
            status=status,
            limit=request.limit,
        )
        
        return [FileMetadataResponse.from_metadata(f) for f in files]
        
    except Exception as e:
        logger.error(f"List files failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/{doc_id}")
async def get_file(doc_id: str, user_id: str) -> FileMetadataResponse:
    """
    Get a specific file by ID.
    
    Args:
        doc_id: Document ID
        user_id: User ID for authorization
        
    Returns:
        FileMetadataResponse
    """
    try:
        client = get_client()
        
        file_metadata = await client.get_file(doc_id, user_id)
        
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileMetadataResponse.from_metadata(file_metadata)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get file failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/files/{doc_id}")
async def delete_file(doc_id: str, user_id: str):
    """
    Delete a file.
    
    Args:
        doc_id: Document ID
        user_id: User ID for authorization
        
    Returns:
        Success status
    """
    try:
        client = get_client()
        
        success = await client.delete_file(doc_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="File not found or delete failed")
        
        return {"success": True, "message": "File deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete file failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# File Search Store Endpoints
# ============================================================================

@router.post("/stores/create", response_model=FileStoreResponse)
async def create_store(request: CreateStoreRequestBody):
    """
    Create a File Search Store.
    
    A store groups files together for querying.
    
    Args:
        request: CreateStoreRequestBody
        
    Returns:
        FileStoreResponse
    """
    try:
        client = get_client()
        
        store = await client.create_file_search_store(
            user_id=request.user_id,
            name=request.name,
            file_ids=request.file_ids,
            property_id=request.property_id,
            description=request.description,
        )
        
        return FileStoreResponse.from_store(store)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Create store failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stores/{store_id}")
async def get_store(store_id: str, user_id: str) -> FileStoreResponse:
    """
    Get a specific store by ID.
    
    Args:
        store_id: Store ID
        user_id: User ID for authorization
        
    Returns:
        FileStoreResponse
    """
    try:
        client = get_client()
        
        store = await client.get_file_search_store(store_id, user_id)
        
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        
        return FileStoreResponse.from_store(store)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get store failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stores/list")
async def list_stores(user_id: str, property_id: Optional[str] = None) -> List[FileStoreResponse]:
    """
    List stores for a user.
    
    Args:
        user_id: User ID
        property_id: Optional property ID filter
        
    Returns:
        List of FileStoreResponse
    """
    try:
        client = get_client()
        
        stores = await client.list_file_search_stores(
            user_id=user_id,
            property_id=property_id,
        )
        
        return [FileStoreResponse.from_store(s) for s in stores]
        
    except Exception as e:
        logger.error(f"List stores failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/stores/{store_id}")
async def delete_store(store_id: str, user_id: str):
    """
    Delete a store.
    
    Args:
        store_id: Store ID
        user_id: User ID for authorization
        
    Returns:
        Success status
    """
    try:
        client = get_client()
        
        success = await client.delete_file_search_store(store_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Store not found or delete failed")
        
        return {"success": True, "message": "Store deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete store failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Query Endpoints
# ============================================================================

@router.post("/query", response_model=FileSearchQueryResponse)
async def query_files(request: QueryRequestBody):
    """
    Query files using semantic search.
    
    Search across user's files or specific stores/files.
    
    Args:
        request: QueryRequestBody with query and filters
        
    Returns:
        FileSearchQueryResponse with results
    """
    logger.info(f"Query from user {request.user_id}: {request.query[:50]}...")
    
    try:
        client = get_client()
        
        response = await client.query_files(
            user_id=request.user_id,
            query=request.query,
            store_ids=request.store_ids,
            file_ids=request.file_ids,
            property_id=request.property_id,
            top_k=request.top_k,
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Refresh Endpoints
# ============================================================================

@router.post("/files/{doc_id}/refresh")
async def refresh_file(doc_id: str, user_id: str) -> FileMetadataResponse:
    """
    Refresh a file (re-upload to Gemini before expiry).
    
    Args:
        doc_id: Document ID
        user_id: User ID for authorization
        
    Returns:
        Updated FileMetadataResponse
    """
    try:
        client = get_client()
        
        file_metadata = await client.refresh_file(doc_id, user_id)
        
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileMetadataResponse.from_metadata(file_metadata)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Refresh file failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Health Check
# ============================================================================

@router.get("/health")
async def health_check():
    """Health check for file search service."""
    return {
        "status": "ok",
        "service": "gemini-file-search",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
