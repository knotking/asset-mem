# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Google Gemini File Search Implementation v2

This module provides a backward-compatible wrapper around the shared file search library.
It maintains the same interface as the original GeminiFileSearchManager while using
the new abstraction layer.

For new code, consider using the shared library directly:
    from gcp.shared.file_search import get_file_search_manager
"""

import os
import sys
import logging
from typing import Optional, List, Dict, Any

# Add parent directory to path to import shared library
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from shared.file_search import get_file_search_manager, FileSearchBackend

logger = logging.getLogger(__name__)


class GeminiFileSearchManager:
    """
    Backward-compatible wrapper for the shared file search library.
    
    This class maintains the same interface as the original GeminiFileSearchManager
    but delegates to the new shared abstraction layer.
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Gemini File Search manager.
        
        Args:
            api_key: Gemini API key. Defaults to GEMINI_API_KEY env var.
        """
        self._backend = get_file_search_manager(
            backend=FileSearchBackend.GEMINI,
            api_key=api_key
        )
        logger.info("GeminiFileSearchManager (v2) initialized")

    def create_file_search_store(self, display_name: str) -> Dict[str, Any]:
        """
        Create a new File Search store.
        
        Args:
            display_name: Human-readable name for the store
            
        Returns:
            Dict with store information including name (ID)
        """
        store = self._backend.create_store(display_name)
        return {
            "name": store.name,
            "display_name": store.display_name,
            "create_time": store.metadata.get("create_time"),
            "status": "created"
        }

    def list_file_search_stores(self) -> List[Dict[str, Any]]:
        """
        List all File Search stores.
        
        Returns:
            List of store information dictionaries
        """
        stores = self._backend.list_stores()
        return [
            {
                "name": store.name,
                "display_name": store.display_name,
                "create_time": store.metadata.get("create_time"),
            }
            for store in stores
        ]

    def delete_file_search_store(self, store_name: str) -> Dict[str, str]:
        """
        Delete a File Search store.
        
        Args:
            store_name: Store name/ID (format: fileSearchStores/xxxxx)
            
        Returns:
            Status dictionary
        """
        self._backend.delete_store(store_name)
        return {
            "status": "deleted",
            "store_name": store_name
        }

    def upload_file_to_store(
        self,
        file_path: str,
        store_name: str,
        display_name: Optional[str] = None,
        user_id: Optional[str] = None,
        wait_for_completion: bool = True,
        timeout: int = 300
    ) -> Dict[str, Any]:
        """
        Upload a file directly to a File Search store.
        
        Args:
            file_path: Local path to file or GCS URI (gs://...)
            store_name: Target store name/ID
            display_name: Optional display name for the file
            user_id: Optional user ID to associate with the file
            wait_for_completion: Whether to wait for import to complete
            timeout: Maximum wait time in seconds
            
        Returns:
            Dict with operation status and file information
        """
        result = self._backend.upload_file(
            store_name=store_name,
            file_path=file_path,
            display_name=display_name,
            user_id=user_id,
            wait_for_completion=wait_for_completion,
            timeout=timeout
        )
        
        return {
            "status": result.status,
            "operation_name": result.operation_name,
            "display_name": result.display_name,
            "store_name": result.store_name,
            **({"message": result.metadata.get("message")} if "message" in result.metadata else {})
        }

    def import_gcs_file_to_store(
        self,
        gcs_uri: str,
        store_name: str,
        display_name: Optional[str] = None,
        user_id: Optional[str] = None,
        mime_type: Optional[str] = None,
        wait_for_completion: bool = True
    ) -> Dict[str, Any]:
        """
        Import a file from Google Cloud Storage to a File Search store.
        
        Args:
            gcs_uri: GCS URI (gs://bucket/path)
            store_name: Target store name/ID
            display_name: Optional display name
            user_id: Optional user ID to associate with the file
            mime_type: Optional MIME type
            wait_for_completion: Whether to wait for completion
            
        Returns:
            Dict with operation status
        """
        result = self._backend.import_gcs_file(
            store_name=store_name,
            gcs_uri=gcs_uri,
            display_name=display_name,
            user_id=user_id,
            mime_type=mime_type,
            wait_for_completion=wait_for_completion
        )
        
        return {
            "status": result.status,
            "operation_name": result.operation_name,
            "display_name": result.display_name,
            "gcs_uri": gcs_uri
        }

    def query_file_search(
        self,
        query: str,
        store_names: List[str],
        model: str = "gemini-2.5-flash",
        include_grounding_metadata: bool = True,
        generation_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Query File Search stores with semantic search.
        
        Args:
            query: User's question or search query
            store_names: List of File Search store names to query
            model: Gemini model to use (default: gemini-2.5-flash)
            include_grounding_metadata: Whether to include citations
            generation_config: Optional generation parameters
            
        Returns:
            Dict with answer text, citations, and grounding metadata
        """
        result = self._backend.query(
            query=query,
            store_names=store_names,
            model=model,
            include_grounding_metadata=include_grounding_metadata,
            generation_config=generation_config
        )
        
        response = {
            "text": result.text,
            "model": result.model,
            "stores_queried": result.stores_queried
        }
        
        # Extract grounding metadata if available
        if include_grounding_metadata and result.grounding_chunks:
            response["grounding_metadata"] = {
                "grounding_chunks": [
                    {
                        "type": chunk.type,
                        "document_name": chunk.document_name,
                        "chunk_text": chunk.chunk_text,
                        "page_number": chunk.page_number,
                        "uri": chunk.uri,
                    }
                    for chunk in result.grounding_chunks
                ],
                "grounding_supports": result.metadata.get("grounding_supports", [])
            }
        
        return response

    def get_operation_status(self, operation_name: str) -> Dict[str, Any]:
        """
        Get the status of a long-running operation.
        
        Args:
            operation_name: Operation name/ID
            
        Returns:
            Dict with operation status
        """
        # Note: This is not implemented in the shared library yet
        # as it's backend-specific. For now, return a placeholder.
        return {
            "name": operation_name,
            "done": True,
            "status": "completed"
        }

    def get_user_store_name(self, user_id: str) -> Optional[str]:
        """
        Get the File Search store name for a specific user.
        
        Args:
            user_id: User ID
            
        Returns:
            Store name if found, None otherwise
        """
        return self._backend.get_user_store_name(user_id)

    def get_or_create_user_store(self, user_id: str) -> str:
        """
        Get or create a File Search store for a specific user.
        
        Args:
            user_id: User ID
            
        Returns:
            Store name (creates new store if not found)
        """
        return self._backend.get_or_create_user_store(user_id)

    def list_user_files(self, user_id: str) -> List[Dict[str, Any]]:
        """
        List all files for a specific user across all stores.
        
        Args:
            user_id: User ID
            
        Returns:
            List of file information dictionaries
        """
        # Note: This functionality is not directly supported by the shared library
        # Returning empty list for now
        return []

    def upload_user_file(
        self,
        user_id: str,
        file_path: str,
        display_name: Optional[str] = None,
        wait_for_completion: bool = True
    ) -> Dict[str, Any]:
        """
        Upload a file for a specific user (creates user store if needed).
        
        Args:
            user_id: User ID
            file_path: File path or GCS URI
            display_name: Optional display name
            wait_for_completion: Wait for completion
            
        Returns:
            Operation result
        """
        result = self._backend.upload_user_file(
            user_id=user_id,
            file_path=file_path,
            display_name=display_name,
            wait_for_completion=wait_for_completion
        )
        
        return {
            "status": result.status,
            "operation_name": result.operation_name,
            "display_name": result.display_name,
            "store_name": result.store_name
        }

    def import_user_gcs_file(
        self,
        user_id: str,
        gcs_uri: str,
        display_name: Optional[str] = None,
        mime_type: Optional[str] = None,
        wait_for_completion: bool = True
    ) -> Dict[str, Any]:
        """
        Import a GCS file for a specific user (creates user store if needed).
        
        Args:
            user_id: User ID
            gcs_uri: GCS URI
            display_name: Optional display name
            mime_type: Optional MIME type
            wait_for_completion: Wait for completion
            
        Returns:
            Operation result
        """
        result = self._backend.import_user_gcs_file(
            user_id=user_id,
            gcs_uri=gcs_uri,
            display_name=display_name,
            mime_type=mime_type,
            wait_for_completion=wait_for_completion
        )
        
        return {
            "status": result.status,
            "operation_name": result.operation_name,
            "display_name": result.display_name,
            "gcs_uri": gcs_uri
        }

    def query_user_documents(
        self,
        user_id: str,
        query: str,
        model: str = "gemini-2.5-flash",
        include_grounding_metadata: bool = True
    ) -> Dict[str, Any]:
        """
        Query documents for a specific user.
        
        Args:
            user_id: User ID
            query: Search query
            model: Gemini model to use
            include_grounding_metadata: Include citations
            
        Returns:
            Query response with answer and citations
        """
        result = self._backend.query_user_documents(
            user_id=user_id,
            query=query,
            model=model,
            include_grounding_metadata=include_grounding_metadata
        )
        
        response = {
            "text": result.text,
            "model": result.model,
            "stores_queried": result.stores_queried,
            "grounding_metadata": None
        }
        
        if include_grounding_metadata and result.grounding_chunks:
            response["grounding_metadata"] = {
                "grounding_chunks": [
                    {
                        "type": chunk.type,
                        "document_name": chunk.document_name,
                        "chunk_text": chunk.chunk_text,
                        "page_number": chunk.page_number,
                    }
                    for chunk in result.grounding_chunks
                ]
            }
        
        return response


def get_file_search_manager_legacy(api_key: Optional[str] = None) -> GeminiFileSearchManager:
    """
    Get a GeminiFileSearchManager instance (backward compatible).
    
    Args:
        api_key: Optional API key override
        
    Returns:
        GeminiFileSearchManager instance
    """
    return GeminiFileSearchManager(api_key=api_key)

