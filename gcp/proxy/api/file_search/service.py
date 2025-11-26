# Gemini File Search Service
# Main service for uploading, managing, and searching files using Gemini File Search API

import os
import logging
import time
import mimetypes
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import google.generativeai as genai
from google.cloud import storage

from .models import (
    FileMetadata,
    FileSearchStore,
    FileUploadRequest,
    FileSearchQuery,
    FileSearchResult,
    FileStatus,
    StoreType,
    FileListRequest,
    FileDeleteRequest,
    StoreCreateRequest,
    BatchUploadRequest,
    FileUploadResponse,
    BatchUploadResponse,
)
from .firestore_client import FileSearchFirestoreClient

logger = logging.getLogger(__name__)


class GeminiFileSearchService:
    """
    Service for managing files in Gemini File Search API.
    
    This service provides:
    - File upload to Gemini File Search
    - File metadata management in Firestore
    - File search queries using Gemini's RAG capabilities
    - Automatic file expiry handling (Gemini files expire after 48 hours)
    
    Architecture:
    1. Files are stored in GCS (existing infrastructure)
    2. Files are uploaded to Gemini File Search API for indexing
    3. Metadata (user_id, timestamps, references) stored in Firestore
    4. Search queries use Gemini's built-in RAG with citations
    """
    
    # Gemini File Search files expire after 48 hours
    FILE_EXPIRY_HOURS = 48
    
    # Supported file types for Gemini File Search
    SUPPORTED_MIME_TYPES = {
        # Documents
        "application/pdf",
        "text/plain",
        "text/html",
        "text/css",
        "text/javascript",
        "application/json",
        "application/xml",
        "text/xml",
        "text/markdown",
        "text/csv",
        
        # Office documents
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        
        # Code
        "text/x-python",
        "text/x-java",
        "text/x-c",
        "text/x-cpp",
        "text/x-typescript",
        
        # Images (for multimodal)
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
    }
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        project_id: Optional[str] = None,
        gcs_bucket: Optional[str] = None,
    ):
        """
        Initialize Gemini File Search Service.
        
        Args:
            api_key: Gemini API key (defaults to GEMINI_API_KEY env var)
            project_id: GCP project ID (defaults to GCP_PROJECT_ID env var)
            gcs_bucket: GCS bucket for file storage (defaults to GCS_BUCKET env var)
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.project_id = project_id or os.environ.get("GCP_PROJECT_ID")
        self.gcs_bucket = gcs_bucket or os.environ.get("GCS_BUCKET")
        
        # Initialize Gemini client
        if self.api_key:
            genai.configure(api_key=self.api_key)
        
        # Initialize Firestore client for metadata
        self.firestore = FileSearchFirestoreClient(project_id=self.project_id)
        
        # Initialize GCS client
        self.storage_client = storage.Client(project=self.project_id)
        
        logger.info(f"Initialized GeminiFileSearchService for project: {self.project_id}")
    
    # ==================== File Upload Operations ====================
    
    def upload_file(self, request: FileUploadRequest) -> FileUploadResponse:
        """
        Upload a file to Gemini File Search API.
        
        Flow:
        1. Download file from GCS to temp location
        2. Upload to Gemini File Search API
        3. Store metadata in Firestore
        4. Return upload result
        """
        try:
            # Determine content type
            content_type = request.content_type
            if not content_type:
                content_type, _ = mimetypes.guess_type(request.gcs_uri)
                content_type = content_type or "application/octet-stream"
            
            # Validate content type
            if content_type not in self.SUPPORTED_MIME_TYPES:
                logger.warning(f"Unsupported content type: {content_type}")
            
            # Get file info from GCS
            gcs_path = request.gcs_uri.replace("gs://", "")
            bucket_name = gcs_path.split("/")[0]
            blob_path = "/".join(gcs_path.split("/")[1:])
            
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            
            if not blob.exists():
                return FileUploadResponse(
                    success=False,
                    status=FileStatus.FAILED,
                    error=f"File not found in GCS: {request.gcs_uri}",
                )
            
            # Get file size
            blob.reload()
            file_size = blob.size or 0
            
            # Create file metadata record
            original_filename = request.original_filename or blob_path.split("/")[-1]
            
            file_metadata = FileMetadata(
                user_id=request.user_id,
                property_id=request.property_id,
                original_filename=original_filename,
                gcs_uri=request.gcs_uri,
                content_type=content_type,
                file_size_bytes=file_size,
                status=FileStatus.PROCESSING,
                tags=request.tags,
                custom_metadata=request.custom_metadata,
            )
            
            # Get or create store
            if request.use_existing_store:
                store = self.firestore.get_or_create_user_store(
                    user_id=request.user_id,
                    property_id=request.property_id,
                    store_type=request.store_type,
                )
                file_metadata.store_id = store.id
            
            # Save initial metadata
            self.firestore.create_file(file_metadata)
            
            # Download file content
            file_content = blob.download_as_bytes()
            
            # Upload to Gemini File Search API
            try:
                gemini_file = genai.upload_file(
                    path=None,
                    data=file_content,
                    mime_type=content_type,
                    display_name=original_filename,
                )
                
                # Wait for processing
                while gemini_file.state.name == "PROCESSING":
                    logger.info(f"Waiting for Gemini to process file: {gemini_file.name}")
                    time.sleep(2)
                    gemini_file = genai.get_file(gemini_file.name)
                
                if gemini_file.state.name == "FAILED":
                    raise Exception(f"Gemini file processing failed: {gemini_file.name}")
                
                # Calculate expiry time
                expires_at = datetime.now(timezone.utc) + timedelta(hours=self.FILE_EXPIRY_HOURS)
                
                # Update metadata with Gemini references
                self.firestore.update_file_status(
                    file_id=file_metadata.id,
                    status=FileStatus.ACTIVE,
                    gemini_file_name=gemini_file.name,
                    gemini_file_uri=gemini_file.uri,
                    expires_at=expires_at,
                )
                
                # Update store file count
                if file_metadata.store_id:
                    self.firestore.increment_store_file_count(file_metadata.store_id)
                
                logger.info(f"Successfully uploaded file to Gemini: {gemini_file.name}")
                
                return FileUploadResponse(
                    success=True,
                    file_id=file_metadata.id,
                    gemini_file_name=gemini_file.name,
                    status=FileStatus.ACTIVE,
                    message=f"File uploaded successfully. Expires at: {expires_at.isoformat()}",
                )
                
            except Exception as e:
                logger.error(f"Failed to upload to Gemini: {e}")
                self.firestore.update_file_status(
                    file_id=file_metadata.id,
                    status=FileStatus.FAILED,
                    error_message=str(e),
                )
                return FileUploadResponse(
                    success=False,
                    file_id=file_metadata.id,
                    status=FileStatus.FAILED,
                    error=str(e),
                )
            
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return FileUploadResponse(
                success=False,
                status=FileStatus.FAILED,
                error=str(e),
            )
    
    def batch_upload(self, request: BatchUploadRequest) -> BatchUploadResponse:
        """Upload multiple files in a batch."""
        results = []
        successful = 0
        failed = 0
        
        for file_request in request.files:
            # Override user_id and property_id from batch request
            file_request.user_id = request.user_id
            if request.property_id:
                file_request.property_id = request.property_id
            
            result = self.upload_file(file_request)
            results.append(result)
            
            if result.success:
                successful += 1
            else:
                failed += 1
        
        return BatchUploadResponse(
            success=failed == 0,
            total_files=len(request.files),
            successful_uploads=successful,
            failed_uploads=failed,
            results=results,
        )
    
    # ==================== File Search Operations ====================
    
    def search(self, query: FileSearchQuery) -> FileSearchResult:
        """
        Search files using Gemini File Search.
        
        Uses Gemini's built-in RAG capabilities with file grounding.
        """
        start_time = time.time()
        
        try:
            # Get Gemini file names to search
            if query.file_ids:
                # Get specific files
                gemini_files = []
                for file_id in query.file_ids:
                    file_meta = self.firestore.get_file(file_id)
                    if file_meta and file_meta.gemini_file_name:
                        gemini_files.append(file_meta.gemini_file_name)
            else:
                # Get all active files for user
                gemini_files = self.firestore.get_gemini_file_names_for_context(
                    user_id=query.user_id,
                    context_doc_uris=None,  # Get all
                )
            
            if not gemini_files:
                return FileSearchResult(
                    query=query.query,
                    results=[],
                    citations=[],
                    total_results=0,
                    files_searched=[],
                    search_duration_ms=(time.time() - start_time) * 1000,
                )
            
            # Use Gemini model with file grounding
            model = genai.GenerativeModel("gemini-2.0-flash")
            
            # Get file objects
            file_objects = []
            for file_name in gemini_files[:20]:  # Limit to 20 files per query
                try:
                    file_obj = genai.get_file(file_name)
                    if file_obj.state.name == "ACTIVE":
                        file_objects.append(file_obj)
                except Exception as e:
                    logger.warning(f"Could not get file {file_name}: {e}")
            
            if not file_objects:
                return FileSearchResult(
                    query=query.query,
                    results=[{"text": "No active files available for search."}],
                    citations=[],
                    total_results=0,
                    files_searched=[],
                    search_duration_ms=(time.time() - start_time) * 1000,
                )
            
            # Create content with files
            content = [query.query] + file_objects
            
            # Generate response with file grounding
            response = model.generate_content(
                content,
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=2048,
                ),
            )
            
            # Extract results and citations
            results = []
            citations = []
            
            if response.text:
                results.append({"text": response.text})
            
            # Extract grounding metadata if available
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata'):
                    grounding = candidate.grounding_metadata
                    if hasattr(grounding, 'grounding_chunks'):
                        for chunk in grounding.grounding_chunks:
                            citations.append({
                                "source": getattr(chunk, 'source', 'Unknown'),
                                "text": getattr(chunk, 'text', ''),
                            })
            
            duration_ms = (time.time() - start_time) * 1000
            
            return FileSearchResult(
                query=query.query,
                results=results,
                citations=citations,
                total_results=len(results),
                files_searched=[f.name for f in file_objects],
                search_duration_ms=duration_ms,
            )
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return FileSearchResult(
                query=query.query,
                results=[{"error": str(e)}],
                citations=[],
                total_results=0,
                files_searched=[],
                search_duration_ms=(time.time() - start_time) * 1000,
            )
    
    def retrieve_for_context(
        self,
        user_id: str,
        user_query: str,
        context_doc_uris: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Retrieve relevant content for agent context.
        
        This method is designed to be called by agents to get grounded context
        for their responses. Returns a list of relevant text chunks.
        """
        # Get Gemini file names for the context
        gemini_files = self.firestore.get_gemini_file_names_for_context(
            user_id=user_id,
            context_doc_uris=context_doc_uris,
        )
        
        if not gemini_files:
            return ["No matching documents found."]
        
        # Perform search
        result = self.search(FileSearchQuery(
            user_id=user_id,
            query=user_query,
            file_ids=None,  # Use the resolved files
            max_results=10,
            include_citations=True,
        ))
        
        # Return text results
        return [r.get("text", "") for r in result.results if r.get("text")]
    
    # ==================== File Management Operations ====================
    
    def list_files(self, request: FileListRequest) -> List[FileMetadata]:
        """List files for a user."""
        return self.firestore.list_files(request)
    
    def get_file(self, file_id: str) -> Optional[FileMetadata]:
        """Get file by ID."""
        return self.firestore.get_file(file_id)
    
    def delete_files(self, request: FileDeleteRequest) -> Dict[str, Any]:
        """Delete files from Firestore and optionally from Gemini."""
        deleted = []
        failed = []
        
        for file_id in request.file_ids:
            try:
                file_meta = self.firestore.get_file(file_id)
                if not file_meta:
                    failed.append({"file_id": file_id, "error": "File not found"})
                    continue
                
                # Verify ownership
                if file_meta.user_id != request.user_id:
                    failed.append({"file_id": file_id, "error": "Unauthorized"})
                    continue
                
                # Delete from Gemini if requested
                if request.delete_from_gemini and file_meta.gemini_file_name:
                    try:
                        genai.delete_file(file_meta.gemini_file_name)
                    except Exception as e:
                        logger.warning(f"Could not delete from Gemini: {e}")
                
                # Update store file count
                if file_meta.store_id:
                    self.firestore.increment_store_file_count(file_meta.store_id, -1)
                
                # Soft delete in Firestore
                self.firestore.delete_file(file_id)
                deleted.append(file_id)
                
            except Exception as e:
                failed.append({"file_id": file_id, "error": str(e)})
        
        return {
            "deleted": deleted,
            "failed": failed,
            "total_deleted": len(deleted),
            "total_failed": len(failed),
        }
    
    # ==================== Store Management Operations ====================
    
    def create_store(self, request: StoreCreateRequest) -> FileSearchStore:
        """Create a new file search store."""
        store = FileSearchStore(
            user_id=request.user_id,
            property_id=request.property_id,
            display_name=request.display_name,
            store_type=request.store_type,
        )
        return self.firestore.create_store(store)
    
    def list_stores(
        self, 
        user_id: str, 
        property_id: Optional[str] = None
    ) -> List[FileSearchStore]:
        """List stores for a user."""
        return self.firestore.list_stores_for_user(user_id, property_id)
    
    def get_store(self, store_id: str) -> Optional[FileSearchStore]:
        """Get store by ID."""
        return self.firestore.get_store(store_id)
    
    # ==================== Maintenance Operations ====================
    
    def refresh_expiring_files(self, hours_before_expiry: int = 6) -> Dict[str, Any]:
        """
        Refresh files that are about to expire.
        
        Gemini files expire after 48 hours. This method re-uploads files
        that will expire soon to maintain continuous availability.
        """
        files_to_refresh = self.firestore.get_files_needing_refresh(hours_before_expiry)
        
        refreshed = []
        failed = []
        
        for file_meta in files_to_refresh:
            try:
                # Re-upload the file
                result = self.upload_file(FileUploadRequest(
                    user_id=file_meta.user_id,
                    gcs_uri=file_meta.gcs_uri,
                    property_id=file_meta.property_id,
                    original_filename=file_meta.original_filename,
                    content_type=file_meta.content_type,
                    tags=file_meta.tags,
                    custom_metadata=file_meta.custom_metadata,
                    use_existing_store=True,
                ))
                
                if result.success:
                    # Mark old file as expired
                    self.firestore.update_file_status(
                        file_id=file_meta.id,
                        status=FileStatus.EXPIRED,
                    )
                    refreshed.append(file_meta.id)
                else:
                    failed.append({"file_id": file_meta.id, "error": result.error})
                    
            except Exception as e:
                failed.append({"file_id": file_meta.id, "error": str(e)})
        
        return {
            "refreshed": refreshed,
            "failed": failed,
            "total_refreshed": len(refreshed),
            "total_failed": len(failed),
        }
    
    def cleanup_expired(self) -> int:
        """Mark expired files as EXPIRED in Firestore."""
        return self.firestore.cleanup_expired_files()
    
    def get_usage_stats(self, user_id: str) -> Dict[str, Any]:
        """Get file usage statistics for a user."""
        files = self.firestore.list_files(FileListRequest(
            user_id=user_id,
            limit=10000,
        ))
        
        stats = {
            "total_files": len(files),
            "active_files": 0,
            "processing_files": 0,
            "failed_files": 0,
            "expired_files": 0,
            "total_size_bytes": 0,
            "by_property": {},
            "by_content_type": {},
        }
        
        for f in files:
            stats["total_size_bytes"] += f.file_size_bytes
            
            if f.status == FileStatus.ACTIVE:
                stats["active_files"] += 1
            elif f.status == FileStatus.PROCESSING:
                stats["processing_files"] += 1
            elif f.status == FileStatus.FAILED:
                stats["failed_files"] += 1
            elif f.status == FileStatus.EXPIRED:
                stats["expired_files"] += 1
            
            # Group by property
            prop_id = f.property_id or "no_property"
            if prop_id not in stats["by_property"]:
                stats["by_property"][prop_id] = 0
            stats["by_property"][prop_id] += 1
            
            # Group by content type
            ct = f.content_type or "unknown"
            if ct not in stats["by_content_type"]:
                stats["by_content_type"][ct] = 0
            stats["by_content_type"][ct] += 1
        
        return stats

