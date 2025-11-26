"""
Gemini File Search Client Library

This module provides a unified client for Gemini's File Search API, enabling:
- File upload to Gemini Files API
- File Search Store (vector store) management
- Metadata tracking in Firestore
- Integration with agents and proxy

Usage:
    from gemini_file_search import GeminiFileSearchClient
    
    client = GeminiFileSearchClient()
    
    # Upload a file
    file_ref = await client.upload_file(
        user_id="user123",
        gcs_url="gs://bucket/file.pdf",
        property_id="prop456"
    )
    
    # Create a file search store
    store = await client.create_file_search_store(
        user_id="user123",
        file_ids=[file_ref.gemini_file_id],
        name="My Documents"
    )
    
    # Query with file search
    results = await client.query_files(
        store_id=store.store_id,
        query="What is the warranty information?"
    )
"""

import os
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import mimetypes
import hashlib

import google.generativeai as genai
from google.cloud import firestore
from google.cloud import storage
from google.cloud import pubsub_v1
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# Configuration
# ============================================================================

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
GCS_BUCKET = os.environ.get("GCS_BUCKET", os.environ.get("GOOGLE_CLOUD_BUCKET"))
FILE_SEARCH_UPLOAD_TOPIC = os.environ.get("FILE_SEARCH_UPLOAD_TOPIC")
FILE_SEARCH_RESULT_TOPIC = os.environ.get("FILE_SEARCH_RESULT_TOPIC")

# Gemini File API limits
GEMINI_FILE_EXPIRY_HOURS = 48  # Files expire after 48 hours
GEMINI_FILE_REFRESH_HOURS = 6  # Refresh files 6 hours before expiry
GEMINI_MAX_FILE_SIZE_MB = 2048  # 2GB max file size


# ============================================================================
# Data Models
# ============================================================================

class FileStatus(str, Enum):
    """Status of a file in the Gemini File Search system."""
    PENDING = "pending"
    PROCESSING = "processing"
    ACTIVE = "active"
    EXPIRED = "expired"
    FAILED = "failed"
    DELETED = "deleted"


class FileSearchStoreStatus(str, Enum):
    """Status of a File Search Store."""
    CREATING = "creating"
    ACTIVE = "active"
    UPDATING = "updating"
    FAILED = "failed"
    DELETED = "deleted"


@dataclass
class GeminiFileMetadata:
    """Metadata for a file uploaded to Gemini Files API."""
    id: str  # Firestore document ID
    user_id: str
    property_id: Optional[str]
    gcs_url: str
    gemini_file_id: str  # Gemini Files API file ID (files/xxx)
    gemini_file_uri: str  # Full URI for the file
    original_filename: str
    mime_type: str
    file_size_bytes: int
    file_hash: str  # SHA256 hash for deduplication
    status: FileStatus
    created_at: datetime
    expires_at: datetime
    last_refreshed_at: Optional[datetime]
    error_message: Optional[str]
    metadata: Dict[str, Any]  # Additional custom metadata

    def to_dict(self) -> Dict[str, Any]:
        """Convert to Firestore-compatible dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "property_id": self.property_id,
            "gcs_url": self.gcs_url,
            "gemini_file_id": self.gemini_file_id,
            "gemini_file_uri": self.gemini_file_uri,
            "original_filename": self.original_filename,
            "mime_type": self.mime_type,
            "file_size_bytes": self.file_size_bytes,
            "file_hash": self.file_hash,
            "status": self.status.value,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "last_refreshed_at": self.last_refreshed_at,
            "error_message": self.error_message,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GeminiFileMetadata":
        """Create from Firestore document."""
        return cls(
            id=data["id"],
            user_id=data["user_id"],
            property_id=data.get("property_id"),
            gcs_url=data["gcs_url"],
            gemini_file_id=data["gemini_file_id"],
            gemini_file_uri=data["gemini_file_uri"],
            original_filename=data["original_filename"],
            mime_type=data["mime_type"],
            file_size_bytes=data["file_size_bytes"],
            file_hash=data["file_hash"],
            status=FileStatus(data["status"]),
            created_at=data["created_at"],
            expires_at=data["expires_at"],
            last_refreshed_at=data.get("last_refreshed_at"),
            error_message=data.get("error_message"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class FileSearchStore:
    """A File Search Store (vector store) for semantic search."""
    id: str  # Firestore document ID
    store_id: str  # Gemini File Search Store ID
    user_id: str
    property_id: Optional[str]
    name: str
    description: Optional[str]
    file_ids: List[str]  # List of gemini_file_ids
    status: FileSearchStoreStatus
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    error_message: Optional[str]
    config: Dict[str, Any]  # Store configuration

    def to_dict(self) -> Dict[str, Any]:
        """Convert to Firestore-compatible dictionary."""
        return {
            "id": self.id,
            "store_id": self.store_id,
            "user_id": self.user_id,
            "property_id": self.property_id,
            "name": self.name,
            "description": self.description,
            "file_ids": self.file_ids,
            "status": self.status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "expires_at": self.expires_at,
            "error_message": self.error_message,
            "config": self.config,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FileSearchStore":
        """Create from Firestore document."""
        return cls(
            id=data["id"],
            store_id=data["store_id"],
            user_id=data["user_id"],
            property_id=data.get("property_id"),
            name=data["name"],
            description=data.get("description"),
            file_ids=data.get("file_ids", []),
            status=FileSearchStoreStatus(data["status"]),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            expires_at=data["expires_at"],
            error_message=data.get("error_message"),
            config=data.get("config", {}),
        )


# ============================================================================
# Request/Response Models
# ============================================================================

class FileUploadRequest(BaseModel):
    """Request model for file upload."""
    user_id: str
    gcs_urls: List[str]
    property_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class FileUploadResponse(BaseModel):
    """Response model for file upload."""
    success: bool
    message: str
    file_ids: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)


class CreateStoreRequest(BaseModel):
    """Request model for creating a File Search Store."""
    user_id: str
    name: str
    file_ids: List[str]
    property_id: Optional[str] = None
    description: Optional[str] = None


class FileSearchQueryRequest(BaseModel):
    """Request model for querying files."""
    user_id: str
    query: str
    store_ids: Optional[List[str]] = None
    file_ids: Optional[List[str]] = None
    property_id: Optional[str] = None
    top_k: int = 10


class FileSearchResult(BaseModel):
    """A single search result."""
    content: str
    score: float
    file_id: str
    file_name: str
    chunk_index: int


class FileSearchQueryResponse(BaseModel):
    """Response model for file search queries."""
    results: List[FileSearchResult]
    total_results: int
    query: str


# ============================================================================
# Gemini File Search Client
# ============================================================================

class GeminiFileSearchClient:
    """
    Client for Gemini File Search API operations.
    
    Handles:
    - File upload to Gemini Files API
    - File Search Store management
    - Metadata tracking in Firestore
    - Automatic file refresh before expiry
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        project_id: Optional[str] = None,
        gcs_bucket: Optional[str] = None,
    ):
        """
        Initialize the Gemini File Search client.
        
        Args:
            api_key: Gemini API key (defaults to GEMINI_API_KEY env var)
            project_id: GCP project ID (defaults to GCP_PROJECT_ID env var)
            gcs_bucket: GCS bucket name (defaults to GCS_BUCKET env var)
        """
        self.api_key = api_key or GEMINI_API_KEY
        self.project_id = project_id or GCP_PROJECT_ID
        self.gcs_bucket = gcs_bucket or GCS_BUCKET

        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is required")

        # Initialize Gemini client
        genai.configure(api_key=self.api_key)

        # Initialize Firestore client
        self._firestore_client: Optional[firestore.Client] = None

        # Initialize GCS client
        self._storage_client: Optional[storage.Client] = None

        # Initialize Pub/Sub publisher
        self._publisher: Optional[pubsub_v1.PublisherClient] = None

        logger.info("GeminiFileSearchClient initialized")

    @property
    def firestore_client(self) -> firestore.Client:
        """Lazy initialization of Firestore client."""
        if self._firestore_client is None:
            self._firestore_client = firestore.Client(project=self.project_id)
        return self._firestore_client

    @property
    def storage_client(self) -> storage.Client:
        """Lazy initialization of Storage client."""
        if self._storage_client is None:
            self._storage_client = storage.Client(project=self.project_id)
        return self._storage_client

    @property
    def publisher(self) -> pubsub_v1.PublisherClient:
        """Lazy initialization of Pub/Sub publisher."""
        if self._publisher is None:
            self._publisher = pubsub_v1.PublisherClient()
        return self._publisher

    # ========================================================================
    # File Upload Operations
    # ========================================================================

    async def upload_file(
        self,
        user_id: str,
        gcs_url: str,
        property_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> GeminiFileMetadata:
        """
        Upload a file from GCS to Gemini Files API.
        
        Args:
            user_id: User ID who owns the file
            gcs_url: GCS URL of the file (gs://bucket/path/file.pdf)
            property_id: Optional property ID to associate with
            metadata: Optional additional metadata
            
        Returns:
            GeminiFileMetadata with the upload result
        """
        metadata = metadata or {}
        now = datetime.now(timezone.utc)

        # Parse GCS URL
        bucket_name, blob_path = self._parse_gcs_url(gcs_url)
        original_filename = blob_path.split("/")[-1]

        # Get file info from GCS
        bucket = self.storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)

        if not blob.exists():
            raise FileNotFoundError(f"File not found: {gcs_url}")

        # Download file content for upload
        file_content = blob.download_as_bytes()
        file_size = len(file_content)
        file_hash = hashlib.sha256(file_content).hexdigest()

        # Check for duplicate (same user, same hash)
        existing = await self._find_duplicate_file(user_id, file_hash)
        if existing and existing.status == FileStatus.ACTIVE:
            logger.info(f"Found existing active file with same hash: {existing.id}")
            return existing

        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(original_filename)
        if not mime_type:
            mime_type = "application/octet-stream"

        # Create Firestore document ID
        doc_id = f"{user_id}_{now.strftime('%Y%m%d%H%M%S')}_{file_hash[:8]}"

        # Create initial metadata record
        file_metadata = GeminiFileMetadata(
            id=doc_id,
            user_id=user_id,
            property_id=property_id,
            gcs_url=gcs_url,
            gemini_file_id="",  # Will be populated after upload
            gemini_file_uri="",
            original_filename=original_filename,
            mime_type=mime_type,
            file_size_bytes=file_size,
            file_hash=file_hash,
            status=FileStatus.PROCESSING,
            created_at=now,
            expires_at=now + timedelta(hours=GEMINI_FILE_EXPIRY_HOURS),
            last_refreshed_at=None,
            error_message=None,
            metadata=metadata,
        )

        # Save initial record
        await self._save_file_metadata(file_metadata)

        try:
            # Upload to Gemini Files API
            gemini_file = await self._upload_to_gemini(
                file_content=file_content,
                filename=original_filename,
                mime_type=mime_type,
            )

            # Update metadata with Gemini file info
            file_metadata.gemini_file_id = gemini_file.name
            file_metadata.gemini_file_uri = gemini_file.uri
            file_metadata.status = FileStatus.ACTIVE
            file_metadata.expires_at = now + timedelta(hours=GEMINI_FILE_EXPIRY_HOURS)

            await self._save_file_metadata(file_metadata)

            logger.info(f"File uploaded successfully: {gemini_file.name}")
            return file_metadata

        except Exception as e:
            logger.error(f"Failed to upload file to Gemini: {e}")
            file_metadata.status = FileStatus.FAILED
            file_metadata.error_message = str(e)
            await self._save_file_metadata(file_metadata)
            raise

    async def upload_files_batch(
        self,
        request: FileUploadRequest,
    ) -> FileUploadResponse:
        """
        Upload multiple files in batch.
        
        Args:
            request: FileUploadRequest with list of GCS URLs
            
        Returns:
            FileUploadResponse with results
        """
        file_ids = []
        errors = []

        for gcs_url in request.gcs_urls:
            try:
                file_metadata = await self.upload_file(
                    user_id=request.user_id,
                    gcs_url=gcs_url,
                    property_id=request.property_id,
                    metadata=request.metadata,
                )
                file_ids.append(file_metadata.gemini_file_id)
            except Exception as e:
                errors.append(f"{gcs_url}: {str(e)}")
                logger.error(f"Failed to upload {gcs_url}: {e}")

        return FileUploadResponse(
            success=len(errors) == 0,
            message=f"Uploaded {len(file_ids)} files" + (f", {len(errors)} failed" if errors else ""),
            file_ids=file_ids,
            errors=errors,
        )

    async def _upload_to_gemini(
        self,
        file_content: bytes,
        filename: str,
        mime_type: str,
    ) -> Any:
        """Upload file content to Gemini Files API."""
        import tempfile
        import os as os_module

        # Write to temp file for upload
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        try:
            # Upload using genai library
            gemini_file = genai.upload_file(
                path=tmp_path,
                display_name=filename,
                mime_type=mime_type,
            )

            # Wait for processing to complete
            while gemini_file.state.name == "PROCESSING":
                await asyncio.sleep(1)
                gemini_file = genai.get_file(gemini_file.name)

            if gemini_file.state.name == "FAILED":
                raise Exception(f"File processing failed: {gemini_file.state.name}")

            return gemini_file

        finally:
            # Clean up temp file
            os_module.unlink(tmp_path)

    # ========================================================================
    # File Search Store Operations
    # ========================================================================

    async def create_file_search_store(
        self,
        user_id: str,
        name: str,
        file_ids: List[str],
        property_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> FileSearchStore:
        """
        Create a File Search Store with the given files.
        
        Note: In Gemini API, you use files directly in the model context
        rather than creating separate vector stores. This method tracks
        the logical grouping of files for your application.
        
        Args:
            user_id: User ID who owns the store
            name: Display name for the store
            file_ids: List of Gemini file IDs to include
            property_id: Optional property ID to associate with
            description: Optional description
            
        Returns:
            FileSearchStore with the store info
        """
        now = datetime.now(timezone.utc)
        doc_id = f"{user_id}_{now.strftime('%Y%m%d%H%M%S')}"

        # Verify all files exist and are active
        valid_file_ids = []
        for file_id in file_ids:
            file_metadata = await self.get_file_by_gemini_id(user_id, file_id)
            if file_metadata and file_metadata.status == FileStatus.ACTIVE:
                valid_file_ids.append(file_id)
            else:
                logger.warning(f"File {file_id} not found or not active, skipping")

        if not valid_file_ids:
            raise ValueError("No valid files to create store with")

        store = FileSearchStore(
            id=doc_id,
            store_id=doc_id,  # Use doc_id as store_id
            user_id=user_id,
            property_id=property_id,
            name=name,
            description=description,
            file_ids=valid_file_ids,
            status=FileSearchStoreStatus.ACTIVE,
            created_at=now,
            updated_at=now,
            expires_at=now + timedelta(hours=GEMINI_FILE_EXPIRY_HOURS),
            error_message=None,
            config={},
        )

        await self._save_file_search_store(store)

        logger.info(f"File Search Store created: {store.id} with {len(valid_file_ids)} files")
        return store

    async def add_files_to_store(
        self,
        store_id: str,
        user_id: str,
        file_ids: List[str],
    ) -> FileSearchStore:
        """
        Add files to an existing File Search Store.
        
        Args:
            store_id: Store ID to update
            user_id: User ID for authorization
            file_ids: File IDs to add
            
        Returns:
            Updated FileSearchStore
        """
        store = await self.get_file_search_store(store_id, user_id)
        if not store:
            raise ValueError(f"Store not found: {store_id}")

        # Verify files and add
        for file_id in file_ids:
            file_metadata = await self.get_file_by_gemini_id(user_id, file_id)
            if file_metadata and file_metadata.status == FileStatus.ACTIVE:
                if file_id not in store.file_ids:
                    store.file_ids.append(file_id)

        store.updated_at = datetime.now(timezone.utc)
        await self._save_file_search_store(store)

        return store

    async def remove_files_from_store(
        self,
        store_id: str,
        user_id: str,
        file_ids: List[str],
    ) -> FileSearchStore:
        """
        Remove files from a File Search Store.
        
        Args:
            store_id: Store ID to update
            user_id: User ID for authorization
            file_ids: File IDs to remove
            
        Returns:
            Updated FileSearchStore
        """
        store = await self.get_file_search_store(store_id, user_id)
        if not store:
            raise ValueError(f"Store not found: {store_id}")

        store.file_ids = [fid for fid in store.file_ids if fid not in file_ids]
        store.updated_at = datetime.now(timezone.utc)
        await self._save_file_search_store(store)

        return store

    # ========================================================================
    # Query Operations
    # ========================================================================

    async def query_files(
        self,
        user_id: str,
        query: str,
        store_ids: Optional[List[str]] = None,
        file_ids: Optional[List[str]] = None,
        property_id: Optional[str] = None,
        top_k: int = 10,
    ) -> FileSearchQueryResponse:
        """
        Query files using Gemini's file search capabilities.
        
        Args:
            user_id: User ID for authorization
            query: Search query
            store_ids: Optional list of store IDs to search
            file_ids: Optional list of specific file IDs to search
            property_id: Optional property ID to filter by
            top_k: Number of results to return
            
        Returns:
            FileSearchQueryResponse with search results
        """
        # Collect file URIs to search
        file_uris = []

        if store_ids:
            for store_id in store_ids:
                store = await self.get_file_search_store(store_id, user_id)
                if store:
                    for fid in store.file_ids:
                        file_metadata = await self.get_file_by_gemini_id(user_id, fid)
                        if file_metadata and file_metadata.status == FileStatus.ACTIVE:
                            file_uris.append(file_metadata.gemini_file_uri)

        if file_ids:
            for fid in file_ids:
                file_metadata = await self.get_file_by_gemini_id(user_id, fid)
                if file_metadata and file_metadata.status == FileStatus.ACTIVE:
                    file_uris.append(file_metadata.gemini_file_uri)

        if property_id and not file_uris:
            # Get all files for the property
            files = await self.list_files(user_id, property_id=property_id)
            for f in files:
                if f.status == FileStatus.ACTIVE:
                    file_uris.append(f.gemini_file_uri)

        if not file_uris:
            return FileSearchQueryResponse(
                results=[],
                total_results=0,
                query=query,
            )

        # Use Gemini model with file context for search
        model = genai.GenerativeModel("gemini-2.0-flash")

        # Create file parts for context
        file_parts = []
        for uri in file_uris[:20]:  # Limit to 20 files per query
            try:
                file_data = genai.get_file(uri.split("/")[-1])
                file_parts.append(file_data)
            except Exception as e:
                logger.warning(f"Failed to get file {uri}: {e}")

        if not file_parts:
            return FileSearchQueryResponse(
                results=[],
                total_results=0,
                query=query,
            )

        # Create search prompt
        search_prompt = f"""Based on the provided documents, find and extract the most relevant information for this query:

Query: {query}

Instructions:
1. Search through all provided documents
2. Extract the most relevant passages that answer the query
3. Include the source file name for each passage
4. Return up to {top_k} relevant results
5. Format each result as:
   - Content: [relevant text passage]
   - Source: [filename]
   - Relevance: [score from 0 to 1]

If no relevant information is found, respond with "No relevant results found."
"""

        try:
            response = model.generate_content([*file_parts, search_prompt])

            # Parse response into results
            results = self._parse_search_response(response.text, file_uris)

            return FileSearchQueryResponse(
                results=results[:top_k],
                total_results=len(results),
                query=query,
            )

        except Exception as e:
            logger.error(f"Query failed: {e}")
            return FileSearchQueryResponse(
                results=[],
                total_results=0,
                query=query,
            )

    def _parse_search_response(
        self,
        response_text: str,
        file_uris: List[str],
    ) -> List[FileSearchResult]:
        """Parse the model's search response into structured results."""
        results = []

        if "No relevant results found" in response_text:
            return results

        # Simple parsing - in production you'd want more robust parsing
        chunks = response_text.split("Content:")
        for i, chunk in enumerate(chunks[1:], 1):
            try:
                lines = chunk.strip().split("\n")
                content = lines[0].strip() if lines else ""

                source = ""
                score = 0.5

                for line in lines[1:]:
                    if line.startswith("Source:"):
                        source = line.replace("Source:", "").strip()
                    elif line.startswith("Relevance:"):
                        try:
                            score = float(line.replace("Relevance:", "").strip())
                        except ValueError:
                            pass

                if content:
                    results.append(FileSearchResult(
                        content=content,
                        score=score,
                        file_id=source or f"file_{i}",
                        file_name=source or f"Document {i}",
                        chunk_index=i,
                    ))
            except Exception as e:
                logger.warning(f"Failed to parse search result chunk: {e}")

        return results

    # ========================================================================
    # File Management Operations
    # ========================================================================

    async def get_file(self, doc_id: str, user_id: str) -> Optional[GeminiFileMetadata]:
        """Get file metadata by document ID."""
        doc_ref = self.firestore_client.collection("gemini_files").document(doc_id)
        doc = doc_ref.get()

        if not doc.exists:
            return None

        data = doc.to_dict()
        if data.get("user_id") != user_id:
            return None

        data["id"] = doc.id
        return GeminiFileMetadata.from_dict(data)

    async def get_file_by_gemini_id(
        self,
        user_id: str,
        gemini_file_id: str,
    ) -> Optional[GeminiFileMetadata]:
        """Get file metadata by Gemini file ID."""
        query = (
            self.firestore_client.collection("gemini_files")
            .where("user_id", "==", user_id)
            .where("gemini_file_id", "==", gemini_file_id)
            .limit(1)
        )

        docs = query.stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            return GeminiFileMetadata.from_dict(data)

        return None

    async def list_files(
        self,
        user_id: str,
        property_id: Optional[str] = None,
        status: Optional[FileStatus] = None,
        limit: int = 100,
    ) -> List[GeminiFileMetadata]:
        """List files for a user."""
        query = self.firestore_client.collection("gemini_files").where(
            "user_id", "==", user_id
        )

        if property_id:
            query = query.where("property_id", "==", property_id)

        if status:
            query = query.where("status", "==", status.value)

        query = query.order_by("created_at", direction=firestore.Query.DESCENDING)
        query = query.limit(limit)

        files = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            files.append(GeminiFileMetadata.from_dict(data))

        return files

    async def delete_file(self, doc_id: str, user_id: str) -> bool:
        """Delete a file from Gemini and Firestore."""
        file_metadata = await self.get_file(doc_id, user_id)
        if not file_metadata:
            return False

        try:
            # Delete from Gemini Files API
            if file_metadata.gemini_file_id:
                try:
                    genai.delete_file(file_metadata.gemini_file_id)
                except Exception as e:
                    logger.warning(f"Failed to delete from Gemini: {e}")

            # Update status in Firestore
            file_metadata.status = FileStatus.DELETED
            await self._save_file_metadata(file_metadata)

            return True

        except Exception as e:
            logger.error(f"Failed to delete file: {e}")
            return False

    async def refresh_file(self, doc_id: str, user_id: str) -> Optional[GeminiFileMetadata]:
        """
        Refresh a file by re-uploading it to Gemini.
        
        This is necessary because Gemini files expire after 48 hours.
        """
        file_metadata = await self.get_file(doc_id, user_id)
        if not file_metadata:
            return None

        if file_metadata.status != FileStatus.ACTIVE:
            logger.warning(f"Cannot refresh file with status {file_metadata.status}")
            return file_metadata

        try:
            # Download from GCS
            bucket_name, blob_path = self._parse_gcs_url(file_metadata.gcs_url)
            bucket = self.storage_client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            file_content = blob.download_as_bytes()

            # Delete old Gemini file
            if file_metadata.gemini_file_id:
                try:
                    genai.delete_file(file_metadata.gemini_file_id)
                except Exception:
                    pass  # Ignore deletion errors

            # Upload new file
            gemini_file = await self._upload_to_gemini(
                file_content=file_content,
                filename=file_metadata.original_filename,
                mime_type=file_metadata.mime_type,
            )

            # Update metadata
            now = datetime.now(timezone.utc)
            file_metadata.gemini_file_id = gemini_file.name
            file_metadata.gemini_file_uri = gemini_file.uri
            file_metadata.expires_at = now + timedelta(hours=GEMINI_FILE_EXPIRY_HOURS)
            file_metadata.last_refreshed_at = now
            file_metadata.status = FileStatus.ACTIVE
            file_metadata.error_message = None

            await self._save_file_metadata(file_metadata)

            logger.info(f"File refreshed: {file_metadata.id}")
            return file_metadata

        except Exception as e:
            logger.error(f"Failed to refresh file: {e}")
            file_metadata.status = FileStatus.FAILED
            file_metadata.error_message = f"Refresh failed: {str(e)}"
            await self._save_file_metadata(file_metadata)
            return file_metadata

    async def refresh_expiring_files(
        self,
        hours_before_expiry: int = GEMINI_FILE_REFRESH_HOURS,
    ) -> Dict[str, Any]:
        """
        Refresh all files expiring within the specified hours.
        
        Args:
            hours_before_expiry: Hours before expiry to refresh files
            
        Returns:
            Summary of refresh operations
        """
        threshold = datetime.now(timezone.utc) + timedelta(hours=hours_before_expiry)

        query = (
            self.firestore_client.collection("gemini_files")
            .where("status", "==", FileStatus.ACTIVE.value)
            .where("expires_at", "<", threshold)
        )

        refreshed = 0
        failed = 0
        errors = []

        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            file_metadata = GeminiFileMetadata.from_dict(data)

            try:
                await self.refresh_file(file_metadata.id, file_metadata.user_id)
                refreshed += 1
            except Exception as e:
                failed += 1
                errors.append(f"{file_metadata.id}: {str(e)}")

        return {
            "refreshed": refreshed,
            "failed": failed,
            "errors": errors,
        }

    # ========================================================================
    # File Search Store Management
    # ========================================================================

    async def get_file_search_store(
        self,
        store_id: str,
        user_id: str,
    ) -> Optional[FileSearchStore]:
        """Get a File Search Store by ID."""
        doc_ref = self.firestore_client.collection("file_search_stores").document(store_id)
        doc = doc_ref.get()

        if not doc.exists:
            return None

        data = doc.to_dict()
        if data.get("user_id") != user_id:
            return None

        data["id"] = doc.id
        return FileSearchStore.from_dict(data)

    async def list_file_search_stores(
        self,
        user_id: str,
        property_id: Optional[str] = None,
        limit: int = 50,
    ) -> List[FileSearchStore]:
        """List File Search Stores for a user."""
        query = self.firestore_client.collection("file_search_stores").where(
            "user_id", "==", user_id
        )

        if property_id:
            query = query.where("property_id", "==", property_id)

        query = query.order_by("created_at", direction=firestore.Query.DESCENDING)
        query = query.limit(limit)

        stores = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            stores.append(FileSearchStore.from_dict(data))

        return stores

    async def delete_file_search_store(
        self,
        store_id: str,
        user_id: str,
    ) -> bool:
        """Delete a File Search Store."""
        store = await self.get_file_search_store(store_id, user_id)
        if not store:
            return False

        store.status = FileSearchStoreStatus.DELETED
        await self._save_file_search_store(store)
        return True

    # ========================================================================
    # Pub/Sub Operations
    # ========================================================================

    def publish_file_upload(
        self,
        user_id: str,
        gcs_urls: List[str],
        property_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Publish a file upload request to Pub/Sub for async processing.
        
        Args:
            user_id: User ID
            gcs_urls: List of GCS URLs to upload
            property_id: Optional property ID
            metadata: Optional additional metadata
            
        Returns:
            Pub/Sub message ID
        """
        if not FILE_SEARCH_UPLOAD_TOPIC:
            raise ValueError("FILE_SEARCH_UPLOAD_TOPIC not configured")

        topic_path = self.publisher.topic_path(self.project_id, FILE_SEARCH_UPLOAD_TOPIC)

        payload = {
            "user_id": user_id,
            "gcs_urls": gcs_urls,
            "property_id": property_id,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        future = self.publisher.publish(
            topic_path,
            json.dumps(payload).encode("utf-8"),
        )

        message_id = future.result()
        logger.info(f"Published file upload request: {message_id}")
        return message_id

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def _parse_gcs_url(self, gcs_url: str) -> tuple[str, str]:
        """Parse GCS URL into bucket name and blob path."""
        if not gcs_url.startswith("gs://"):
            raise ValueError(f"Invalid GCS URL: {gcs_url}")

        path = gcs_url[5:]  # Remove "gs://"
        parts = path.split("/", 1)

        if len(parts) != 2:
            raise ValueError(f"Invalid GCS URL: {gcs_url}")

        return parts[0], parts[1]

    async def _save_file_metadata(self, metadata: GeminiFileMetadata) -> None:
        """Save file metadata to Firestore."""
        doc_ref = self.firestore_client.collection("gemini_files").document(metadata.id)
        doc_ref.set(metadata.to_dict())

    async def _save_file_search_store(self, store: FileSearchStore) -> None:
        """Save File Search Store to Firestore."""
        doc_ref = self.firestore_client.collection("file_search_stores").document(store.id)
        doc_ref.set(store.to_dict())

    async def _find_duplicate_file(
        self,
        user_id: str,
        file_hash: str,
    ) -> Optional[GeminiFileMetadata]:
        """Find existing file with same hash for deduplication."""
        query = (
            self.firestore_client.collection("gemini_files")
            .where("user_id", "==", user_id)
            .where("file_hash", "==", file_hash)
            .where("status", "==", FileStatus.ACTIVE.value)
            .limit(1)
        )

        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            return GeminiFileMetadata.from_dict(data)

        return None


# ============================================================================
# Convenience Functions
# ============================================================================

_default_client: Optional[GeminiFileSearchClient] = None


def get_client() -> GeminiFileSearchClient:
    """Get or create the default client instance."""
    global _default_client
    if _default_client is None:
        _default_client = GeminiFileSearchClient()
    return _default_client


async def upload_file(
    user_id: str,
    gcs_url: str,
    property_id: Optional[str] = None,
) -> GeminiFileMetadata:
    """Convenience function to upload a file."""
    return await get_client().upload_file(user_id, gcs_url, property_id)


async def query_files(
    user_id: str,
    query: str,
    property_id: Optional[str] = None,
) -> FileSearchQueryResponse:
    """Convenience function to query files."""
    return await get_client().query_files(user_id, query, property_id=property_id)


async def list_files(
    user_id: str,
    property_id: Optional[str] = None,
) -> List[GeminiFileMetadata]:
    """Convenience function to list files."""
    return await get_client().list_files(user_id, property_id=property_id)
