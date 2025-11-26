"""
Vertex AI RAG Backend Implementation

Uses Google Cloud's Vertex AI RAG Engine for document search and retrieval.
This backend works with RAG corpora and supports both corpus-wide and file-specific queries.
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any

from google.cloud.storage import Client as StorageClient
from vertexai.preview import rag
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


class VertexAIRAGBackend(FileSearchManager):
    """
    Vertex AI RAG backend implementation.
    
    This backend uses Vertex AI's RAG Engine which provides:
    - RAG corpus management
    - File imports from GCS
    - Vector similarity search
    - Integration with Vertex AI models
    
    Note: Unlike Gemini File Search, Vertex AI RAG requires:
    - A GCP project with Vertex AI enabled
    - Pre-created RAG corpus
    - Files to be in GCS before import
    
    Example:
        backend = VertexAIRAGBackend(
            project_id="my-project",
            location="us-central1",
            corpus_name="projects/123/locations/us-central1/ragCorpora/456"
        )
        # Import files from GCS
        result = backend.import_gcs_file(corpus_name, "gs://bucket/file.pdf")
        # Query
        result = backend.query("What is in the document?", [corpus_name])
    """
    
    def __init__(
        self,
        project_id: Optional[str] = None,
        location: str = "us-central1",
        corpus_name: Optional[str] = None,
        gcs_bucket: Optional[str] = None,
        default_model: str = "gemini-2.5-flash",
        use_genai: bool = True
    ):
        """
        Initialize the Vertex AI RAG backend.
        
        Args:
            project_id: GCP project ID. Defaults to GCP_PROJECT_ID env var.
            location: GCP location for Vertex AI. Defaults to us-central1.
            corpus_name: Default RAG corpus name to use. Can be overridden per operation.
            gcs_bucket: GCS bucket for file operations. Defaults to GOOGLE_CLOUD_BUCKET env var.
            default_model: Default model for queries (gemini-2.5-flash, etc.)
            use_genai: If True, use google-genai SDK for queries. If False, use native Vertex AI.
            
        Raises:
            ValueError: If required configuration is missing
        """
        self.project_id = project_id or os.environ.get("GCP_PROJECT_ID")
        if not self.project_id:
            raise ValueError("project_id or GCP_PROJECT_ID must be set")
        
        self.location = location
        self.corpus_name = corpus_name or os.environ.get("USER_UPLOAD_RAG_CORPUS")
        self.gcs_bucket = gcs_bucket or os.environ.get("GOOGLE_CLOUD_BUCKET")
        self.default_model = default_model
        self.use_genai = use_genai
        
        # Initialize clients
        self.gcs_client = StorageClient(project=self.project_id)
        
        if self.use_genai:
            self.genai_client = genai.Client(
                vertexai=True,
                project=self.project_id,
                location=self.location
            )
        else:
            self.genai_client = None
        
        logger.info(f"VertexAIRAGBackend initialized for project {self.project_id}")
    
    @property
    def backend_type(self) -> FileSearchBackend:
        """Return the backend type."""
        return FileSearchBackend.VERTEX
    
    # Store Management
    # Note: In Vertex AI RAG, "stores" are called "corpora"
    
    def create_store(self, display_name: str) -> FileSearchStore:
        """
        Create a new RAG corpus.
        
        Note: This creates a RAG corpus in Vertex AI, which is the equivalent of
        a File Search store in Gemini.
        
        Args:
            display_name: Human-readable name for the corpus
            
        Returns:
            FileSearchStore object
        """
        try:
            # Create RAG corpus using Vertex AI
            corpus = rag.create_corpus(
                display_name=display_name,
                backend_config=None  # Use default backend
            )
            
            logger.info(f"Created RAG corpus: {corpus.name} ({display_name})")
            
            return FileSearchStore(
                name=corpus.name,
                display_name=display_name,
                backend=FileSearchBackend.VERTEX,
                metadata={
                    "project_id": self.project_id,
                    "location": self.location,
                }
            )
            
        except Exception as e:
            logger.error(f"Error creating RAG corpus: {e}", exc_info=True)
            raise
    
    def list_stores(self) -> List[FileSearchStore]:
        """
        List all RAG corpora.
        
        Returns:
            List of FileSearchStore objects
        """
        try:
            corpora = rag.list_corpora()
            
            result = []
            for corpus in corpora:
                result.append(FileSearchStore(
                    name=corpus.name,
                    display_name=getattr(corpus, 'display_name', ''),
                    backend=FileSearchBackend.VERTEX,
                    metadata={
                        "project_id": self.project_id,
                        "location": self.location,
                    }
                ))
            
            logger.info(f"Listed {len(result)} RAG corpora")
            return result
            
        except Exception as e:
            logger.error(f"Error listing RAG corpora: {e}", exc_info=True)
            raise
    
    def get_store(self, store_name: str) -> Optional[FileSearchStore]:
        """
        Get a specific corpus by name.
        
        Args:
            store_name: Corpus name/ID
            
        Returns:
            FileSearchStore object or None if not found
        """
        try:
            corpus = rag.get_corpus(name=store_name)
            
            return FileSearchStore(
                name=corpus.name,
                display_name=getattr(corpus, 'display_name', ''),
                backend=FileSearchBackend.VERTEX,
                metadata={
                    "project_id": self.project_id,
                    "location": self.location,
                }
            )
        except Exception as e:
            logger.error(f"Error getting corpus: {e}", exc_info=True)
            return None
    
    def delete_store(self, store_name: str) -> bool:
        """
        Delete a RAG corpus.
        
        Args:
            store_name: Corpus name/ID
            
        Returns:
            True if successful
        """
        try:
            rag.delete_corpus(name=store_name)
            logger.info(f"Deleted RAG corpus: {store_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting RAG corpus: {e}", exc_info=True)
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
        Upload a file to a RAG corpus.
        
        Note: Vertex AI RAG requires files to be in GCS first. If file_path is a local
        file, this will raise an error. Use import_gcs_file instead.
        
        Args:
            store_name: Target corpus name
            file_path: Must be a GCS URI (gs://...)
            display_name: Optional display name for the file
            user_id: Optional user ID to associate with the file
            mime_type: Optional MIME type
            wait_for_completion: Whether to wait for import to complete
            timeout: Maximum wait time in seconds (not used for Vertex AI)
            
        Returns:
            UploadResult object
        """
        if not file_path.startswith("gs://"):
            raise ValueError(
                "Vertex AI RAG backend requires GCS URIs. "
                "Use import_gcs_file() or upload your file to GCS first."
            )
        
        return self.import_gcs_file(
            store_name=store_name,
            gcs_uri=file_path,
            display_name=display_name,
            user_id=user_id,
            mime_type=mime_type,
            wait_for_completion=wait_for_completion,
            timeout=timeout
        )
    
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
        Import a file from Google Cloud Storage to a RAG corpus.
        
        Args:
            store_name: Target corpus name
            gcs_uri: GCS URI (gs://bucket/path)
            display_name: Optional display name
            user_id: Optional user ID to associate with the file
            mime_type: Optional MIME type
            wait_for_completion: Whether to wait for completion (always waits for Vertex AI)
            timeout: Maximum wait time in seconds (not used for Vertex AI)
            
        Returns:
            UploadResult object
        """
        try:
            if not display_name:
                display_name = gcs_uri.split('/')[-1]
            
            # Add user_id to display name for tracking
            if user_id:
                display_name = f"[user:{user_id}] {display_name}"
            
            logger.info(f"Importing GCS file to corpus: {gcs_uri} -> {store_name} (user: {user_id})")
            
            # Import file to RAG corpus
            response = rag.import_files(
                corpus_name=store_name,
                paths=[gcs_uri],
                chunk_size=512,  # Default chunk size
                chunk_overlap=100,  # Default overlap
            )
            
            # Extract file ID from response
            file_id = None
            if hasattr(response, 'imported_rag_files_count') and response.imported_rag_files_count > 0:
                # File was imported successfully
                logger.info(f"Successfully imported {display_name} to corpus")
                
                # Store import metadata in GCS for tracking
                if user_id and self.gcs_bucket:
                    self._store_import_metadata(user_id, gcs_uri, display_name, store_name)
            
            return UploadResult(
                status="completed",
                operation_name=f"vertex-rag-import-{gcs_uri}",
                display_name=display_name,
                store_name=store_name,
                file_id=file_id,
                metadata={
                    "gcs_uri": gcs_uri,
                    "user_id": user_id,
                }
            )
                
        except Exception as e:
            logger.error(f"Error importing GCS file to RAG corpus: {e}", exc_info=True)
            raise
    
    def _store_import_metadata(
        self,
        user_id: str,
        gcs_uri: str,
        display_name: str,
        corpus_name: str
    ):
        """
        Store import metadata in GCS for user file tracking.
        
        This creates a JSON file in GCS that tracks which files have been imported
        for a user, allowing the agents to query specific user files.
        """
        try:
            if not self.gcs_bucket:
                logger.warning("GCS bucket not configured, skipping metadata storage")
                return
            
            folder_prefix = f"{os.environ.get('USER_UPLOAD_FOLDER', 'uploads')}/{user_id}/import-results"
            metadata_file = f"{folder_prefix}/import_{os.path.basename(gcs_uri)}.json"
            
            metadata = {
                "Filename": gcs_uri,
                "FileId": gcs_uri,  # Use GCS URI as file ID for Vertex AI
                "DisplayName": display_name,
                "CorpusName": corpus_name,
                "UserId": user_id,
            }
            
            bucket = self.gcs_client.bucket(self.gcs_bucket)
            blob = bucket.blob(metadata_file)
            blob.upload_from_string(json.dumps(metadata), content_type="application/json")
            
            logger.info(f"Stored import metadata: {metadata_file}")
            
        except Exception as e:
            logger.warning(f"Failed to store import metadata: {e}")
    
    # Query
    
    def query(
        self,
        query: str,
        store_names: List[str],
        model: Optional[str] = None,
        include_grounding_metadata: bool = True,
        file_ids: Optional[List[str]] = None,
        similarity_top_k: int = 10,
        vector_distance_threshold: float = 0.6,
        **kwargs
    ) -> FileSearchResult:
        """
        Query RAG corpora with semantic search.
        
        Args:
            query: User's question or search query
            store_names: List of corpus names to query (typically just one for Vertex AI)
            model: Model to use for generation (default: gemini-2.5-flash)
            include_grounding_metadata: Whether to include citations
            file_ids: Optional list of specific file IDs to query within the corpus
            similarity_top_k: Number of top results to retrieve
            vector_distance_threshold: Minimum similarity threshold
            **kwargs: Additional parameters
            
        Returns:
            FileSearchResult object
        """
        try:
            model = model or self.default_model
            
            logger.info(f"Querying RAG corpus with: {query}")
            logger.info(f"Using corpus: {store_names}")
            
            # Vertex AI RAG typically uses a single corpus
            corpus_name = store_names[0] if store_names else self.corpus_name
            if not corpus_name:
                raise ValueError("No corpus specified and no default corpus configured")
            
            if self.use_genai:
                # Use google-genai SDK for querying (similar to Gemini File Search)
                return self._query_with_genai(
                    query=query,
                    corpus_name=corpus_name,
                    model=model,
                    file_ids=file_ids,
                    include_grounding_metadata=include_grounding_metadata
                )
            else:
                # Use native Vertex AI RAG retrieval
                return self._query_with_vertex_rag(
                    query=query,
                    corpus_name=corpus_name,
                    file_ids=file_ids,
                    similarity_top_k=similarity_top_k,
                    vector_distance_threshold=vector_distance_threshold
                )
            
        except Exception as e:
            logger.error(f"Error querying RAG corpus: {e}", exc_info=True)
            raise
    
    def _query_with_genai(
        self,
        query: str,
        corpus_name: str,
        model: str,
        file_ids: Optional[List[str]],
        include_grounding_metadata: bool
    ) -> FileSearchResult:
        """Query using google-genai SDK (provides grounding and citations)."""
        try:
            # Build RAG retrieval tool config
            rag_retrieval = types.Tool(
                google_search_retrieval=types.GoogleSearchRetrieval(
                    dynamic_retrieval_config=types.DynamicRetrievalConfig(
                        mode=types.DynamicRetrievalConfig.Mode.MODE_DYNAMIC,
                        dynamic_threshold=0.7
                    )
                )
            )
            
            config = types.GenerateContentConfig(
                tools=[rag_retrieval]
            )
            
            response = self.genai_client.models.generate_content(
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
                        grounding_chunks = self._extract_grounding_chunks_from_genai(
                            candidate.grounding_metadata
                        )
                        break
            
            return FileSearchResult(
                text=response.text,
                model=model,
                stores_queried=[corpus_name],
                grounding_chunks=grounding_chunks,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"Error in genai query: {e}", exc_info=True)
            raise
    
    def _query_with_vertex_rag(
        self,
        query: str,
        corpus_name: str,
        file_ids: Optional[List[str]],
        similarity_top_k: int,
        vector_distance_threshold: float
    ) -> FileSearchResult:
        """Query using native Vertex AI RAG (retrieval only, no generation)."""
        try:
            # Build RAG resources
            rag_resources = []
            if file_ids:
                rag_resources.append(
                    rag.RagResource(
                        rag_corpus=corpus_name,
                        rag_file_ids=file_ids
                    )
                )
            else:
                rag_resources.append(
                    rag.RagResource(rag_corpus=corpus_name)
                )
            
            # Perform retrieval
            response = rag.retrieval_query(
                text=query,
                rag_resources=rag_resources,
                similarity_top_k=similarity_top_k,
                vector_distance_threshold=vector_distance_threshold,
            )
            
            # Extract chunks
            grounding_chunks = []
            text_parts = []
            
            if response.contexts and response.contexts.contexts:
                for context in response.contexts.contexts:
                    text_parts.append(context.text)
                    grounding_chunks.append(GroundingChunk(
                        type="rag_retrieval",
                        chunk_text=context.text,
                        document_name=getattr(context, 'source_uri', None),
                        confidence_score=getattr(context, 'distance', None),
                    ))
            
            # Combine retrieved text
            result_text = "\n\n".join(text_parts) if text_parts else "No matching result found."
            
            return FileSearchResult(
                text=result_text,
                model="vertex-rag-retrieval",
                stores_queried=[corpus_name],
                grounding_chunks=grounding_chunks,
                metadata={
                    "similarity_top_k": similarity_top_k,
                    "vector_distance_threshold": vector_distance_threshold,
                }
            )
            
        except Exception as e:
            logger.error(f"Error in Vertex RAG query: {e}", exc_info=True)
            raise
    
    def _extract_grounding_chunks_from_genai(self, grounding_metadata) -> List[GroundingChunk]:
        """Extract grounding chunks from genai response."""
        chunks = []
        
        if hasattr(grounding_metadata, 'grounding_chunks'):
            for chunk in grounding_metadata.grounding_chunks:
                chunk_data = {
                    'type': 'vertex_rag'
                }
                
                if hasattr(chunk, 'web'):
                    chunk_data['type'] = 'web'
                    chunk_data['uri'] = chunk.web.uri if hasattr(chunk.web, 'uri') else None
                    chunk_data['document_name'] = chunk.web.title if hasattr(chunk.web, 'title') else None
                elif hasattr(chunk, 'retrieved_context'):
                    result = chunk.retrieved_context
                    chunk_data['document_name'] = result.uri if hasattr(result, 'uri') else None
                    chunk_data['chunk_text'] = result.text if hasattr(result, 'text') else None
                
                chunks.append(GroundingChunk(**chunk_data))
        
        return chunks
    
    # User-specific Operations
    
    def get_user_store_name(self, user_id: str) -> Optional[str]:
        """
        Get the corpus name for a specific user.
        
        Note: For Vertex AI RAG, typically all users share the same corpus,
        and files are filtered by user_id at query time.
        
        Args:
            user_id: User ID
            
        Returns:
            Corpus name (returns default corpus)
        """
        # For Vertex AI, we typically use a single corpus for all users
        # and filter by file IDs at query time
        return self.corpus_name
    
    def get_or_create_user_store(self, user_id: str) -> str:
        """
        Get or create a corpus for a specific user.
        
        Note: For Vertex AI RAG, this returns the default corpus.
        User-specific filtering is done via file IDs.
        
        Args:
            user_id: User ID
            
        Returns:
            Corpus name
        """
        if self.corpus_name:
            return self.corpus_name
        
        # If no default corpus, create one for the user
        logger.info(f"Creating new corpus for user {user_id}")
        store = self.create_store(f"Documents for user_{user_id}")
        self.corpus_name = store.name
        return store.name
    
    def get_user_file_ids(
        self,
        user_id: str,
        context_doc_uris: Optional[List[str]] = None
    ) -> List[str]:
        """
        Get file IDs for a specific user from GCS import metadata.
        
        Args:
            user_id: User ID
            context_doc_uris: Optional list of specific document URIs to filter by
            
        Returns:
            List of file IDs (GCS URIs)
        """
        try:
            if not self.gcs_bucket:
                logger.warning("GCS bucket not configured")
                return []
            
            folder_prefix = f"{os.environ.get('USER_UPLOAD_FOLDER', 'uploads')}/{user_id}/import-results"
            bucket = self.gcs_client.bucket(self.gcs_bucket)
            blobs = bucket.list_blobs(prefix=folder_prefix)
            
            file_ids = []
            for blob in blobs:
                if blob.name.endswith('.json') or blob.name.endswith('.ndjson'):
                    content = blob.download_as_text()
                    for line in content.splitlines():
                        try:
                            obj = json.loads(line)
                            if context_doc_uris:
                                if "Filename" in obj and obj["Filename"] in context_doc_uris:
                                    file_ids.append(str(obj["FileId"]))
                            else:
                                if "FileId" in obj:
                                    file_ids.append(str(obj["FileId"]))
                        except Exception as e:
                            logger.warning(f"Failed to parse line in {blob.name}: {e}")
            
            logger.info(f"Found {len(file_ids)} file IDs for user {user_id}")
            return file_ids
            
        except Exception as e:
            logger.error(f"Error getting user file IDs: {e}")
            return []

