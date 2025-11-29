# Gemini File Search API

This document describes the Gemini File Search API endpoints in the GCP proxy API.

## Overview

The Gemini File Search API provides endpoints for Retrieval Augmented Generation (RAG) using Gemini API File Search. This enables:

- **Creating and managing File Search stores** - Organize documents into searchable stores
- **Uploading files** - Upload documents to stores with automatic chunking and indexing
- **RAG queries** - Generate content with context from uploaded documents
- **Citation support** - Access citations and grounding metadata from responses

## Architecture

```
┌─────────────────┐
│  Client/Frontend│
│  (mapp/webapp)  │
└────────┬────────┘
         │ POST /gemini-file-search/*
         │ { JSON payload }
         ↓
┌─────────────────────────────────┐
│  GCP Proxy API (FastAPI)        │
│  └─ gemini_file_search_api.py   │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  gcp/common/gemini_file_search  │
│  └─ GeminiFileSearchClient      │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  Gemini API File Search         │
│  └─ File Search Stores          │
│  └─ Document Indexing           │
│  └─ RAG Generation              │
└─────────────────────────────────┘
```

## Endpoints

All endpoints are prefixed with `/{FIREBASE_WEBHOOK_SECRET}/gemini-file-search/`

### 1. Create File Search Store

**Endpoint:** `POST /{FIREBASE_WEBHOOK_SECRET}/gemini-file-search/create-store`

**Description:** Create a new File Search store.

**Request Body:**
```json
{
  "display_name": "My Documents"  // Optional
}
```

**Response:**
```json
{
  "status": "success",
  "store": {
    "name": "fileSearchStores/xxxxx",
    "store_id": "xxxxx",
    "display_name": "My Documents"
  }
}
```

**Example:**
```bash
curl -X POST "https://your-api.com/{SECRET}/gemini-file-search/create-store" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Property Documents"}'
```

### 2. List File Search Stores

**Endpoint:** `GET /{FIREBASE_WEBHOOK_SECRET}/gemini-file-search/stores`

**Description:** List all File Search stores.

**Response:**
```json
{
  "status": "success",
  "stores": [
    {
      "name": "fileSearchStores/xxxxx",
      "store_id": "xxxxx",
      "display_name": "My Documents"
    }
  ]
}
```

**Example:**
```bash
curl "https://your-api.com/{SECRET}/gemini-file-search/stores"
```

### 3. Get File Search Store

**Endpoint:** `GET /{FIREBASE_WEBHOOK_SECRET}/gemini-file-search/stores/{store_name}`

**Description:** Get a specific File Search store by name.

**Path Parameters:**
- `store_name`: Full store name (e.g., `fileSearchStores/xxxxx`)

**Response:**
```json
{
  "status": "success",
  "store": {
    "name": "fileSearchStores/xxxxx",
    "store_id": "xxxxx",
    "display_name": "My Documents"
  }
}
```

**Example:**
```bash
curl "https://your-api.com/{SECRET}/gemini-file-search/stores/fileSearchStores/xxxxx"
```

### 4. Delete File Search Store

**Endpoint:** `DELETE /{FIREBASE_WEBHOOK_SECRET}/gemini-file-search/stores/{store_name}`

**Description:** Delete a File Search store.

**Path Parameters:**
- `store_name`: Full store name (e.g., `fileSearchStores/xxxxx`)

**Response:**
```json
{
  "status": "success",
  "message": "Store fileSearchStores/xxxxx deleted successfully"
}
```

**Example:**
```bash
curl -X DELETE "https://your-api.com/{SECRET}/gemini-file-search/stores/fileSearchStores/xxxxx"
```

### 5. Upload File to Store

**Endpoint:** `POST /{FIREBASE_WEBHOOK_SECRET}/gemini-file-search/upload-file`

**Description:** Upload a file to a File Search store. Supports:
- HTTPS URLs (public URLs)
- GCS URLs (`gs://bucket/path`)
- Local file paths (if accessible from server)

**Request Body:**
```json
{
  "file_url": "https://storage.googleapis.com/bucket/document.pdf",
  "file_search_store_name": "fileSearchStores/xxxxx",
  "display_name": "My Document",  // Optional
  "wait_for_completion": true      // Optional, default: true
}
```

**Response:**
```json
{
  "status": "success",
  "document": {
    "name": "fileSearchStores/xxxxx/documents/yyyyy",
    "document_id": "yyyyy",
    "display_name": "My Document",
    "mime_type": "application/pdf",
    "size_bytes": 12345,
    "state": "ACTIVE"
  }
}
```

**Example:**
```bash
curl -X POST "https://your-api.com/{SECRET}/gemini-file-search/upload-file" \
  -H "Content-Type: application/json" \
  -d '{
    "file_url": "https://storage.googleapis.com/bucket/doc.pdf",
    "file_search_store_name": "fileSearchStores/xxxxx",
    "display_name": "Property Deed"
  }'
```

**Note:** If `wait_for_completion` is `true`, the endpoint will wait for indexing to complete before returning. This may take several seconds for large files.

### 6. Generate Content with File Search

**Endpoint:** `POST /{FIREBASE_WEBHOOK_SECRET}/gemini-file-search/generate-content`

**Description:** Generate content using File Search for RAG. The model will search the specified stores and use relevant documents as context.

**Request Body:**
```json
{
  "contents": "What is the property address in the document?",
  "file_search_store_names": ["fileSearchStores/xxxxx"],
  "model": "gemini-2.5-flash",           // Optional, default: "gemini-2.5-flash"
  "temperature": 0.7,                    // Optional
  "max_output_tokens": 2048,             // Optional
  "response_mime_type": "application/json",  // Optional, for structured output
  "response_schema": {                   // Optional, for structured output
    "type": "object",
    "properties": {
      "answer": {"type": "string"}
    }
  }
}
```

**Response:**
```json
{
  "status": "success",
  "text": "The property address is 123 Main Street...",
  "model": "gemini-2.5-flash",
  "finish_reason": "STOP",
  "has_citations": true,
  "citations": [
    {
      "uri": "fileSearchStores/xxxxx/documents/yyyyy",
      "title": "Property Deed",
      "start_index": 0,
      "end_index": 50,
      "license": null
    }
  ],
  "retrieval_queries": [
    "property address",
    "document address"
  ]
}
```

**Example:**
```bash
curl -X POST "https://your-api.com/{SECRET}/gemini-file-search/generate-content" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": "Summarize the key points from the documents",
    "file_search_store_names": ["fileSearchStores/xxxxx"]
  }'
```

**Structured Output Example:**
```bash
curl -X POST "https://your-api.com/{SECRET}/gemini-file-search/generate-content" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": "Extract the property address",
    "file_search_store_names": ["fileSearchStores/xxxxx"],
    "response_mime_type": "application/json",
    "response_schema": {
      "type": "object",
      "properties": {
        "address": {"type": "string"},
        "city": {"type": "string"},
        "state": {"type": "string"}
      }
    }
  }'
```

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "status": "error",
  "message": "Error description",
  "details": {
    // Additional error details
  }
}
```

**Common Error Codes:**
- `400` - Validation error (missing required fields, invalid format)
- `500` - Internal server error
- `503` - Service unavailable (Gemini API issues)

## Configuration

The API uses the following environment variables:

- `GEMINI_PROJECT_ID` - GCP project ID (required for Vertex AI)
- `GEMINI_LOCATION` - GCP location (default: `us-central1`)
- `GEMINI_API_KEY` - Gemini API key (required if not using Vertex AI)
- `GEMINI_USE_VERTEX_AI` - Whether to use Vertex AI (default: `true` if project_id is set)
- `GEMINI_TIMEOUT` - Request timeout in seconds (default: `60`)

## Supported Models

The following models support File Search:

- `gemini-3-pro-preview`
- `gemini-2.5-pro`
- `gemini-2.5-flash` (default)
- `gemini-2.5-flash-lite`

## Supported File Types

File Search supports a wide range of file formats including:

- **Documents**: PDF, Word, Excel, PowerPoint, OpenDocument formats
- **Text**: Plain text, Markdown, HTML, CSV, JSON, XML, YAML
- **Code**: Python, JavaScript, TypeScript, Java, C++, Go, Rust, and many more
- **Data**: JSON, CSV, SQL, and other structured formats

See the [official documentation](https://ai.google.dev/gemini-api/docs/file-search) for the complete list.

## Rate Limits

- **Maximum file size**: 100 MB per document
- **Total store size** (based on user tier):
  - Free: 1 GB
  - Tier 1: 10 GB
  - Tier 2: 100 GB
  - Tier 3: 1 TB
- **Recommendation**: Limit each File Search store to under 20 GB for optimal retrieval latencies

## Usage Examples

### Complete Workflow

```python
import requests

SECRET = "your-webhook-secret"
BASE_URL = "https://your-api.com"

# 1. Create a store
response = requests.post(
    f"{BASE_URL}/{SECRET}/gemini-file-search/create-store",
    json={"display_name": "Property Documents"}
)
store = response.json()["store"]
store_name = store["name"]

# 2. Upload a file
response = requests.post(
    f"{BASE_URL}/{SECRET}/gemini-file-search/upload-file",
    json={
        "file_url": "https://storage.googleapis.com/bucket/deed.pdf",
        "file_search_store_name": store_name,
        "display_name": "Property Deed",
        "wait_for_completion": True
    }
)
document = response.json()["document"]

# 3. Generate content with RAG
response = requests.post(
    f"{BASE_URL}/{SECRET}/gemini-file-search/generate-content",
    json={
        "contents": "What is the property address?",
        "file_search_store_names": [store_name]
    }
)
result = response.json()
print(result["text"])
for citation in result.get("citations", []):
    print(f"Cited: {citation['title']}")
```

### Using Multiple Stores

```python
# Upload documents to different stores
legal_store = create_store("Legal Documents")
technical_store = create_store("Technical Docs")

# Query across multiple stores
response = requests.post(
    f"{BASE_URL}/{SECRET}/gemini-file-search/generate-content",
    json={
        "contents": "What are the key legal and technical requirements?",
        "file_search_store_names": [
            legal_store["name"],
            technical_store["name"]
        ]
    }
)
```

## Best Practices

1. **Wait for Indexing**: Always set `wait_for_completion: true` when uploading files, or wait a few seconds before querying.

2. **Store Organization**: Create separate stores for different document types or use cases.

3. **Error Handling**: Always check the `status` field in responses and handle errors appropriately.

4. **Citation Usage**: Use citations to provide source attribution and verify information.

5. **Store Size**: Keep stores under 20 GB for optimal performance.

6. **Structured Output**: Use `response_schema` for consistent, parseable responses when needed.

## References

- [Gemini API File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)
- [Google Gen AI SDK](https://github.com/google/generative-ai-python)
- [gcp/common/gemini_file_search README](../../common/gemini_file_search/README.md)

