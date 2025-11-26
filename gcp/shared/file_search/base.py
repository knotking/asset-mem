"""
Base classes and interfaces for file search abstraction.

Defines the common interface that all file search backends must implement.
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum


class FileSearchBackend(str, Enum):
    """Supported file search backends."""
    GEMINI = "gemini"
    VERTEX = "vertex"


@dataclass
class FileSearchStore:
    """
    Represents a file search store (collection of documents).
    
    Attributes:
        name: Unique identifier for the store
        display_name: Human-readable name
        backend: Backend type (gemini or vertex)
        metadata: Additional backend-specific metadata
    """
    name: str
    display_name: str
    backend: FileSearchBackend
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class GroundingChunk:
    """
    Represents a citation/grounding chunk from retrieval.
    
    Attributes:
        type: Type of chunk (file_search, web, etc.)
        document_name: Name of the source document
        chunk_text: Text content of the chunk
        page_number: Page number (if applicable)
        uri: URI to the source (if applicable)
        confidence_score: Confidence score (if available)
    """
    type: str
    document_name: Optional[str] = None
    chunk_text: Optional[str] = None
    page_number: Optional[int] = None
    uri: Optional[str] = None
    confidence_score: Optional[float] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class FileSearchResult:
    """
    Represents the result of a file search query.
    
    Attributes:
        text: Generated answer text
        model: Model used for generation
        stores_queried: List of store names that were queried
        grounding_chunks: List of citation chunks supporting the answer
        metadata: Additional backend-specific metadata
    """
    text: str
    model: str
    stores_queried: List[str]
    grounding_chunks: List[GroundingChunk] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.grounding_chunks is None:
            self.grounding_chunks = []
        if self.metadata is None:
            self.metadata = {}


@dataclass
class UploadResult:
    """
    Represents the result of a file upload operation.
    
    Attributes:
        status: Upload status (completed, in_progress, timeout, failed)
        operation_name: Backend-specific operation identifier
        display_name: Display name of the uploaded file
        store_name: Store the file was uploaded to
        file_id: Backend-specific file identifier
        metadata: Additional backend-specific metadata
    """
    status: str
    operation_name: str
    display_name: str
    store_name: str
    file_id: Optional[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class FileSearchManager(ABC):
    """
    Abstract base class for file search managers.
    
    Defines the common interface that all file search backends must implement.
    This allows for backend-agnostic code that works with both Gemini File Search
    and Vertex AI RAG.
    """
    
    @abstractmethod
    def __init__(self, **kwargs):
        """
        Initialize the file search manager.
        
        Args:
            **kwargs: Backend-specific configuration parameters
        """
        pass
    
    @property
    @abstractmethod
    def backend_type(self) -> FileSearchBackend:
        """Return the backend type."""
        pass
    
    # Store Management
    
    @abstractmethod
    def create_store(self, display_name: str) -> FileSearchStore:
        """
        Create a new file search store.
        
        Args:
            display_name: Human-readable name for the store
            
        Returns:
            FileSearchStore object
            
        Raises:
            Exception: If store creation fails
        """
        pass
    
    @abstractmethod
    def list_stores(self) -> List[FileSearchStore]:
        """
        List all file search stores.
        
        Returns:
            List of FileSearchStore objects
            
        Raises:
            Exception: If listing fails
        """
        pass
    
    @abstractmethod
    def get_store(self, store_name: str) -> Optional[FileSearchStore]:
        """
        Get a specific store by name.
        
        Args:
            store_name: Store name/ID
            
        Returns:
            FileSearchStore object or None if not found
        """
        pass
    
    @abstractmethod
    def delete_store(self, store_name: str) -> bool:
        """
        Delete a file search store.
        
        Args:
            store_name: Store name/ID
            
        Returns:
            True if successful, False otherwise
            
        Raises:
            Exception: If deletion fails
        """
        pass
    
    # File Upload
    
    @abstractmethod
    def upload_file(
        self,
        store_name: str,
        file_path: str,
        display_name: Optional[str] = None,
        user_id: Optional[str] = None,
        mime_type: Optional[str] = None,
        wait_for_completion: bool = True,
        timeout: int = 300
    ) -> UploadResult:
        """
        Upload a file to a store.
        
        Args:
            store_name: Target store name/ID
            file_path: Local file path or GCS URI (gs://...)
            display_name: Optional display name for the file
            user_id: Optional user ID to associate with the file
            mime_type: Optional MIME type
            wait_for_completion: Whether to wait for import to complete
            timeout: Maximum wait time in seconds
            
        Returns:
            UploadResult object
            
        Raises:
            Exception: If upload fails
        """
        pass
    
    @abstractmethod
    def import_gcs_file(
        self,
        store_name: str,
        gcs_uri: str,
        display_name: Optional[str] = None,
        user_id: Optional[str] = None,
        mime_type: Optional[str] = None,
        wait_for_completion: bool = True,
        timeout: int = 300
    ) -> UploadResult:
        """
        Import a file from Google Cloud Storage to a store.
        
        Args:
            store_name: Target store name/ID
            gcs_uri: GCS URI (gs://bucket/path)
            display_name: Optional display name
            user_id: Optional user ID to associate with the file
            mime_type: Optional MIME type
            wait_for_completion: Whether to wait for completion
            timeout: Maximum wait time in seconds
            
        Returns:
            UploadResult object
            
        Raises:
            Exception: If import fails
        """
        pass
    
    # Query
    
    @abstractmethod
    def query(
        self,
        query: str,
        store_names: List[str],
        model: Optional[str] = None,
        include_grounding_metadata: bool = True,
        **kwargs
    ) -> FileSearchResult:
        """
        Query file search stores with semantic search.
        
        Args:
            query: User's question or search query
            store_names: List of store names to query
            model: Model to use (backend-specific, uses default if None)
            include_grounding_metadata: Whether to include citations
            **kwargs: Additional backend-specific parameters
            
        Returns:
            FileSearchResult object
            
        Raises:
            Exception: If query fails
        """
        pass
    
    # User-specific Operations
    
    @abstractmethod
    def get_user_store_name(self, user_id: str) -> Optional[str]:
        """
        Get the store name for a specific user.
        
        Args:
            user_id: User ID
            
        Returns:
            Store name if found, None otherwise
        """
        pass
    
    @abstractmethod
    def get_or_create_user_store(self, user_id: str) -> str:
        """
        Get or create a store for a specific user.
        
        Args:
            user_id: User ID
            
        Returns:
            Store name (creates new store if not found)
            
        Raises:
            Exception: If store creation fails
        """
        pass
    
    def upload_user_file(
        self,
        user_id: str,
        file_path: str,
        display_name: Optional[str] = None,
        wait_for_completion: bool = True,
        timeout: int = 300
    ) -> UploadResult:
        """
        Upload a file for a specific user (creates user store if needed).
        
        Args:
            user_id: User ID
            file_path: File path or GCS URI
            display_name: Optional display name
            wait_for_completion: Wait for completion
            timeout: Maximum wait time in seconds
            
        Returns:
            UploadResult object
        """
        store_name = self.get_or_create_user_store(user_id)
        return self.upload_file(
            store_name=store_name,
            file_path=file_path,
            display_name=display_name,
            user_id=user_id,
            wait_for_completion=wait_for_completion,
            timeout=timeout
        )
    
    def import_user_gcs_file(
        self,
        user_id: str,
        gcs_uri: str,
        display_name: Optional[str] = None,
        mime_type: Optional[str] = None,
        wait_for_completion: bool = True,
        timeout: int = 300
    ) -> UploadResult:
        """
        Import a GCS file for a specific user (creates user store if needed).
        
        Args:
            user_id: User ID
            gcs_uri: GCS URI
            display_name: Optional display name
            mime_type: Optional MIME type
            wait_for_completion: Wait for completion
            timeout: Maximum wait time in seconds
            
        Returns:
            UploadResult object
        """
        store_name = self.get_or_create_user_store(user_id)
        return self.import_gcs_file(
            store_name=store_name,
            gcs_uri=gcs_uri,
            display_name=display_name,
            user_id=user_id,
            mime_type=mime_type,
            wait_for_completion=wait_for_completion,
            timeout=timeout
        )
    
    def query_user_documents(
        self,
        user_id: str,
        query: str,
        model: Optional[str] = None,
        include_grounding_metadata: bool = True,
        **kwargs
    ) -> FileSearchResult:
        """
        Query documents for a specific user.
        
        Args:
            user_id: User ID
            query: Search query
            model: Model to use (backend-specific)
            include_grounding_metadata: Include citations
            **kwargs: Additional backend-specific parameters
            
        Returns:
            FileSearchResult object
        """
        store_name = self.get_user_store_name(user_id)
        
        if not store_name:
            return FileSearchResult(
                text="No documents available. Please upload documents first.",
                model=model or "default",
                stores_queried=[],
                grounding_chunks=[]
            )
        
        return self.query(
            query=query,
            store_names=[store_name],
            model=model,
            include_grounding_metadata=include_grounding_metadata,
            **kwargs
        )

