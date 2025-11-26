"""
File Search Agent using Gemini File Search API

This agent provides semantic search capabilities over user-uploaded documents
using the Gemini File Search API instead of Vertex AI RAG.
"""

from .agent import file_search_agent

__all__ = ["file_search_agent"]

