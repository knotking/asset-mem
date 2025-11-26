"""
Factory function for creating file search manager instances.

Provides a convenient way to instantiate the appropriate backend based on configuration.
"""

import logging
from typing import Optional, Union

from .base import FileSearchManager, FileSearchBackend
from .gemini_backend import GeminiFileSearchBackend
from .vertex_backend import VertexAIRAGBackend

logger = logging.getLogger(__name__)


def get_file_search_manager(
    backend: Union[str, FileSearchBackend] = "gemini",
    **kwargs
) -> FileSearchManager:
    """
    Factory function to create a file search manager instance.
    
    Args:
        backend: Backend type ("gemini" or "vertex", or FileSearchBackend enum)
        **kwargs: Backend-specific configuration parameters
        
    For Gemini backend:
        api_key: Gemini API key (optional, defaults to GEMINI_API_KEY env var)
        default_model: Default model for queries (default: gemini-2.5-flash)
        
    For Vertex backend:
        project_id: GCP project ID (optional, defaults to GCP_PROJECT_ID env var)
        location: GCP location (default: us-central1)
        corpus_name: Default RAG corpus name (optional)
        gcs_bucket: GCS bucket for file operations (optional)
        default_model: Default model for queries (default: gemini-2.5-flash)
        use_genai: Use google-genai SDK for queries (default: True)
    
    Returns:
        FileSearchManager instance (either GeminiFileSearchBackend or VertexAIRAGBackend)
        
    Raises:
        ValueError: If backend is invalid or required configuration is missing
        
    Examples:
        # Create Gemini backend
        manager = get_file_search_manager(backend='gemini', api_key='your-key')
        
        # Create Vertex backend
        manager = get_file_search_manager(
            backend='vertex',
            project_id='my-project',
            location='us-central1',
            corpus_name='projects/123/locations/us-central1/ragCorpora/456'
        )
        
        # Auto-detect based on environment
        manager = get_file_search_manager()  # Defaults to Gemini
    """
    # Convert string to enum if needed
    if isinstance(backend, str):
        try:
            backend = FileSearchBackend(backend.lower())
        except ValueError:
            raise ValueError(
                f"Invalid backend: {backend}. Must be 'gemini' or 'vertex'"
            )
    
    # Create appropriate backend
    if backend == FileSearchBackend.GEMINI:
        logger.info("Creating Gemini File Search backend")
        return GeminiFileSearchBackend(**kwargs)
    
    elif backend == FileSearchBackend.VERTEX:
        logger.info("Creating Vertex AI RAG backend")
        return VertexAIRAGBackend(**kwargs)
    
    else:
        raise ValueError(f"Unsupported backend: {backend}")


def auto_detect_backend(**kwargs) -> FileSearchManager:
    """
    Auto-detect and create the appropriate backend based on environment.
    
    Detection logic:
    1. If GEMINI_API_KEY is set and no GCP_PROJECT_ID, use Gemini
    2. If GCP_PROJECT_ID is set and USER_UPLOAD_RAG_CORPUS is set, use Vertex
    3. Default to Gemini
    
    Args:
        **kwargs: Backend-specific configuration (overrides auto-detection)
        
    Returns:
        FileSearchManager instance
    """
    import os
    
    # Check what's available in environment
    has_gemini_key = bool(os.environ.get("GEMINI_API_KEY"))
    has_gcp_project = bool(os.environ.get("GCP_PROJECT_ID"))
    has_rag_corpus = bool(os.environ.get("USER_UPLOAD_RAG_CORPUS"))
    
    if has_gcp_project and has_rag_corpus:
        logger.info("Auto-detected Vertex AI RAG backend (GCP_PROJECT_ID + USER_UPLOAD_RAG_CORPUS)")
        return get_file_search_manager(backend="vertex", **kwargs)
    
    elif has_gemini_key:
        logger.info("Auto-detected Gemini File Search backend (GEMINI_API_KEY)")
        return get_file_search_manager(backend="gemini", **kwargs)
    
    else:
        logger.warning(
            "Could not auto-detect backend. Please set GEMINI_API_KEY or "
            "(GCP_PROJECT_ID + USER_UPLOAD_RAG_CORPUS). Defaulting to Gemini."
        )
        return get_file_search_manager(backend="gemini", **kwargs)

