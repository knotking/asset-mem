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
Google Gemini File Search Implementation

This module provides RAG (Retrieval Augmented Generation) capabilities using
Google's Gemini API File Search feature. It enables semantic search over
document collections with AI-powered responses and citations.

Reference: https://ai.google.dev/gemini-api/docs/file-search
"""

import os
import logging
import time
from typing import Optional, List, Dict, Any
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


class GeminiFileSearchManager:
    """
    Manages Google Gemini File Search stores and operations.
    
    Provides functionality to:
    - Create and manage File Search stores
    - Upload documents directly to stores
    - Import files from GCS into stores
    - Query documents with semantic search
    - Get responses with citations and grounding metadata
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Gemini File Search manager.
        
        Args:
            api_key: Gemini API key. Defaults to GEMINI_API_KEY env var.
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY must be provided or set in environment")
        
        self.client = genai.Client(api_key=self.api_key)
        logger.info("GeminiFileSearchManager initialized")

    def create_file_search_store(self, display_name: str) -> Dict[str, Any]:
        """
        Create a new File Search store.
        
        Args:
            display_name: Human-readable name for the store
            
        Returns:
            Dict with store information including name (ID)
        """
        try:
            store = self.client.file_search_stores.create(
                config={'display_name': display_name}
            )
            
            logger.info(f"Created File Search store: {store.name} ({display_name})")
            
            return {
                "name": store.name,
                "display_name": display_name,
                "create_time": store.create_time.isoformat() if hasattr(store, 'create_time') else None,
                "status": "created"
            }
            
        except Exception as e:
            logger.error(f"Error creating File Search store: {e}", exc_info=True)
            raise

    def list_file_search_stores(self) -> List[Dict[str, Any]]:
        """
        List all File Search stores.
        
        Returns:
            List of store information dictionaries
        """
        try:
            stores = self.client.file_search_stores.list()
            
            result = []
            for store in stores:
                result.append({
                    "name": store.name,
                    "display_name": getattr(store, 'display_name', ''),
                    "create_time": store.create_time.isoformat() if hasattr(store, 'create_time') else None,
                })
            
            logger.info(f"Listed {len(result)} File Search stores")
            return result
            
        except Exception as e:
            logger.error(f"Error listing File Search stores: {e}", exc_info=True)
            raise

    def delete_file_search_store(self, store_name: str) -> Dict[str, str]:
        """
        Delete a File Search store.
        
        Args:
            store_name: Store name/ID (format: fileSearchStores/xxxxx)
            
        Returns:
            Status dictionary
        """
        try:
            self.client.file_search_stores.delete(name=store_name)
            logger.info(f"Deleted File Search store: {store_name}")
            
            return {
                "status": "deleted",
                "store_name": store_name
            }
            
        except Exception as e:
            logger.error(f"Error deleting File Search store: {e}", exc_info=True)
            raise

    def upload_file_to_store(
        self,
        file_path: str,
        store_name: str,
        display_name: Optional[str] = None,
        wait_for_completion: bool = True,
        timeout: int = 300
    ) -> Dict[str, Any]:
        """
        Upload a file directly to a File Search store.
        
        Args:
            file_path: Local path to file or GCS URI (gs://...)
            store_name: Target store name/ID
            display_name: Optional display name for the file
            wait_for_completion: Whether to wait for import to complete
            timeout: Maximum wait time in seconds
            
        Returns:
            Dict with operation status and file information
        """
        try:
            if not display_name:
                display_name = os.path.basename(file_path)
            
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
                    return {
                        "status": "timeout",
                        "operation_name": operation_name,
                        "display_name": display_name,
                        "message": f"Operation still in progress after {timeout}s"
                    }
                
                logger.info(f"File import completed: {display_name}")
                
                return {
                    "status": "completed",
                    "operation_name": operation_name,
                    "display_name": display_name,
                    "store_name": store_name
                }
            else:
                return {
                    "status": "in_progress",
                    "operation_name": operation_name,
                    "display_name": display_name,
                    "store_name": store_name
                }
                
        except Exception as e:
            logger.error(f"Error uploading file to store: {e}", exc_info=True)
            raise

    def import_gcs_file_to_store(
        self,
        gcs_uri: str,
        store_name: str,
        display_name: Optional[str] = None,
        mime_type: Optional[str] = None,
        wait_for_completion: bool = True
    ) -> Dict[str, Any]:
        """
        Import a file from Google Cloud Storage to a File Search store.
        
        Args:
            gcs_uri: GCS URI (gs://bucket/path)
            store_name: Target store name/ID
            display_name: Optional display name
            mime_type: Optional MIME type
            wait_for_completion: Whether to wait for completion
            
        Returns:
            Dict with operation status
        """
        try:
            if not display_name:
                display_name = gcs_uri.split('/')[-1]
            
            logger.info(f"Importing GCS file to store: {gcs_uri} -> {store_name}")
            
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
                timeout = 300
                elapsed = 0
                while not operation.done and elapsed < timeout:
                    time.sleep(5)
                    elapsed += 5
                    operation = self.client.operations.get(operation)
                
                if operation.done:
                    logger.info(f"GCS file import completed: {display_name}")
                    return {
                        "status": "completed",
                        "operation_name": operation_name,
                        "display_name": display_name,
                        "gcs_uri": gcs_uri
                    }
                else:
                    return {
                        "status": "timeout",
                        "operation_name": operation_name,
                        "display_name": display_name
                    }
            else:
                return {
                    "status": "in_progress",
                    "operation_name": operation_name,
                    "display_name": display_name,
                    "gcs_uri": gcs_uri
                }
                
        except Exception as e:
            logger.error(f"Error importing GCS file: {e}", exc_info=True)
            raise

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
        try:
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
            
            result = {
                "text": response.text,
                "model": model,
                "stores_queried": store_names
            }
            
            # Extract grounding metadata if available
            if include_grounding_metadata and hasattr(response, 'candidates'):
                for candidate in response.candidates:
                    if hasattr(candidate, 'grounding_metadata'):
                        result["grounding_metadata"] = {
                            "grounding_chunks": self._extract_grounding_chunks(
                                candidate.grounding_metadata
                            ),
                            "grounding_supports": self._extract_grounding_supports(
                                candidate.grounding_metadata
                            )
                        }
                        break
            
            logger.info(f"Query completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error querying File Search: {e}", exc_info=True)
            raise

    def _extract_grounding_chunks(self, grounding_metadata) -> List[Dict[str, Any]]:
        """Extract grounding chunks (citations) from metadata."""
        chunks = []
        
        if hasattr(grounding_metadata, 'grounding_chunks'):
            for chunk in grounding_metadata.grounding_chunks:
                chunk_info = {}
                
                if hasattr(chunk, 'web'):
                    chunk_info['type'] = 'web'
                    chunk_info['uri'] = chunk.web.uri if hasattr(chunk.web, 'uri') else None
                    chunk_info['title'] = chunk.web.title if hasattr(chunk.web, 'title') else None
                elif hasattr(chunk, 'file_search_result'):
                    chunk_info['type'] = 'file_search'
                    result = chunk.file_search_result
                    chunk_info['document_name'] = result.document_name if hasattr(result, 'document_name') else None
                    chunk_info['chunk_text'] = result.chunk_text if hasattr(result, 'chunk_text') else None
                    chunk_info['page_number'] = result.page_number if hasattr(result, 'page_number') else None
                
                if chunk_info:
                    chunks.append(chunk_info)
        
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

    def get_operation_status(self, operation_name: str) -> Dict[str, Any]:
        """
        Get the status of a long-running operation.
        
        Args:
            operation_name: Operation name/ID
            
        Returns:
            Dict with operation status
        """
        try:
            operation = self.client.operations.get(name=operation_name)
            
            return {
                "name": operation_name,
                "done": operation.done,
                "status": "completed" if operation.done else "in_progress"
            }
            
        except Exception as e:
            logger.error(f"Error getting operation status: {e}", exc_info=True)
            raise


def get_file_search_manager(api_key: Optional[str] = None) -> GeminiFileSearchManager:
    """
    Get a GeminiFileSearchManager instance.
    
    Args:
        api_key: Optional API key override
        
    Returns:
        GeminiFileSearchManager instance
    """
    return GeminiFileSearchManager(api_key=api_key)

