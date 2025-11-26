"""
File Search Abstraction Layer

This package provides a unified interface for document search and RAG (Retrieval Augmented Generation)
across different backends:
- Gemini File Search (google-genai SDK)
- Vertex AI RAG (vertexai.preview.rag)

Example usage:
    from gcp.shared.file_search import get_file_search_manager
    
    # Use Gemini File Search backend
    manager = get_file_search_manager(backend='gemini', api_key='...')
    
    # Use Vertex AI RAG backend
    manager = get_file_search_manager(backend='vertex', project_id='...', location='...')
    
    # Create a store and upload files
    store = manager.create_store('My Documents')
    manager.upload_file(store['name'], 'path/to/doc.pdf')
    
    # Query documents
    result = manager.query('What is the property address?', [store['name']])
"""

from .base import FileSearchManager, FileSearchStore, FileSearchResult
from .gemini_backend import GeminiFileSearchBackend
from .vertex_backend import VertexAIRAGBackend
from .factory import get_file_search_manager

__all__ = [
    'FileSearchManager',
    'FileSearchStore',
    'FileSearchResult',
    'GeminiFileSearchBackend',
    'VertexAIRAGBackend',
    'get_file_search_manager',
]

