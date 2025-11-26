# File Search Architecture

This document describes the architecture of the Gemini File Search integration across all HomeApp components.

## Overview

The File Search infrastructure provides a unified way to interact with Google Gemini's File Search API across the entire HomeApp ecosystem. It enables semantic search over documents with grounded LLM responses.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Client Applications                                │
├───────────────────────┬───────────────────────┬─────────────────────────────┤
│      Web App          │     Mobile App        │         Agent               │
│  apps/webapp/         │    apps/mapp/         │ gcp/agents/homecare/        │
│  (Next.js + React)    │ (React Native/Expo)   │     (Python)                │
│                       │                       │                             │
│  Uses: TypeScript     │  Uses: TypeScript     │  Uses: Python               │
│  Client + Hooks       │  Client + Hooks       │  Library directly           │
└───────────┬───────────┴───────────┬───────────┴──────────┬──────────────────┘
            │                       │                      │
            └───────────────────────┼──────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │         Proxy API             │
                    │    gcp/proxy/api/             │
                    │                               │
                    │  • FastAPI REST endpoints     │
                    │  • Authentication             │
                    │  • Rate limiting              │
                    │  • Request validation         │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │   File Search Library         │
                    │   gcp/libs/file_search/       │
                    │                               │
                    │  • FileSearchClient           │
                    │  • AsyncFileSearchClient      │
                    │  • Models (Pydantic)          │
                    │  • Exception handling         │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │   Google Gemini File Search   │
                    │           API                 │
                    │                               │
                    │  • FileSearchStore management │
                    │  • Document processing        │
                    │  • Semantic search            │
                    │  • Grounded generation        │
                    └───────────────────────────────┘
```

## Component Details

### 1. Python Library (`gcp/libs/file_search/`)

The core Python library provides direct access to Gemini File Search API.

**Files:**
```
gcp/libs/file_search/
├── __init__.py          # Package exports
├── client.py            # FileSearchClient & AsyncFileSearchClient
├── models.py            # Pydantic models
├── exceptions.py        # Custom exceptions
├── openapi.yaml         # OpenAPI 3.1 specification
├── README.md            # Documentation
├── pyproject.toml       # Package configuration
├── requirements.txt     # Dependencies
└── tests/
    ├── __init__.py
    ├── conftest.py      # Pytest fixtures
    ├── test_client.py   # Client tests
    ├── test_exceptions.py
    └── test_models.py
```

**Key Classes:**

| Class | Description |
|-------|-------------|
| `FileSearchClient` | Synchronous client for API operations |
| `AsyncFileSearchClient` | Async client for concurrent operations |
| `FileSearchStore` | Model representing a document store |
| `FileSearchDocument` | Model representing an uploaded document |
| `QueryResult` | Model for grounded generation results |
| `GroundingMetadata` | Model for citation information |

**Authentication Options:**

```python
# Option 1: API Key (Google AI Studio)
client = FileSearchClient(api_key="YOUR_API_KEY")

# Option 2: Vertex AI (Enterprise)
client = FileSearchClient(
    use_vertex_ai=True,
    project="your-gcp-project",
    location="us-central1"
)
```

### 2. Proxy API (`gcp/proxy/api/`)

REST API exposing File Search functionality to web and mobile clients.

**Files:**
```
gcp/proxy/api/
├── main.py              # FastAPI app entry point
├── file_search_api.py   # File Search endpoints
├── models.py            # Request/response models
├── FILE_SEARCH_API.md   # API documentation
└── test_file_search_api.py  # Integration tests
```

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/file-search/stores` | Create store |
| GET | `/file-search/stores` | List stores |
| GET | `/file-search/stores/{id}` | Get store |
| DELETE | `/file-search/stores/{id}` | Delete store |
| POST | `/file-search/stores/{id}/documents` | Upload from URI |
| POST | `/file-search/stores/{id}/documents/upload` | Upload file |
| POST | `/file-search/stores/{id}/documents/bulk` | Bulk upload |
| GET | `/file-search/stores/{id}/documents` | List documents |
| DELETE | `/file-search/stores/{id}/documents/{docId}` | Delete document |
| POST | `/file-search/query` | Generate with grounding |
| POST | `/file-search/query/stream` | Streaming generation |
| POST | `/file-search/users/{userId}/stores` | User-scoped store |
| GET | `/file-search/users/{userId}/stores` | List user stores |
| POST | `/file-search/users/{userId}/query` | User-scoped query |
| GET | `/file-search/health` | Health check |

### 3. TypeScript Client (`apps/common/src/file-search/`)

Client library for web and mobile React applications.

**Files:**
```
apps/common/src/file-search/
├── index.ts             # Package exports
├── client.ts            # FileSearchClient class
├── types.ts             # TypeScript types
├── hooks.ts             # React hooks
└── __tests__/
    ├── client.test.ts   # Client tests
    ├── hooks.test.ts    # Hooks tests
    └── types.test.ts    # Type tests
```

**React Hooks:**

| Hook | Description |
|------|-------------|
| `useFileSearchClient` | Get memoized client instance |
| `useFileSearchStores` | Manage stores (CRUD) |
| `useFileSearchDocuments` | Manage documents in a store |
| `useFileSearchQuery` | Execute grounded queries |
| `useFileSearchStreamQuery` | Streaming query with real-time updates |
| `useFileSearch` | Combined hook for all functionality |

**Usage Example:**

```typescript
import { useFileSearch } from '@homeapp/common/file-search';

function DocumentSearch() {
  const { stores, documents, query, selectStore } = useFileSearch({
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
    authToken: session.accessToken,
    userId: user.uid,
  });

  // Create a store
  const handleCreate = async () => {
    await stores.createStore({ display_name: 'My Documents' });
  };

  // Query with grounding
  const handleQuery = async (text: string) => {
    const result = await query.query({
      query: text,
      store_names: [selectedStore.name],
    });
    console.log(result.text, result.grounding_metadata?.citations);
  };
}
```

### 4. Agent Integration

The Python library can be used directly in agents for document-grounded responses.

```python
# In gcp/agents/homecare/property_agent/sub_agents/
from file_search import FileSearchClient

class UserDocsAgent:
    def __init__(self):
        self.client = FileSearchClient(
            use_vertex_ai=True,
            project=os.environ["GCP_PROJECT_ID"],
            location=os.environ["GCP_LOCATION"]
        )
    
    def query_user_documents(self, query: str, store_names: list) -> str:
        result = self.client.generate_with_file_search(
            query=query,
            store_names=store_names,
            include_citations=True
        )
        return result.text
```

## Data Flow

### Document Upload Flow

```
┌─────────┐     ┌───────────┐     ┌──────────────┐     ┌─────────────┐
│ Client  │────▶│ Proxy API │────▶│ File Search  │────▶│   Gemini    │
│  App    │     │           │     │   Library    │     │    API      │
└─────────┘     └───────────┘     └──────────────┘     └─────────────┘
     │                                                        │
     │  1. Upload request                                     │
     │     (file/URI, store_id)                              │
     │                                                        │
     │                                                        │
     │◀─────────────────────────────────────────────────────│
        4. Document metadata                                  
           (name, state, chunk_count)                        
```

1. Client sends upload request with file or URI
2. Proxy API validates request and calls library
3. Library uploads to Gemini File Search API
4. Gemini processes document (chunking, embedding)
5. Library returns document metadata
6. Proxy API returns response to client

### Query Flow

```
┌─────────┐     ┌───────────┐     ┌──────────────┐     ┌─────────────┐
│ Client  │────▶│ Proxy API │────▶│ File Search  │────▶│   Gemini    │
│  App    │     │           │     │   Library    │     │    API      │
└─────────┘     └───────────┘     └──────────────┘     └─────────────┘
     │                                                        │
     │  1. Query request                                      │
     │     (query, store_names)                              │
     │                                                        │
     │                                                        │
     │◀─────────────────────────────────────────────────────│
        4. Grounded response                                  
           (text, citations, usage)                          
```

1. Client sends query with target store names
2. Proxy API validates and calls library
3. Library calls Gemini with FileSearch tool enabled
4. Gemini:
   - Searches stores for relevant chunks
   - Ranks by relevance score
   - Generates response with context injection
   - Returns citations to source documents
5. Library parses response and grounding metadata
6. Client receives grounded answer with citations

## Configuration

### Environment Variables

```bash
# For Vertex AI (recommended for production)
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
USE_VERTEX_AI=true

# For Google AI Studio (development)
GOOGLE_API_KEY=your-api-key
USE_VERTEX_AI=false

# Proxy API
FIREBASE_WEBHOOK_SECRET=your-webhook-secret
```

### Supported Models

| Model | Recommended Use | Notes |
|-------|-----------------|-------|
| `gemini-2.5-flash` | Default, fast responses | Best cost/performance |
| `gemini-2.5-pro` | Complex queries | Higher quality |
| `gemini-2.0-flash` | Legacy support | Previous generation |

### Supported File Types

| Category | Extensions |
|----------|------------|
| Documents | .pdf, .docx, .doc, .txt, .html, .csv, .tsv, .md, .rtf |
| Spreadsheets | .xls, .xlsx |
| Presentations | .ppt, .pptx |
| Code | .py, .js, .ts, .json, .xml, .yaml |
| Images | .png, .jpg, .jpeg, .webp, .gif |

## Error Handling

### Exception Hierarchy

```
FileSearchError (base)
├── StoreNotFoundError (404)
├── DocumentNotFoundError (404)
├── UploadError (400)
├── QueryError (500)
├── AuthenticationError (401)
├── RateLimitError (429)
├── ValidationError (422)
├── OperationTimeoutError (408)
├── QuotaExceededError (429)
└── UnsupportedMimeTypeError (415)
```

### Error Response Format

```json
{
  "error": "StoreNotFoundError",
  "message": "FileSearchStore not found: fileSearchStores/abc123",
  "status_code": 404,
  "details": {
    "store_name": "fileSearchStores/abc123"
  }
}
```

## Security Considerations

1. **Authentication**: All Proxy API endpoints require Bearer token authentication
2. **User Isolation**: Stores can be prefixed with user ID for per-user isolation
3. **Rate Limiting**: API implements rate limits per operation type
4. **Input Validation**: All requests validated with Pydantic/TypeScript types
5. **Secrets Management**: API keys and secrets stored in environment/Secret Manager

## Testing Strategy

### Unit Tests

```bash
# Python library
cd gcp/libs/file_search && pytest tests/ -v

# TypeScript client
cd apps/common && npm test -- --testPathPattern=file-search
```

### Integration Tests

```bash
# Proxy API integration tests
cd gcp/proxy/api && pytest test_file_search_api.py -v
```

### End-to-End Tests

See `gcp/proxy/api/e2e_file_search_test.py` for full workflow testing.

## Performance Considerations

1. **Document Size**: Large documents (>50MB) may have longer processing times
2. **Chunk Count**: More chunks = better retrieval but higher latency
3. **Store Size**: Stores with many documents may have slower list operations
4. **Streaming**: Use streaming endpoints for better UX on long responses
5. **Caching**: Consider caching store/document lists on client side

## Related Documentation

- [OpenAPI Specification](./openapi.yaml)
- [Proxy API Documentation](../../proxy/api/FILE_SEARCH_API.md)
- [Library README](./README.md)
- [Google Gemini File Search Docs](https://ai.google.dev/gemini-api/docs/file-search)

## Changelog

### v1.0.0 (2025-01)
- Initial release
- FileSearchStore CRUD operations
- Document upload (file, URI, bulk)
- Grounded generation with citations
- Streaming support
- React hooks for web/mobile
- Comprehensive test coverage

