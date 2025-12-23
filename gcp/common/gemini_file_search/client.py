"""
Gemini File Search Client for RAG operations.

Provides async methods for:
- Creating File Search stores
- Uploading files to stores
- Using File Search in generateContent calls
- Managing documents and operations
"""

import asyncio
import logging
import time
from typing import Optional, Dict, Any, Union, BinaryIO, List
from pathlib import Path

from .config import GeminiFileSearchConfig
from .models import (
    FileSearchStore,
    FileSearchDocument,
    UploadConfig,
    GenerateContentConfig,
    GenerateContentResponse,
    GroundingMetadata,
    Citation,
    Operation,
    OperationStatus,
)

logger = logging.getLogger(__name__)


class GeminiFileSearchError(Exception):
    """Base exception for Gemini File Search client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class GeminiFileSearchClient:
    """
    Client for Gemini File Search API operations.
    
    Supports creating stores, uploading files, and using File Search in generateContent.
    
    Example:
        config = GeminiFileSearchConfig.from_env()
        client = GeminiFileSearchClient(config)
        
        # Create a store
        store = await client.create_store(display_name="My Documents")
        
        # Upload a file
        document = await client.upload_file(
            file_path="document.pdf",
            store_name=store.name
        )
        
        # Generate content with File Search
        response = await client.generate_content(
            contents="What is in the document?",
            file_search_store_names=[store.name]
        )
    """
    
    def __init__(self, config: GeminiFileSearchConfig):
        """
        Initialize Gemini File Search client.
        
        Args:
            config: GeminiFileSearchConfig instance
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
    
    async def create_store(
        self,
        display_name: Optional[str] = None
    ) -> FileSearchStore:
        """
        Create a new File Search store.
        
        Args:
            display_name: Optional display name for the store
            
        Returns:
            FileSearchStore: Created store
            
        Example:
            store = await client.create_store(display_name="My Documents")
        """
        client = self._get_client()
        
        try:
            config = {}
            if display_name:
                config["display_name"] = display_name
            
            store = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.file_search_stores.create(config=config)
            )
            
            logger.info(f"Created File Search store: {store.name}")
            
            return FileSearchStore(
                name=store.name,
                display_name=getattr(store, "display_name", None),
            )
            
        except Exception as e:
            logger.error(f"Failed to create File Search store: {e}")
            raise GeminiFileSearchError(
                message=f"Failed to create store: {e}",
                details={"display_name": display_name}
            )
    
    async def upload_file(
        self,
        file: Union[str, Path, BinaryIO],
        file_search_store_name: str,
        display_name: Optional[str] = None,
        mime_type: Optional[str] = None,
        wait_for_completion: bool = True,
        poll_interval: float = 5.0
    ) -> FileSearchDocument:
        """
        Upload a file to a File Search store.
        
        Args:
            file: File path (str/Path) or file-like object
            file_search_store_name: Name of the File Search store
            display_name: Optional display name for the file
            mime_type: Optional MIME type (auto-detected if not provided)
            wait_for_completion: Whether to wait for upload/import to complete
            poll_interval: Interval in seconds between polling for completion
            
        Returns:
            FileSearchDocument: Uploaded document
            
        Example:
            document = await client.upload_file(
                file="document.pdf",
                file_search_store_name=store.name,
                display_name="My Document"
            )
        """
        client = self._get_client()
        
        try:
            # Handle file path vs file-like object
            if isinstance(file, (str, Path)):
                file_path = Path(file)
                if not file_path.exists():
                    raise FileNotFoundError(f"File not found: {file_path}")
                file_obj = open(file_path, "rb")
                should_close = True
            else:
                file_obj = file
                should_close = False
            
            try:
                # Prepare config
                config = {}
                if display_name:
                    config["display_name"] = display_name
                
                operation = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: client.file_search_stores.upload_to_file_search_store(
                        file=file_obj,
                        file_search_store_name=file_search_store_name,
                        config=config
                    )
                )
                
                logger.info(f"Started upload operation: {operation.name}")
                
                # Wait for completion if requested
                if wait_for_completion:
                    operation = await self._wait_for_operation(
                        operation.name,
                        poll_interval=poll_interval
                    )
                    
                    if operation.status == OperationStatus.FAILED:
                        error_msg = operation.error.get("message", "Unknown error") if operation.error else "Unknown error"
                        raise GeminiFileSearchError(
                            message=f"Upload failed: {error_msg}",
                            details={"operation": operation.name}
                        )
                    
                    # Extract document from operation response
                    if operation.response:
                        doc_data = operation.response
                        return FileSearchDocument(
                            name=doc_data.get("name", ""),
                            display_name=doc_data.get("display_name"),
                            mime_type=doc_data.get("mime_type"),
                            size_bytes=doc_data.get("size_bytes"),
                            state=doc_data.get("state"),
                        )
                    else:
                        # Fallback: operation completed but no response data
                        logger.warning("Operation completed but no response data")
                        return FileSearchDocument(
                            name=f"{file_search_store_name}/documents/{operation.name.split('/')[-1]}",
                            display_name=display_name,
                        )
                else:
                    # Return a placeholder document if not waiting
                    return FileSearchDocument(
                        name=f"{file_search_store_name}/documents/pending",
                        display_name=display_name,
                    )
                    
            finally:
                if should_close:
                    file_obj.close()
                    
        except Exception as e:
            logger.error(f"Failed to upload file: {e}")
            raise GeminiFileSearchError(
                message=f"Failed to upload file: {e}",
                details={
                    "file_search_store_name": file_search_store_name,
                    "display_name": display_name
                }
            )
    
    async def _wait_for_operation(
        self,
        operation_name: str,
        poll_interval: float = 5.0,
        max_wait_time: Optional[float] = None
    ) -> Operation:
        """
        Wait for a long-running operation to complete.
        
        Args:
            operation_name: Name of the operation
            poll_interval: Interval between polls in seconds
            max_wait_time: Maximum time to wait in seconds (None for no limit)
            
        Returns:
            Operation: Completed operation
        """
        client = self._get_client()
        start_time = time.time()
        
        while True:
            operation = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.operations.get(operation_name)
            )
            
            if operation.done:
                logger.info(f"Operation completed: {operation_name}")
                return Operation(
                    name=operation.name,
                    done=operation.done,
                    error=getattr(operation, "error", None),
                    response=getattr(operation, "response", None),
                )
            
            if max_wait_time and (time.time() - start_time) > max_wait_time:
                raise GeminiFileSearchError(
                    message=f"Operation timed out after {max_wait_time} seconds",
                    details={"operation_name": operation_name}
                )
            
            await asyncio.sleep(poll_interval)
    
    async def generate_content(
        self,
        contents: str,
        file_search_store_names: List[str],
        model: str = "gemini-3-flash-preview",
        temperature: Optional[float] = None,
        max_output_tokens: Optional[int] = None,
        response_mime_type: Optional[str] = None,
        response_schema: Optional[Dict[str, Any]] = None,
    ) -> GenerateContentResponse:
        """
        Generate content using File Search for RAG.
        
        Args:
            contents: User prompt/question
            file_search_store_names: List of File Search store names to search
            model: Model to use (must support File Search)
            temperature: Temperature for generation
            max_output_tokens: Maximum output tokens
            response_mime_type: Response MIME type (e.g., 'application/json')
            response_schema: Response schema for structured output
            
        Returns:
            GenerateContentResponse: Generated content with citations
            
        Example:
            response = await client.generate_content(
                contents="What is in the document?",
                file_search_store_names=[store.name]
            )
            print(response.text)
            for citation in response.citations:
                print(f"Cited: {citation.title}")
        """
        client = self._get_client()
        
        try:
            from google.genai import types
            
            # Build config
            config = {
                "tools": [
                    types.Tool(
                        file_search=types.FileSearch(
                            file_search_store_names=file_search_store_names
                        )
                    )
                ]
            }
            
            if temperature is not None:
                config["temperature"] = temperature
            if max_output_tokens is not None:
                config["max_output_tokens"] = max_output_tokens
            if response_mime_type:
                config["response_mime_type"] = response_mime_type
            if response_schema:
                config["response_schema"] = response_schema
            
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(**config)
                )
            )
            
            # Parse response
            text = response.text if hasattr(response, "text") else ""
            
            # Parse grounding metadata
            grounding_metadata = None
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "grounding_metadata"):
                    gm = candidate.grounding_metadata
                    citations = []
                    if hasattr(gm, "grounding_chunks"):
                        for chunk in gm.grounding_chunks:
                            if hasattr(chunk, "web"):
                                citations.append(Citation(
                                    uri=getattr(chunk.web, "uri", None),
                                    title=getattr(chunk.web, "title", None),
                                ))
                            elif hasattr(chunk, "retrieved_context"):
                                rc = chunk.retrieved_context
                                citations.append(Citation(
                                    uri=getattr(rc, "uri", None),
                                    title=getattr(rc, "title", None),
                                    start_index=getattr(chunk, "start_index", None),
                                    end_index=getattr(chunk, "end_index", None),
                                ))
                    
                    grounding_metadata = GroundingMetadata(
                        citations=citations if citations else None,
                        retrieval_queries=getattr(gm, "retrieval_queries", None),
                    )
            
            return GenerateContentResponse(
                text=text,
                grounding_metadata=grounding_metadata,
                model=model,
                finish_reason=getattr(response, "finish_reason", None),
            )
            
        except Exception as e:
            logger.error(f"Failed to generate content: {e}")
            raise GeminiFileSearchError(
                message=f"Failed to generate content: {e}",
                details={
                    "model": model,
                    "file_search_store_names": file_search_store_names
                }
            )
    
    async def list_stores(self) -> List[FileSearchStore]:
        """
        List all File Search stores.
        
        Returns:
            List[FileSearchStore]: List of stores
        """
        client = self._get_client()
        
        try:
            stores = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: list(client.file_search_stores.list())
            )
            
            return [
                FileSearchStore(
                    name=store.name,
                    display_name=getattr(store, "display_name", None),
                )
                for store in stores
            ]
            
        except Exception as e:
            logger.error(f"Failed to list stores: {e}")
            raise GeminiFileSearchError(
                message=f"Failed to list stores: {e}"
            )
    
    async def get_store(self, store_name: str) -> FileSearchStore:
        """
        Get a File Search store by name.
        
        Args:
            store_name: Name of the store
            
        Returns:
            FileSearchStore: Store information
        """
        client = self._get_client()
        
        try:
            store = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.file_search_stores.get(store_name)
            )
            
            return FileSearchStore(
                name=store.name,
                display_name=getattr(store, "display_name", None),
            )
            
        except Exception as e:
            logger.error(f"Failed to get store: {e}")
            raise GeminiFileSearchError(
                message=f"Failed to get store: {e}",
                details={"store_name": store_name}
            )
    
    async def delete_store(self, store_name: str) -> None:
        """
        Delete a File Search store.
        
        Args:
            store_name: Name of the store to delete
        """
        client = self._get_client()
        
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: client.file_search_stores.delete(store_name)
            )
            
            logger.info(f"Deleted File Search store: {store_name}")
            
        except Exception as e:
            logger.error(f"Failed to delete store: {e}")
            raise GeminiFileSearchError(
                message=f"Failed to delete store: {e}",
                details={"store_name": store_name}
            )

