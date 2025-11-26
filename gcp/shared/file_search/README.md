# File Search Abstraction Layer

A unified interface for document search and RAG (Retrieval Augmented Generation) across different backends.

## Overview

This library provides a common abstraction for file search and RAG operations that works with multiple backends:

- **Gemini File Search**: Google's Gemini API native file search feature
- **Vertex AI RAG**: Google Cloud's Vertex AI RAG Engine

The abstraction allows you to:
- Write backend-agnostic code
- Switch between backends with minimal changes
- Share common functionality across proxy and agents
- Maintain consistent interfaces

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│              (Proxy API, Agents, Workers)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              File Search Abstraction Layer                  │
│                   (FileSearchManager)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  GeminiFileSearchBackend │  │  VertexAIRAGBackend      │
│  (google-genai SDK)      │  │  (vertexai.preview.rag)  │
└──────────────────────────┘  └──────────────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   Gemini File Search     │  │    Vertex AI RAG         │
│   (API-based)            │  │    (GCP-based)           │
└──────────────────────────┘  └──────────────────────────┘
```

## Quick Start

### Installation

The shared library is part of the monorepo. Add the parent directory to your Python path:

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from shared.file_search import get_file_search_manager
```

Or install dependencies:

```bash
# For Gemini File Search
pip install google-genai

# For Vertex AI RAG
pip install google-cloud-aiplatform google-cloud-storage
```

### Basic Usage

#### Using Gemini File Search

```python
from gcp.shared.file_search import get_file_search_manager

# Create manager
manager = get_file_search_manager(
    backend='gemini',
    api_key='your-gemini-api-key'
)

# Create a store
store = manager.create_store('My Documents')

# Upload a file
result = manager.upload_file(
    store_name=store.name,
    file_path='document.pdf'
)

# Query
result = manager.query(
    query='What is in this document?',
    store_names=[store.name]
)
print(result.text)
print(result.grounding_chunks)  # Citations
```

#### Using Vertex AI RAG

```python
from gcp.shared.file_search import get_file_search_manager

# Create manager
manager = get_file_search_manager(
    backend='vertex',
    project_id='my-gcp-project',
    location='us-central1',
    corpus_name='projects/.../ragCorpora/...',
    gcs_bucket='my-bucket'
)

# Import file from GCS
result = manager.import_gcs_file(
    store_name='projects/.../ragCorpora/...',
    gcs_uri='gs://my-bucket/document.pdf'
)

# Query
result = manager.query(
    query='What is in this document?',
    store_names=['projects/.../ragCorpora/...']
)
print(result.text)
```

#### Auto-Detection

```python
from gcp.shared.file_search import auto_detect_backend

# Automatically selects backend based on environment variables
manager = auto_detect_backend()

# Use manager same as above
store = manager.create_store('My Documents')
```

## Core Concepts

### FileSearchManager

The abstract base class that defines the interface. All backends implement this.

**Key Methods:**

- `create_store(display_name)` - Create a new document store
- `list_stores()` - List all stores
- `delete_store(store_name)` - Delete a store
- `upload_file(store_name, file_path, ...)` - Upload a file
- `import_gcs_file(store_name, gcs_uri, ...)` - Import from GCS
- `query(query, store_names, ...)` - Query documents
- `get_user_store_name(user_id)` - Get store for a user
- `get_or_create_user_store(user_id)` - Get or create user store

### Data Models

#### FileSearchStore

Represents a document store/corpus:

```python
@dataclass
class FileSearchStore:
    name: str                    # Unique identifier
    display_name: str           # Human-readable name
    backend: FileSearchBackend  # GEMINI or VERTEX
    metadata: Dict[str, Any]    # Backend-specific metadata
```

#### FileSearchResult

Query result with answer and citations:

```python
@dataclass
class FileSearchResult:
    text: str                       # Generated answer
    model: str                      # Model used
    stores_queried: List[str]       # Stores searched
    grounding_chunks: List[GroundingChunk]  # Citations
    metadata: Dict[str, Any]        # Additional metadata
```

#### GroundingChunk

Citation/source information:

```python
@dataclass
class GroundingChunk:
    type: str                    # file_search, web, rag_retrieval
    document_name: Optional[str] # Source document
    chunk_text: Optional[str]    # Actual text content
    page_number: Optional[int]   # Page number if available
    uri: Optional[str]           # Source URI
    confidence_score: Optional[float]  # Confidence score
    metadata: Dict[str, Any]     # Additional metadata
```

#### UploadResult

File upload operation result:

```python
@dataclass
class UploadResult:
    status: str           # completed, in_progress, timeout, failed
    operation_name: str   # Operation identifier
    display_name: str     # File display name
    store_name: str       # Target store
    file_id: Optional[str]       # Backend-specific file ID
    metadata: Dict[str, Any]     # Additional metadata
```

## Backend Comparison

| Feature | Gemini File Search | Vertex AI RAG |
|---------|-------------------|---------------|
| **Setup** | API key only | GCP project + corpus setup |
| **File Upload** | Direct or GCS | GCS only |
| **Storage** | Managed by Google | GCS-based |
| **Query Response** | AI-generated answer + citations | Retrieval chunks or AI answer |
| **File Types** | 100+ types | Common document types |
| **Pricing** | Per-token + indexing | Per-token + infrastructure |
| **User Isolation** | Per-user stores | Shared corpus + file filtering |
| **Best For** | Quick setup, API-based apps | Enterprise, fine-grained control |

## Configuration

### Environment Variables

#### Gemini File Search

```bash
export GEMINI_API_KEY=your-api-key
```

#### Vertex AI RAG

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_LOCATION=us-central1
export USER_UPLOAD_RAG_CORPUS=projects/.../ragCorpora/...
export GOOGLE_CLOUD_BUCKET=your-bucket
export USER_UPLOAD_FOLDER=uploads  # Optional, default: uploads
```

### Factory Configuration

```python
# Explicit backend selection
manager = get_file_search_manager(
    backend='gemini',
    api_key='...'
)

manager = get_file_search_manager(
    backend='vertex',
    project_id='...',
    location='us-central1',
    corpus_name='...'
)

# Auto-detection (based on env vars)
manager = auto_detect_backend()
```

## Advanced Usage

### User-Specific Operations

Both backends support user-specific document management:

```python
# Upload file for a specific user
result = manager.upload_user_file(
    user_id='user123',
    file_path='gs://bucket/user-doc.pdf'
)

# Query user's documents
result = manager.query_user_documents(
    user_id='user123',
    query='What documents do I have?'
)
```

**How it works:**

- **Gemini**: Creates separate stores per user (e.g., `Documents for user_123`)
- **Vertex**: Uses shared corpus with user-specific file filtering via metadata

### Vertex AI: File ID Tracking

For Vertex AI RAG, user files are tracked via JSON metadata in GCS:

```
gs://bucket/uploads/{user_id}/import-results/
  ├── import_doc1.json
  ├── import_doc2.json
  └── ...
```

Each file contains:

```json
{
  "Filename": "gs://bucket/path/to/file.pdf",
  "FileId": "gs://bucket/path/to/file.pdf",
  "DisplayName": "[user:123] document.pdf",
  "CorpusName": "projects/.../ragCorpora/...",
  "UserId": "user123"
}
```

### Custom Models

```python
# Gemini models
result = manager.query(
    query='...',
    store_names=[store.name],
    model='gemini-2.5-pro'  # or gemini-2.5-flash, gemini-2.5-flash-lite
)

# Vertex models
result = manager.query(
    query='...',
    store_names=[corpus_name],
    model='gemini-2.5-flash',
    use_genai=True  # Use genai SDK for better grounding
)
```

### Generation Configuration

For Gemini backend, pass generation config:

```python
result = manager.query(
    query='...',
    store_names=[store.name],
    generation_config={
        'temperature': 0.1,
        'top_p': 0.95,
        'max_output_tokens': 2048
    }
)
```

### Retrieval Parameters

For Vertex backend, control retrieval:

```python
result = manager.query(
    query='...',
    store_names=[corpus_name],
    similarity_top_k=20,           # Number of chunks to retrieve
    vector_distance_threshold=0.5,  # Minimum similarity
    file_ids=['gs://...']           # Optional: specific files only
)
```

## Migration Guide

### From proxy/api/gemini_file_search.py

**Before:**

```python
from gemini_file_search import GeminiFileSearchManager

manager = GeminiFileSearchManager(api_key='...')
store = manager.create_file_search_store('My Docs')
result = manager.query_file_search('...', [store['name']])
```

**After (using v2 wrapper):**

```python
from gemini_file_search_v2 import GeminiFileSearchManager

manager = GeminiFileSearchManager(api_key='...')
store = manager.create_file_search_store('My Docs')
result = manager.query_file_search('...', [store['name']])
```

**After (using shared library directly):**

```python
from gcp.shared.file_search import get_file_search_manager

manager = get_file_search_manager(backend='gemini', api_key='...')
store = manager.create_store('My Docs')
result = manager.query('...', [store.name])
```

### From agents user_docs_agent

**Before:**

```python
from vertexai.preview import rag

response = rag.retrieval_query(
    text=query,
    rag_resources=[...],
    similarity_top_k=10,
    vector_distance_threshold=0.6
)
```

**After:**

```python
from gcp.shared.file_search import get_file_search_manager

manager = get_file_search_manager(backend='vertex', ...)
result = manager.query(
    query=query,
    store_names=[corpus_name],
    file_ids=file_ids,
    similarity_top_k=10,
    vector_distance_threshold=0.6
)
```

Or use the new agent wrapper:

```python
from property_agent.sub_agents.user_docs_agent.agent_v2 import user_docs_agent_v2
```

## Best Practices

### 1. Choose the Right Backend

**Use Gemini File Search when:**
- Building API-first applications
- Need quick setup without GCP infrastructure
- Want automatic document processing and chunking
- Prefer fully managed service

**Use Vertex AI RAG when:**
- Already using GCP/Vertex AI
- Need fine-grained control over corpus and files
- Have existing GCS-based document storage
- Want to integrate with other Vertex AI services

### 2. Error Handling

```python
from gcp.shared.file_search import get_file_search_manager

try:
    manager = get_file_search_manager(backend='gemini')
    result = manager.query('...', [store.name])
    print(result.text)
except ValueError as e:
    print(f"Configuration error: {e}")
except Exception as e:
    print(f"Query failed: {e}")
```

### 3. Async Operations

For large file uploads, use async mode:

```python
# Start upload without waiting
result = manager.upload_file(
    store_name=store.name,
    file_path='large-file.pdf',
    wait_for_completion=False
)

print(f"Upload started: {result.operation_name}")
# Continue with other work...
```

### 4. User Data Isolation

Always use user-specific operations for multi-tenant applications:

```python
# Good: Automatic user isolation
result = manager.upload_user_file(user_id=user_id, file_path=file)
result = manager.query_user_documents(user_id=user_id, query=query)

# Avoid: Manual store management
# store = manager.get_user_store_name(user_id)
# manager.upload_file(store, file)
```

### 5. Citation Handling

Always check for grounding chunks when displaying results:

```python
result = manager.query(query, [store.name], include_grounding_metadata=True)

print(f"Answer: {result.text}\n")

if result.grounding_chunks:
    print("Sources:")
    for chunk in result.grounding_chunks:
        print(f"- {chunk.document_name}")
        if chunk.page_number:
            print(f"  Page {chunk.page_number}")
```

## Examples

### Example 1: Property Document Analysis (Proxy)

```python
from gcp.shared.file_search import get_file_search_manager

# Initialize for Gemini
manager = get_file_search_manager(backend='gemini')

# Get or create user store
user_id = 'user123'
store_name = manager.get_or_create_user_store(user_id)

# Import property document
result = manager.import_gcs_file(
    store_name=store_name,
    gcs_uri='gs://bucket/properties/deed.pdf',
    user_id=user_id,
    display_name='Property Deed'
)

# Query the document
result = manager.query_user_documents(
    user_id=user_id,
    query='What is the property address and purchase price?',
    include_grounding_metadata=True
)

print(result.text)
for chunk in result.grounding_chunks:
    print(f"Source: {chunk.document_name}, Page: {chunk.page_number}")
```

### Example 2: Agent Document Retrieval (Agents)

```python
from gcp.shared.file_search import get_file_search_manager, VertexAIRAGBackend

# Initialize for Vertex AI
manager = get_file_search_manager(
    backend='vertex',
    project_id=os.environ['GCP_PROJECT_ID'],
    corpus_name=os.environ['USER_UPLOAD_RAG_CORPUS'],
    gcs_bucket=os.environ['GOOGLE_CLOUD_BUCKET'],
    use_genai=False  # Use raw retrieval
)

# Get user files
user_id = 'user123'
context_doc_uris = ['gs://bucket/manual.pdf']

if isinstance(manager, VertexAIRAGBackend):
    file_ids = manager.get_user_file_ids(user_id, context_doc_uris)
else:
    file_ids = []

# Query with specific files
corpus_name = manager.get_user_store_name(user_id)
result = manager.query(
    query='What does error code E3 mean?',
    store_names=[corpus_name],
    file_ids=file_ids,
    similarity_top_k=5
)

# Extract relevant chunks
chunks = [chunk.chunk_text for chunk in result.grounding_chunks]
print("\n\n".join(chunks))
```

### Example 3: Multi-Backend Support

```python
from gcp.shared.file_search import get_file_search_manager

def query_documents(query: str, user_id: str, backend: str = 'auto'):
    """Query user documents with automatic backend selection."""
    
    if backend == 'auto':
        # Auto-detect based on environment
        from gcp.shared.file_search import auto_detect_backend
        manager = auto_detect_backend()
    else:
        manager = get_file_search_manager(backend=backend)
    
    # Query is the same regardless of backend
    result = manager.query_user_documents(
        user_id=user_id,
        query=query,
        include_grounding_metadata=True
    )
    
    return {
        'answer': result.text,
        'sources': [
            {
                'document': chunk.document_name,
                'excerpt': chunk.chunk_text[:200] + '...' if chunk.chunk_text else None
            }
            for chunk in result.grounding_chunks
        ],
        'backend': manager.backend_type.value
    }

# Use it
response = query_documents(
    query='What maintenance is due this month?',
    user_id='user123',
    backend='auto'
)
```

## Testing

### Unit Tests

```python
import pytest
from gcp.shared.file_search import get_file_search_manager

def test_gemini_backend():
    manager = get_file_search_manager(backend='gemini', api_key='test-key')
    assert manager.backend_type.value == 'gemini'

def test_vertex_backend():
    manager = get_file_search_manager(
        backend='vertex',
        project_id='test-project',
        corpus_name='test-corpus'
    )
    assert manager.backend_type.value == 'vertex'
```

### Integration Tests

See `tests/` directory for comprehensive integration tests.

## Troubleshooting

### Import Errors

```
ModuleNotFoundError: No module named 'shared'
```

**Solution:** Add parent directory to Python path:

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
```

### Backend Selection Issues

```
ValueError: Invalid backend: xxx
```

**Solution:** Use valid backend names:

```python
manager = get_file_search_manager(backend='gemini')  # or 'vertex'
```

### Vertex AI File Not Found

```
Error querying RAG corpus: File not found
```

**Solution:** Ensure files are properly imported and metadata is stored:

```python
# Import the file
result = manager.import_gcs_file(store_name, gcs_uri, user_id=user_id)

# Wait for import to complete
assert result.status == 'completed'
```

### Missing Environment Variables

```
ValueError: project_id or GCP_PROJECT_ID must be set
```

**Solution:** Set required environment variables or pass explicitly:

```python
manager = get_file_search_manager(
    backend='vertex',
    project_id='my-project',  # Explicit override
    ...
)
```

## API Reference

See individual module documentation:

- [`base.py`](./base.py) - Abstract interfaces and data models
- [`gemini_backend.py`](./gemini_backend.py) - Gemini File Search implementation
- [`vertex_backend.py`](./vertex_backend.py) - Vertex AI RAG implementation
- [`factory.py`](./factory.py) - Factory functions

## Contributing

When adding new features:

1. Update the `FileSearchManager` abstract base class
2. Implement in both backends (Gemini and Vertex)
3. Update this README
4. Add tests
5. Update examples

## License

Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0

