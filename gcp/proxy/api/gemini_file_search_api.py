"""
Gemini File Search API handlers for proxy API.

Provides endpoints for:
- Creating File Search stores
- Uploading files to stores
- Generating content with File Search (RAG)
- Managing stores and documents
"""

import os
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path
import sys

# Add common module to path - use absolute path resolution
# Try multiple possible paths for the common module
_current_dir = os.path.dirname(os.path.abspath(__file__))
_possible_paths = [
    os.path.abspath(os.path.join(_current_dir, '../../common')),
    os.path.abspath(os.path.join(_current_dir, '../../../common')),
    '/app/common',  # Docker container path
]

_common_dir = None
for path in _possible_paths:
    if os.path.exists(path) and os.path.isdir(path):
        _common_dir = path
        break

if _common_dir and _common_dir not in sys.path:
    sys.path.insert(0, _common_dir)

# Try to import gemini_file_search, but handle gracefully if not available
try:
    from gemini_file_search import (
        GeminiFileSearchClient,
        GeminiFileSearchConfig,
        GeminiFileSearchError,
    )
    from gemini_file_search.models import (
        FileSearchStore,
        FileSearchDocument,
        GenerateContentResponse,
    )
    GEMINI_FILE_SEARCH_AVAILABLE = True
except ImportError as e:
    logger.warning(f"gemini_file_search module not available: {e}. File Search features will be disabled.")
    GEMINI_FILE_SEARCH_AVAILABLE = False
    # Create dummy classes to prevent errors
    class GeminiFileSearchError(Exception):
        pass
    class GeminiFileSearchConfig:
        @classmethod
        def from_env(cls):
            return cls()
    class GeminiFileSearchClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass

logger = logging.getLogger(__name__)

# Initialize client configuration
_config = None


def get_config() -> GeminiFileSearchConfig:
    """Get or create Gemini File Search configuration."""
    if not GEMINI_FILE_SEARCH_AVAILABLE:
        raise RuntimeError("Gemini File Search is not available. Check module installation.")
    global _config
    if _config is None:
        _config = GeminiFileSearchConfig.from_env()
    return _config


def get_client() -> GeminiFileSearchClient:
    """Get a Gemini File Search client instance."""
    if not GEMINI_FILE_SEARCH_AVAILABLE:
        raise RuntimeError("Gemini File Search is not available. Check module installation.")
    return GeminiFileSearchClient(get_config())


async def create_file_search_store(
    display_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new File Search store.
    
    Args:
        display_name: Optional display name for the store
        
    Returns:
        Dict with store information
    """
    try:
        async with get_client() as client:
            store = await client.create_store(display_name=display_name)
            
            return {
                "status": "success",
                "store": {
                    "name": store.name,
                    "store_id": store.store_id,
                    "display_name": store.display_name,
                }
            }
    except GeminiFileSearchError as e:
        logger.error(f"Gemini File Search error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "details": e.details,
        }
    except Exception as e:
        logger.error(f"Unexpected error creating store: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
        }


async def upload_file_to_store(
    file_url: str,
    file_search_store_name: str,
    display_name: Optional[str] = None,
    wait_for_completion: bool = True,
) -> Dict[str, Any]:
    """
    Upload a file to a File Search store.
    
    Args:
        file_url: URL or path to the file (supports gs://, https://, or local paths)
        file_search_store_name: Name of the File Search store
        display_name: Optional display name for the file
        wait_for_completion: Whether to wait for indexing to complete
        
    Returns:
        Dict with document information
    """
    try:
        async with get_client() as client:
            # Handle different URL types
            if file_url.startswith("gs://") or file_url.startswith("https://"):
                # For GCS or HTTPS URLs, we need to download first or use a different approach
                # For now, we'll try to use the URL directly if the SDK supports it
                # Otherwise, download temporarily
                import tempfile
                import requests
                from urllib.parse import urlparse
                
                if file_url.startswith("gs://"):
                    # For GCS URLs, we might need to use gsutil or download via signed URL
                    # For simplicity, download to temp file
                    logger.warning("GCS URLs may require special handling")
                
                # Download file temporarily
                with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                    response = requests.get(file_url, stream=True)
                    response.raise_for_status()
                    for chunk in response.iter_content(chunk_size=8192):
                        tmp_file.write(chunk)
                    tmp_path = tmp_file.name
                
                try:
                    document = await client.upload_file(
                        file=tmp_path,
                        file_search_store_name=file_search_store_name,
                        display_name=display_name,
                        wait_for_completion=wait_for_completion,
                    )
                finally:
                    # Clean up temp file
                    os.unlink(tmp_path)
            else:
                # Local file path
                document = await client.upload_file(
                    file=file_url,
                    file_search_store_name=file_search_store_name,
                    display_name=display_name,
                    wait_for_completion=wait_for_completion,
                )
            
            return {
                "status": "success",
                "document": {
                    "name": document.name,
                    "document_id": document.document_id,
                    "display_name": document.display_name,
                    "mime_type": document.mime_type,
                    "size_bytes": document.size_bytes,
                    "state": document.state,
                }
            }
    except GeminiFileSearchError as e:
        logger.error(f"Gemini File Search error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "details": e.details,
        }
    except Exception as e:
        logger.error(f"Unexpected error uploading file: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
        }


async def generate_content_with_file_search(
    contents: str,
    file_search_store_names: List[str],
    model: str = "gemini-2.5-flash",
    temperature: Optional[float] = None,
    max_output_tokens: Optional[int] = None,
    response_mime_type: Optional[str] = None,
    response_schema: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
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
        Dict with generated content and citations
    """
    try:
        async with get_client() as client:
            response = await client.generate_content(
                contents=contents,
                file_search_store_names=file_search_store_names,
                model=model,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                response_mime_type=response_mime_type,
                response_schema=response_schema,
            )
            
            result = {
                "status": "success",
                "text": response.text,
                "model": response.model,
                "finish_reason": response.finish_reason,
                "has_citations": response.has_citations,
            }
            
            # Add citations if available
            if response.citations:
                result["citations"] = [
                    {
                        "uri": citation.uri,
                        "title": citation.title,
                        "start_index": citation.start_index,
                        "end_index": citation.end_index,
                        "license": citation.license,
                    }
                    for citation in response.citations
                ]
            
            # Add retrieval queries if available
            if response.grounding_metadata and response.grounding_metadata.retrieval_queries:
                result["retrieval_queries"] = response.grounding_metadata.retrieval_queries
            
            return result
            
    except GeminiFileSearchError as e:
        logger.error(f"Gemini File Search error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "details": e.details,
        }
    except Exception as e:
        logger.error(f"Unexpected error generating content: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
        }


async def list_file_search_stores() -> Dict[str, Any]:
    """
    List all File Search stores.
    
    Returns:
        Dict with list of stores
    """
    try:
        async with get_client() as client:
            stores = await client.list_stores()
            
            return {
                "status": "success",
                "stores": [
                    {
                        "name": store.name,
                        "store_id": store.store_id,
                        "display_name": store.display_name,
                    }
                    for store in stores
                ]
            }
    except GeminiFileSearchError as e:
        logger.error(f"Gemini File Search error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "details": e.details,
        }
    except Exception as e:
        logger.error(f"Unexpected error listing stores: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
        }


async def get_file_search_store(store_name: str) -> Dict[str, Any]:
    """
    Get a File Search store by name.
    
    Args:
        store_name: Name of the store
        
    Returns:
        Dict with store information
    """
    try:
        async with get_client() as client:
            store = await client.get_store(store_name)
            
            return {
                "status": "success",
                "store": {
                    "name": store.name,
                    "store_id": store.store_id,
                    "display_name": store.display_name,
                }
            }
    except GeminiFileSearchError as e:
        logger.error(f"Gemini File Search error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "details": e.details,
        }
    except Exception as e:
        logger.error(f"Unexpected error getting store: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
        }


async def delete_file_search_store(store_name: str) -> Dict[str, Any]:
    """
    Delete a File Search store.
    
    Args:
        store_name: Name of the store to delete
        
    Returns:
        Dict with deletion status
    """
    try:
        async with get_client() as client:
            await client.delete_store(store_name)
            
            return {
                "status": "success",
                "message": f"Store {store_name} deleted successfully",
            }
    except GeminiFileSearchError as e:
        logger.error(f"Gemini File Search error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "details": e.details,
        }
    except Exception as e:
        logger.error(f"Unexpected error deleting store: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
        }

