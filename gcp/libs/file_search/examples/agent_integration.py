#!/usr/bin/env python3
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
Agent Integration Example for File Search

This example shows how to integrate the File Search library into an AI agent
for document-grounded responses.

Use cases:
- Query user-uploaded documents
- Search knowledge bases
- Generate citations from source documents
- Combine multiple document stores

Usage:
    python agent_integration.py
"""

import os
import sys
import logging
from typing import List, Optional, Dict, Any

# Add library to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from file_search import (
    FileSearchClient,
    FileSearchStore,
    QueryResult,
    FileSearchError,
    StoreNotFoundError,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DocumentGroundedAgent:
    """
    An AI agent that can answer questions using document-grounded responses.
    
    This agent uses the File Search library to:
    1. Manage document stores for each user
    2. Upload and index documents
    3. Generate grounded responses with citations
    
    Example usage in an agent tool:
    
        @tool
        def ask_user_documents(query: str) -> str:
            '''Answer a question using the user's uploaded documents.'''
            agent = DocumentGroundedAgent(user_id=context.user_id)
            response = agent.query(query)
            return response.formatted_answer
    """
    
    def __init__(
        self,
        user_id: str,
        project: Optional[str] = None,
        location: str = "us-central1",
    ):
        """
        Initialize the document-grounded agent.
        
        Args:
            user_id: User ID for document isolation
            project: GCP project ID (defaults to env var)
            location: GCP region (default: us-central1)
        """
        self.user_id = user_id
        self.project = project or os.environ.get("GCP_PROJECT_ID")
        self.location = location
        
        # Initialize the File Search client with Vertex AI
        self.client = FileSearchClient(
            use_vertex_ai=True,
            project=self.project,
            location=self.location,
        )
        
        # Cache for user store
        self._user_store: Optional[FileSearchStore] = None
        
        logger.info(f"Initialized DocumentGroundedAgent for user {user_id}")
    
    def get_or_create_user_store(self) -> FileSearchStore:
        """
        Get or create a FileSearchStore for this user.
        
        Returns:
            The user's FileSearchStore
        """
        if self._user_store:
            return self._user_store
        
        # Try to find existing store
        store_name = f"{self.user_id}/documents"
        
        try:
            stores = self.client.list_stores()
            for store in stores.stores:
                if store.display_name == store_name:
                    self._user_store = store
                    logger.info(f"Found existing store: {store.name}")
                    return store
        except FileSearchError as e:
            logger.warning(f"Error listing stores: {e}")
        
        # Create new store
        logger.info(f"Creating new store for user {self.user_id}")
        self._user_store = self.client.create_store(
            display_name=store_name,
            description=f"Document store for user {self.user_id}",
        )
        return self._user_store
    
    def add_document(
        self,
        uri: str,
        display_name: str,
        description: Optional[str] = None,
    ) -> bool:
        """
        Add a document to the user's store.
        
        Args:
            uri: Document URI (gs:// or https://)
            display_name: Human-readable name
            description: Optional description
            
        Returns:
            True if successful
        """
        store = self.get_or_create_user_store()
        
        try:
            result = self.client.import_document_from_uri(
                store_name=store.name,
                uri=uri,
                display_name=display_name,
                description=description,
            )
            logger.info(f"Uploaded document: {result.document.name}")
            return result.success
        except FileSearchError as e:
            logger.error(f"Failed to upload document: {e}")
            return False
    
    def query(
        self,
        question: str,
        additional_stores: Optional[List[str]] = None,
        temperature: float = 0.7,
        include_citations: bool = True,
    ) -> "GroundedResponse":
        """
        Query the user's documents with a question.
        
        Args:
            question: The question to answer
            additional_stores: Optional additional store names to search
            temperature: Generation temperature (0-2)
            include_citations: Whether to include citations
            
        Returns:
            GroundedResponse with answer and citations
        """
        store = self.get_or_create_user_store()
        
        # Combine user store with any additional stores
        store_names = [store.name]
        if additional_stores:
            store_names.extend(additional_stores)
        
        logger.info(f"Querying {len(store_names)} stores with: {question[:50]}...")
        
        try:
            result = self.client.generate_with_file_search(
                query=question,
                store_names=store_names,
                temperature=temperature,
                include_citations=include_citations,
                system_instruction=(
                    "You are a helpful assistant that answers questions based on the "
                    "provided documents. Always cite your sources. If the answer cannot "
                    "be found in the documents, say so clearly."
                ),
            )
            
            return GroundedResponse(
                answer=result.text,
                citations=result.grounding_metadata.citations if result.grounding_metadata else [],
                model=result.model,
                latency_ms=result.latency_ms,
            )
            
        except StoreNotFoundError as e:
            logger.error(f"Store not found: {e}")
            return GroundedResponse(
                answer="I couldn't find your document store. Please upload some documents first.",
                citations=[],
                model="",
                error=str(e),
            )
        except FileSearchError as e:
            logger.error(f"Query failed: {e}")
            return GroundedResponse(
                answer="I encountered an error while searching your documents. Please try again.",
                citations=[],
                model="",
                error=str(e),
            )


class GroundedResponse:
    """
    A response grounded in documents with citations.
    """
    
    def __init__(
        self,
        answer: str,
        citations: list,
        model: str,
        latency_ms: Optional[int] = None,
        error: Optional[str] = None,
    ):
        self.answer = answer
        self.citations = citations
        self.model = model
        self.latency_ms = latency_ms
        self.error = error
    
    @property
    def formatted_answer(self) -> str:
        """Get the answer with formatted citations."""
        if not self.citations:
            return self.answer
        
        # Append citations
        citation_text = "\n\n**Sources:**\n"
        for i, citation in enumerate(self.citations, 1):
            doc_name = getattr(citation, 'document_display_name', None) or citation.document_name
            citation_text += f"{i}. {doc_name}\n"
        
        return self.answer + citation_text
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "answer": self.answer,
            "citations": [
                {
                    "document_name": c.document_name,
                    "document_display_name": c.document_display_name,
                    "chunk_text": c.chunk_text,
                    "relevance_score": c.relevance_score,
                    "page_number": c.page_number,
                }
                for c in self.citations
            ],
            "model": self.model,
            "latency_ms": self.latency_ms,
            "error": self.error,
        }


# =============================================================================
# Example Agent Tool Implementations
# =============================================================================

class UserDocsAgentTool:
    """
    Example implementation of a user documents tool for use in agents.
    
    This can be registered as a tool in frameworks like LangChain or
    Vertex AI Agent Builder.
    """
    
    def __init__(self, user_id: str):
        self.agent = DocumentGroundedAgent(user_id=user_id)
    
    def ask(self, query: str) -> str:
        """
        Ask a question about the user's documents.
        
        Args:
            query: The question to ask
            
        Returns:
            Answer with citations formatted as markdown
        """
        response = self.agent.query(query)
        return response.formatted_answer
    
    def upload(self, uri: str, name: str) -> str:
        """
        Upload a document to the user's store.
        
        Args:
            uri: Document URI (gs:// or https://)
            name: Display name for the document
            
        Returns:
            Status message
        """
        if self.agent.add_document(uri, name):
            return f"Successfully uploaded '{name}' to your document store."
        return f"Failed to upload '{name}'. Please try again."


class KnowledgeBaseAgentTool:
    """
    Example implementation of a shared knowledge base tool.
    
    This searches a shared knowledge base store that's available
    to all users.
    """
    
    KNOWLEDGE_BASE_STORE = "fileSearchStores/shared-knowledge-base"
    
    def __init__(self):
        self.client = FileSearchClient(
            use_vertex_ai=True,
            project=os.environ.get("GCP_PROJECT_ID"),
            location=os.environ.get("GCP_LOCATION", "us-central1"),
        )
    
    def search(self, query: str) -> str:
        """
        Search the knowledge base.
        
        Args:
            query: The search query
            
        Returns:
            Answer from the knowledge base
        """
        try:
            result = self.client.generate_with_file_search(
                query=query,
                store_names=[self.KNOWLEDGE_BASE_STORE],
                system_instruction=(
                    "You are a knowledge base assistant. Answer questions based on "
                    "the provided documentation. Be concise and accurate."
                ),
            )
            return result.text
        except FileSearchError as e:
            return f"Knowledge base search failed: {e}"


# =============================================================================
# Demo/Testing
# =============================================================================

def demo():
    """
    Demo showing how to use the document-grounded agent.
    """
    print("=" * 60)
    print("Document-Grounded Agent Demo")
    print("=" * 60)
    
    # Check for required environment variables
    if not os.environ.get("GCP_PROJECT_ID"):
        print("\nError: GCP_PROJECT_ID environment variable not set")
        print("Please set it to your Google Cloud project ID")
        return
    
    # Create agent for a demo user
    user_id = "demo-user-123"
    print(f"\n1. Creating agent for user: {user_id}")
    agent = DocumentGroundedAgent(user_id=user_id)
    
    # Add a document (using a public URL for demo)
    print("\n2. Adding a sample document...")
    # In production, this would be a GCS URI like gs://bucket/document.pdf
    success = agent.add_document(
        uri="https://example.com/sample.pdf",  # Replace with real document
        display_name="Sample Document",
        description="A sample document for testing",
    )
    print(f"   Document upload: {'Success' if success else 'Failed'}")
    
    # Query the documents
    print("\n3. Querying the documents...")
    response = agent.query("What are the main points in the document?")
    
    print("\n4. Response:")
    print("-" * 40)
    print(response.formatted_answer)
    print("-" * 40)
    
    if response.latency_ms:
        print(f"\nLatency: {response.latency_ms}ms")
    if response.model:
        print(f"Model: {response.model}")
    
    print("\n5. Citations:")
    for i, citation in enumerate(response.citations, 1):
        print(f"   {i}. {citation.document_name}")
        if citation.chunk_text:
            print(f"      Text: {citation.chunk_text[:100]}...")
        if citation.relevance_score:
            print(f"      Score: {citation.relevance_score:.2f}")


if __name__ == "__main__":
    demo()

