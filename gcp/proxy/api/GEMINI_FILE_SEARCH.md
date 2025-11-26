# Gemini File Search API Documentation

## Overview

This implementation provides **Retrieval Augmented Generation (RAG)** capabilities using Google's Gemini API File Search feature. Unlike simple file listing, this enables semantic search over document content with AI-powered responses and citations.

**Reference**: [Google Gemini File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)

## ⚠️ Architecture Notice

**As of the latest architectural review, file search operations should follow this pattern:**

1. **For Queries (Recommended)**: Use **agent tools** that automatically handle user context and isolation
   - Location: `gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/agent_v2.py`
   - Tool: `ask_user_docs_retrieval_v2()`
   - Benefits: Agent decides when to search, automatic user_id filtering, proper isolation

2. **For File Operations**: Use **user-scoped endpoints** (`/file-search/user/*`)
   - Required `user_id` parameter ensures proper isolation
   - Auto-creates user stores as needed
   - See sections on user-scoped endpoints below

3. **Deprecated**: Non-user-scoped endpoints (`/file-search/import-gcs-file`, `/file-search/query`)
   - These have been removed as they bypassed agent intelligence and didn't enforce user_id filtering
   - See deprecation notices in sections 5 and 6 below

## What is File Search?

File Search is a RAG tool that:
1. **Imports & Chunks**: Automatically processes and chunks your documents
2. **Indexes**: Creates embeddings for semantic search
3. **Retrieves**: Finds relevant information based on natural language queries
4. **Generates**: Provides AI-generated answers with citations to source documents

## Supported Models

- `gemini-2.5-flash` (recommended, default)
- `gemini-2.5-pro`
- `gemini-2.5-flash-lite`

## Supported File Types

File Search supports **100+ file types** including:
- **Documents**: PDF, DOCX, TXT, MD, RTF
- **Spreadsheets**: XLSX, CSV
- **Presentations**: PPTX
- **Code**: Python, JavaScript, Java, C++, Go, Rust, etc.
- **Data**: JSON, XML, YAML, SQL
- **And many more** (see [full list](https://ai.google.dev/gemini-api/docs/file-search#supported_file_types))

## Configuration

### Environment Variables

```bash
# Required: Gemini API Key
export GEMINI_API_KEY=your-gemini-api-key

# Optional: Firebase webhook secret (for API access)
export FIREBASE_WEBHOOK_SECRET=your-secret
```

### Get a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Set it in your environment

## API Endpoints

All endpoints are secured with the Firebase webhook secret.

Base URL: `/{FIREBASE_WEBHOOK_SECRET}/file-search`

### 1. Create File Search Store

**Endpoint**: `POST /file-search/create-store`

Create a new File Search store (collection of documents).

**Request**:
```json
{
  "display_name": "Property Documents Store"
}
```

**Response**:
```json
{
  "name": "fileSearchStores/abc123xyz",
  "display_name": "Property Documents Store",
  "create_time": "2024-11-26T10:00:00Z",
  "status": "created"
}
```

### 2. List File Search Stores

**Endpoint**: `GET /file-search/list-stores`

List all your File Search stores.

**Response**:
```json
{
  "stores": [
    {
      "name": "fileSearchStores/abc123xyz",
      "display_name": "Property Documents Store",
      "create_time": "2024-11-26T10:00:00Z"
    }
  ],
  "count": 1
}
```

### 3. Delete File Search Store

**Endpoint**: `DELETE /file-search/delete-store`

Delete a File Search store and all its documents.

**Request**:
```json
{
  "store_name": "fileSearchStores/abc123xyz"
}
```

**Response**:
```json
{
  "status": "deleted",
  "store_name": "fileSearchStores/abc123xyz"
}
```

### 4. Upload File to Store

**Endpoint**: `POST /file-search/upload-file`

Upload a local file to a File Search store.

**Request**:
```json
{
  "file_path": "/path/to/document.pdf",
  "store_name": "fileSearchStores/abc123xyz",
  "display_name": "Property Deed",
  "wait_for_completion": true,
  "timeout": 300
}
```

**Response**:
```json
{
  "status": "completed",
  "operation_name": "operations/xyz789",
  "display_name": "Property Deed",
  "store_name": "fileSearchStores/abc123xyz"
}
```

### 5. Import GCS File to Store

> **⚠️ DEPRECATED**: This endpoint has been removed per architectural review. 
> Use `/file-search/user/import-gcs-file` for user-scoped imports, or preferably use agent tools (see section below).

**Endpoint**: `POST /file-search/import-gcs-file` *(DEPRECATED)*

Import a file from Google Cloud Storage to a File Search store.

**Request**:
```json
{
  "gcs_uri": "gs://my-bucket/documents/property-deed.pdf",
  "store_name": "fileSearchStores/abc123xyz",
  "display_name": "Property Deed",
  "mime_type": "application/pdf",
  "wait_for_completion": true
}
```

**Response**:
```json
{
  "status": "completed",
  "operation_name": "operations/xyz789",
  "display_name": "Property Deed",
  "gcs_uri": "gs://my-bucket/documents/property-deed.pdf"
}
```

### 6. Query File Search (RAG)

> **⚠️ DEPRECATED**: This endpoint has been removed per architectural review.
> Use `/file-search/user/query` for user-scoped queries, or preferably use agent tools (recommended).
> **Reason**: This endpoint did not filter by user_id, allowing queries across all stores. The agent layer should control when and how file search is used with proper user isolation.

**Endpoint**: `POST /file-search/query` *(DEPRECATED)*

Query documents with natural language and get AI-generated answers with citations.

**Request**:
```json
{
  "query": "What is the property address and square footage?",
  "store_names": ["fileSearchStores/abc123xyz"],
  "model": "gemini-2.5-flash",
  "include_grounding_metadata": true
}
```

**Response**:
```json
{
  "text": "Based on the property deed, the address is 123 Main Street, and the square footage is 2,500 sq ft.",
  "model": "gemini-2.5-flash",
  "stores_queried": ["fileSearchStores/abc123xyz"],
  "grounding_metadata": {
    "grounding_chunks": [
      {
        "type": "file_search",
        "document_name": "Property Deed",
        "chunk_text": "Property located at 123 Main Street...",
        "page_number": 1
      }
    ],
    "grounding_supports": [
      {
        "segment": {
          "start_index": 35,
          "end_index": 50
        },
        "grounding_chunk_indices": [0],
        "confidence_scores": [0.95]
      }
    ]
  }
}
```

### 7. Get Operation Status

**Endpoint**: `POST /file-search/operation-status`

Check the status of a long-running operation.

**Request**:
```json
{
  "operation_name": "operations/xyz789"
}
```

**Response**:
```json
{
  "name": "operations/xyz789",
  "done": true,
  "status": "completed"
}
```

## Usage Examples

### Example 1: Create Store and Upload Document

```bash
# 1. Create a store
curl -X POST "https://your-api.com/${SECRET}/file-search/create-store" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Property Documents"}'

# Response: {"name": "fileSearchStores/abc123", ...}

# 2. Import a GCS file
curl -X POST "https://your-api.com/${SECRET}/file-search/import-gcs-file" \
  -H "Content-Type: application/json" \
  -d '{
    "gcs_uri": "gs://my-bucket/property-deed.pdf",
    "store_name": "fileSearchStores/abc123",
    "display_name": "Property Deed",
    "mime_type": "application/pdf"
  }'
```

### Example 2: Query Documents

```bash
curl -X POST "https://your-api.com/${SECRET}/file-search/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the key details about this property?",
    "store_names": ["fileSearchStores/abc123"],
    "model": "gemini-2.5-flash"
  }'
```

### Example 3: Python Integration

```python
import requests

BASE_URL = "https://your-api.com"
SECRET = "your-firebase-secret"

# Create store
response = requests.post(
    f"{BASE_URL}/{SECRET}/file-search/create-store",
    json={"display_name": "My Documents"}
)
store_name = response.json()["name"]

# Import file from GCS
requests.post(
    f"{BASE_URL}/{SECRET}/file-search/import-gcs-file",
    json={
        "gcs_uri": "gs://bucket/file.pdf",
        "store_name": store_name,
        "display_name": "Document"
    }
)

# Query the documents
response = requests.post(
    f"{BASE_URL}/{SECRET}/file-search/query",
    json={
        "query": "Summarize the key points",
        "store_names": [store_name]
    }
)

print(response.json()["text"])
```

## Rate Limits & Pricing

### Rate Limits

- **Max file size**: 100 MB per document
- **Storage limits** (by tier):
  - Free: 1 GB
  - Tier 1: 10 GB
  - Tier 2: 100 GB
  - Tier 3: 1 TB
- **Recommendation**: Keep each store under 20 GB for optimal performance

### Pricing

- **Indexing**: $0.15 per 1M tokens (charged once when uploading)
- **Storage**: Free
- **Query embeddings**: Free
- **Retrieved tokens**: Charged as regular context tokens

Reference: [Gemini API Pricing](https://ai.google.dev/pricing)

## Use Cases

### 1. Property Document Analysis
- Index all property-related documents (deeds, insurance, inspections)
- Query: "What is the property address and purchase date?"
- Get answers with citations to specific documents

### 2. Support Knowledge Base
- Upload help articles, FAQs, documentation
- Enable semantic search across all content
- Get AI-generated answers with source citations

### 3. Research Assistant
- Index research papers, reports, articles
- Ask complex questions across multiple documents
- Get synthesized answers with references

### 4. Legal Document Search
- Index contracts, agreements, policies
- Search by natural language queries
- Get precise answers with page citations

### 5. Code Documentation
- Index code repositories and documentation
- Ask questions about implementation details
- Get answers with code examples

## Best Practices

### 1. Store Organization
- **Create separate stores** for different document types or users
- **Use descriptive names** for easy identification
- **Keep stores focused** on related content

### 2. File Upload
- **Provide descriptive display names** for better citations
- **Set appropriate MIME types** for accurate processing
- **Wait for completion** for important uploads

### 3. Querying
- **Be specific** in your queries for better results
- **Use natural language** - no need for keywords
- **Request grounding metadata** for citations
- **Choose the right model**:
  - `gemini-2.5-flash`: Fast, cost-effective (default)
  - `gemini-2.5-pro`: More accurate, complex queries

### 4. Performance
- **Batch uploads** when adding multiple files
- **Monitor store sizes** (keep under 20 GB)
- **Cache common queries** if appropriate
- **Use async operations** for large files

## Integration with Existing System

### With Property Agent

```python
# Import user's documents to File Search
gcs_uris = get_user_documents(user_id)
for uri in gcs_uris:
    import_gcs_file_to_store(
        gcs_uri=uri,
        store_name=user_store_name
    )

# Query in agent workflow
response = query_file_search(
    query=user_query,
    store_names=[user_store_name]
)
```

### With Document Upload Flow

```python
# When user uploads a document
async def on_document_upload(user_id, gcs_uri):
    # Get or create user's File Search store
    store_name = get_or_create_user_store(user_id)
    
    # Import to File Search for RAG
    await import_gcs_file_to_store(
        gcs_uri=gcs_uri,
        store_name=store_name
    )
    
    # Also run document analysis
    await extract_doc_info(gcs_uri)
```

## Error Handling

All endpoints return consistent error format:

```json
{
  "status": "error",
  "message": "Detailed error message"
}
```

Common errors:
- `GEMINI_API_KEY not set`: Missing API key
- `File size exceeds limit`: File > 100 MB
- `Store not found`: Invalid store name
- `Operation timeout`: Import took too long
- `Invalid file type`: Unsupported format

## Troubleshooting

### Import takes too long
- **Large files** (50+ MB) may take 5-10 minutes
- **Increase timeout** parameter
- **Use async** (wait_for_completion=false) and poll status

### No results from query
- **Wait for import** to complete fully
- **Check document format** is supported
- **Verify store name** is correct
- **Try rephrasing** your query

### Storage limit exceeded
- **Delete old stores** you don't need
- **Split into multiple stores** by category
- **Upgrade tier** if needed

## Next Steps

1. ✅ Get a [Gemini API key](https://aistudio.google.com/apikey)
2. ✅ Set `GEMINI_API_KEY` environment variable
3. ✅ Create your first File Search store
4. ✅ Upload documents to the store
5. ✅ Query with natural language
6. ✅ Integrate into your application

## Resources

- **API Reference**: [Gemini File Search Docs](https://ai.google.dev/gemini-api/docs/file-search)
- **Supported Models**: [Model Documentation](https://ai.google.dev/gemini-api/docs/models/gemini)
- **Pricing**: [Gemini API Pricing](https://ai.google.dev/pricing)
- **File Types**: [Supported Formats](https://ai.google.dev/gemini-api/docs/file-search#supported_file_types)

---

**Implementation Status**: ✅ Complete and ready for use
**Last Updated**: November 26, 2024

