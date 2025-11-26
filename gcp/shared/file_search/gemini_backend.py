"""
Gemini File Search Backend Implementation

Uses Google's Gemini API File Search feature for RAG capabilities.
Reference: https://ai.google.dev/gemini-api/docs/file-search
"""

import os
import logging
import time
from typing import Optional, List, Dict, Any

from google import genai
from google.genai import types

from .base import (
    FileSearchManager,
    FileSearchStore,
    FileSearchResult,
    UploadResult,
    GroundingChunk,
    FileSearchBackend,
)

logger = logging.getLogger(__name__)


class GeminiFileSearchBackend(FileSearchManager):
    """
    Gemini File Search backend implementation.
    
    This backend uses the Gemini API's native File Search feature which provides:
    - Automatic document chunking and indexing
    - Semantic search over documents
    - AI-generated answers with citations
    - Support for 100+ file types
    
    Example:
        backend = GeminiFileSearchBackend(api_key="your-api-key")
        store = backend.create_store("My Documents")
        backend.upload_file(store.name, "document.pdf")
        result = backend.query("What is in the document?", [store.name])
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: str = "gemini-2.5-flash"
    ):
        """
        Initialize the Gemini File Search backend.
        
        Args:
            api_key: Gemini API key. Defaults to GEMINI_API_KEY env var.
            default_model: Default model for queries (gemini-2.5-flash, gemini-2.5-pro, etc.)
            
        Raises:
            ValueError: If API key is not provided
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY must be provided or set in environment")
        
        self.default_model = default_model
        self.client = genai.Client(api_key=self.api_key)
        logger.info("GeminiFileSearchBackend initialized")
    
    @property
    def backend_type(self) -> FileSearchBackend:
        """Return the backend type."""
        return FileSearchBackend.GEMINI
    
    # Store Management
    
    def create_store(self, display_name: str) -> FileSearchStore:
        """
        Create a new File Search store.
        
        Args:
            display_name: Human-readable name for the store
            
        Returns:
            FileSearchStore object
        """
        try:
            store = self.client.file_search_stores.create(
                config={'display_name': display_name}
            )
            
            logger.info(f"Created File Search store: {store.name} ({display_name})")
            
            return FileSearchStore(
                name=store.name,
                display_name=display_name,
                backend=FileSearchBackend.GEMINI,
                metadata={
                    "create_time": store.create_time.isoformat() if hasattr(store, 'create_time') else None,
                }
            )
            
        except Exception as e:
            logger.error(f"Error creating File Search store: {e}", exc_info=True)
            raise
    
    def list_stores(self) -> List[FileSearchStore]:
        """
        List all File Search stores.
        
        Returns:
            List of FileSearchStore objects
        """
        try:
            stores = self.client.file_search_stores.list()
            
            result = []
            for store in stores:
                result.append(FileSearchStore(
                    name=store.name,
                    display_name=getattr(store, 'display_name', ''),
                    backend=FileSearchBackend.GEMINI,
                    metadata={
                        "create_time": store.create_time.isoformat() if hasattr(store, 'create_time') else None,
                    }
                ))
            
            logger.info(f"Listed {len(result)} File Search stores")
            return result
            
        except Exception as e:
            logger.error(f"Error listing File Search stores: {e}", exc_info=True)
            raise
    
    def get_store(self, store_name: str) -> Optional[FileSearchStore]:
        """
        Get a specific store by name.
        
        Args:
            store_name: Store name/ID
            
        Returns:
            FileSearchStore object or None if not found
        """
        try:
            stores = self.list_stores()
            for store in stores:
                if store.name == store_name:
                    return store
            return None
        except Exception as e:
            logger.error(f"Error getting store: {e}", exc_info=True)
            return None
    
    def delete_store(self, store_name: str) -> bool:
        """
        Delete a File Search store.
        
        Args:
            store_name: Store name/ID
            
        Returns:
            True if successful
        """
        try:
            self.client.file_search_stores.delete(name=store_name)
            logger.info(f"Deleted File Search store: {store_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting File Search store: {e}", exc_info=True)
            raise
    
    # File Upload
    
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
        Upload a file to a File Search store.
        
        Args:
            store_name: Target store name/ID
            file_path: Local path to file or GCS URI (gs://...)
            display_name: Optional display name for the file
            user_id: Optional user ID to associate with the file
            mime_type: Optional MIME type (not used by Gemini backend)
            wait_for_completion: Whether to wait for import to complete
            timeout: Maximum wait time in seconds
            
        Returns:
            UploadResult object
        """
        try:
            if not display_name:
                display_name = os.path.basename(file_path)
            
            # Add user_id to display name for tracking
            if user_id:
                display_name = f"[user:{user_id}] {display_name}"
            
            logger.info(f"Uploading file to store: {file_path} -> {store_name}")
            
            operation = self.client.file_search_stores.upload_to_file_search_store(
                file=file_path,
                file_search_store_name=store_name,
                config={'display_name': display_name}
            )
            
            operation_name = operation.name if hasattr(operation, 'name') else str(operation)
            logger.info(f"Upload operation started: {operation_name}")
            
            if wait_for_completion:
                elapsed = 0
                while not operation.done and elapsed < timeout:
                    time.sleep(5)
                    elapsed += 5
                    operation = self.client.operations.get(operation)
                    logger.debug(f"Waiting for import completion... ({elapsed}s)")
                
                if not operation.done:
                    logger.warning(f"Import operation timed out after {timeout}s")
                    return UploadResult(
                        status="timeout",
                        operation_name=operation_name,
                        display_name=display_name,
                        store_name=store_name,
                        metadata={
                            "message": f"Operation still in progress after {timeout}s"
                        }
                    )
                
                logger.info(f"File import completed: {display_name}")
                
                return UploadResult(
                    status="completed",
                    operation_name=operation_name,
                    display_name=display_name,
                    store_name=store_name,
                )
            else:
                return UploadResult(
                    status="in_progress",
                    operation_name=operation_name,
                    display_name=display_name,
                    store_name=store_name,
                )
                
        except Exception as e:
            logger.error(f"Error uploading file to store: {e}", exc_info=True)
            raise
    
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
        Import a file from Google Cloud Storage to a File Search store.
        
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
        """
        try:
            if not display_name:
                display_name = gcs_uri.split('/')[-1]
            
            # Add user_id to display name for tracking
            if user_id:
                display_name = f"[user:{user_id}] {display_name}"
            
            logger.info(f"Importing GCS file to store: {gcs_uri} -> {store_name} (user: {user_id})")
            
            config = {'display_name': display_name}
            if mime_type:
                config['mime_type'] = mime_type
            
            operation = self.client.file_search_stores.import_file(
                file_search_store_name=store_name,
                config=types.ImportFileConfig(
                    gcs_uri=gcs_uri,
                    **config
                )
            )
            
            operation_name = operation.name if hasattr(operation, 'name') else str(operation)
            logger.info(f"Import operation started: {operation_name}")
            
            if wait_for_completion:
                elapsed = 0
                while not operation.done and elapsed < timeout:
                    time.sleep(5)
                    elapsed += 5
                    operation = self.client.operations.get(operation)
                
                if operation.done:
                    logger.info(f"GCS file import completed: {display_name}")
                    return UploadResult(
                        status="completed",
                        operation_name=operation_name,
                        display_name=display_name,
                        store_name=store_name,
                        metadata={"gcs_uri": gcs_uri}
                    )
                else:
                    return UploadResult(
                        status="timeout",
                        operation_name=operation_name,
                        display_name=display_name,
                        store_name=store_name,
                        metadata={"gcs_uri": gcs_uri}
                    )
            else:
                return UploadResult(
                    status="in_progress",
                    operation_name=operation_name,
                    display_name=display_name,
                    store_name=store_name,
                    metadata={"gcs_uri": gcs_uri}
                )
                
        except Exception as e:
            logger.error(f"Error importing GCS file: {e}", exc_info=True)
            raise
    
    # Query
    
    def query(
        self,
        query: str,
        store_names: List[str],
        model: Optional[str] = None,
        include_grounding_metadata: bool = True,
        generation_config: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> FileSearchResult:
        """
        Query File Search stores with semantic search.
        
        Args:
            query: User's question or search query
            store_names: List of File Search store names to query
            model: Gemini model to use (default: gemini-2.5-flash)
            include_grounding_metadata: Whether to include citations
            generation_config: Optional generation parameters
            **kwargs: Additional parameters (ignored)
            
        Returns:
            FileSearchResult object
        """
        try:
            model = model or self.default_model
            
            logger.info(f"Querying File Search with: {query}")
            logger.info(f"Using stores: {store_names}")
            
            config = types.GenerateContentConfig(
                tools=[
                    types.Tool(
                        file_search=types.FileSearch(
                            file_search_store_names=store_names
                        )
                    )
                ]
            )
            
            if generation_config:
                for key, value in generation_config.items():
                    setattr(config, key, value)
            
            response = self.client.models.generate_content(
                model=model,
                contents=query,
                config=config
            )
            
            grounding_chunks = []
            metadata = {}
            
            # Extract grounding metadata if available
            if include_grounding_metadata and hasattr(response, 'candidates'):
                for candidate in response.candidates:
                    if hasattr(candidate, 'grounding_metadata'):
                        grounding_chunks = self._extract_grounding_chunks(
                            candidate.grounding_metadata
                        )
                        metadata["grounding_supports"] = self._extract_grounding_supports(
                            candidate.grounding_metadata
                        )
                        break
            
            result = FileSearchResult(
                text=response.text,
                model=model,
                stores_queried=store_names,
                grounding_chunks=grounding_chunks,
                metadata=metadata
            )
            
            logger.info(f"Query completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error querying File Search: {e}", exc_info=True)
            raise
    
    def _extract_grounding_chunks(self, grounding_metadata) -> List[GroundingChunk]:
        """Extract grounding chunks (citations) from metadata."""
        chunks = []
        
        if hasattr(grounding_metadata, 'grounding_chunks'):
            for chunk in grounding_metadata.grounding_chunks:
                chunk_data = {}
                
                if hasattr(chunk, 'web'):
                    chunk_data['type'] = 'web'
                    chunk_data['uri'] = chunk.web.uri if hasattr(chunk.web, 'uri') else None
                    chunk_data['document_name'] = chunk.web.title if hasattr(chunk.web, 'title') else None
                elif hasattr(chunk, 'file_search_result'):
                    chunk_data['type'] = 'file_search'
                    result = chunk.file_search_result
                    chunk_data['document_name'] = result.document_name if hasattr(result, 'document_name') else None
                    chunk_data['chunk_text'] = result.chunk_text if hasattr(result, 'chunk_text') else None
                    chunk_data['page_number'] = result.page_number if hasattr(result, 'page_number') else None
                
                if chunk_data:
                    chunks.append(GroundingChunk(**chunk_data))
        
        return chunks
    
    def _extract_grounding_supports(self, grounding_metadata) -> List[Dict[str, Any]]:
        """Extract grounding supports from metadata."""
        supports = []
        
        if hasattr(grounding_metadata, 'grounding_supports'):
            for support in grounding_metadata.grounding_supports:
                support_info = {
                    'segment': {
                        'start_index': support.segment.start_index if hasattr(support, 'segment') else None,
                        'end_index': support.segment.end_index if hasattr(support, 'segment') else None,
                    },
                    'grounding_chunk_indices': list(support.grounding_chunk_indices) if hasattr(support, 'grounding_chunk_indices') else [],
                    'confidence_scores': list(support.confidence_scores) if hasattr(support, 'confidence_scores') else []
                }
                supports.append(support_info)
        
        return supports
    
    # User-specific Operations
    
    def get_user_store_name(self, user_id: str) -> Optional[str]:
        """
        Get the File Search store name for a specific user.
        
        Args:
            user_id: User ID
            
        Returns:
            Store name if found, None otherwise
        """
        try:
            stores = self.list_stores()
            
            # Look for store with user_id in display name
            for store in stores:
                display_name = store.display_name.lower()
                if f"user_{user_id}" in display_name or f"user:{user_id}" in display_name:
                    return store.name
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user store: {e}")
            return None
    
    def get_or_create_user_store(self, user_id: str) -> str:
        """
        Get or create a File Search store for a specific user.
        
        Args:
            user_id: User ID
            
        Returns:
            Store name (creates new store if not found)
        """
        try:
            # Check if user store exists
            store_name = self.get_user_store_name(user_id)
            
            if store_name:
                logger.info(f"Found existing store for user {user_id}: {store_name}")
                return store_name
            
            # Create new store for user
            logger.info(f"Creating new store for user {user_id}")
            store = self.create_store(f"Documents for user_{user_id}")
            return store.name
            
        except Exception as e:
            logger.error(f"Error getting or creating user store: {e}")
            raise

