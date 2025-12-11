# Gemini File Search - RAG Support for Gemini API

A comprehensive Gemini API File Search integration module for Retrieval Augmented Generation (RAG) operations.

## Features

- **File Search Store Management** - Create, list, and delete File Search stores
- **File Upload** - Upload files to stores with automatic chunking and indexing
- **RAG Queries** - Generate content with File Search for context-aware responses
- **Citation Support** - Access citations and grounding metadata from responses
- **Async Support** - Full async/await support for high-performance applications
- **Vertex AI & API Key Auth** - Support for both Vertex AI and API key authentication

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install google-genai pydantic google-cloud-secret-manager
```

## Configuration

### Environment Variables (Vertex AI - Recommended)

Set the following environment variables for Vertex AI:

```bash
# Required
export GEMINI_PROJECT_ID="your-gcp-project-id"
export GEMINI_LOCATION="us-central1"

# Optional
export GEMINI_USE_VERTEX_AI="true"  # Default: true if project_id is set
export GEMINI_TIMEOUT="60"
```

### Environment Variables (API Key)

Alternatively, use API key authentication:

```bash
# Required
export GEMINI_API_KEY="your-api-key"

# Optional
export GEMINI_USE_VERTEX_AI="false"
export GEMINI_TIMEOUT="60"
```

### Using .env File

Create a `.env` file in your project root:

```env
GEMINI_PROJECT_ID=your-gcp-project-id
GEMINI_LOCATION=us-central1
GEMINI_USE_VERTEX_AI=true
```

Then load it in your code:

```python
from dotenv import load_dotenv
load_dotenv()

from gemini_file_search import GeminiFileSearchConfig, GeminiFileSearchClient

config = GeminiFileSearchConfig.from_env()
```

### Using Google Cloud Secret Manager

For production deployments, store configuration in GCP Secret Manager:

```bash
# Create secret with JSON config
echo '{"project_id": "...", "location": "...", "use_vertex_ai": true}' | \
  gcloud secrets create gemini-file-search-config --data-file=-
```

Then load in code:

```python
from gemini_file_search import GeminiFileSearchConfig, GeminiFileSearchClient

config = GeminiFileSearchConfig.from_gcp_secret_manager(
    project_id="your-secrets-project-id",
    config_secret="gemini-file-search-config",
)
```

## Usage

### Basic Setup

```python
import asyncio
from gemini_file_search import GeminiFileSearchClient, GeminiFileSearchConfig

# Load configuration
config = GeminiFileSearchConfig.from_env()

# Create client
client = GeminiFileSearchClient(config)
```

### Creating a File Search Store

```python
async def create_store_example():
    async with GeminiFileSearchClient(GeminiFileSearchConfig.from_env()) as client:
        store = await client.create_store(display_name="My Documents")
        print(f"Created store: {store.name}")
        print(f"Store ID: {store.store_id}")

asyncio.run(create_store_example())
```

### Uploading Files

```python
async def upload_file_example():
    async with GeminiFileSearchClient(GeminiFileSearchConfig.from_env()) as client:
        # Create a store
        store = await client.create_store(display_name="Document Store")
        
        # Upload a file
        document = await client.upload_file(
            file="document.pdf",
            file_search_store_name=store.name,
            display_name="My Document",
            wait_for_completion=True  # Wait for indexing to complete
        )
        
        print(f"Uploaded document: {document.name}")
        print(f"Document state: {document.state}")

asyncio.run(upload_file_example())
```

### Generating Content with File Search (RAG)

```python
async def rag_example():
    async with GeminiFileSearchClient(GeminiFileSearchConfig.from_env()) as client:
        # Create store and upload file
        store = await client.create_store(display_name="Knowledge Base")
        await client.upload_file(
            file="knowledge_base.pdf",
            file_search_store_name=store.name,
            wait_for_completion=True
        )
        
        # Generate content with File Search
        response = await client.generate_content(
            contents="What are the key points in the document?",
            file_search_store_names=[store.name],
            model="gemini-2.5-flash"
        )
        
        print(f"Response: {response.text}")
        
        # Access citations
        if response.has_citations:
            print("\nCitations:")
            for citation in response.citations:
                print(f"  - {citation.title or citation.uri}")

asyncio.run(rag_example())
```

### Structured Output with File Search

```python
async def structured_output_example():
    async with GeminiFileSearchClient(GeminiFileSearchConfig.from_env()) as client:
        store = await client.create_store(display_name="Data Store")
        await client.upload_file(
            file="data.json",
            file_search_store_name=store.name,
            wait_for_completion=True
        )
        
        # Define response schema
        response_schema = {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "key_points": {
                    "type": "array",
                    "items": {"type": "string"}
                }
            }
        }
        
        response = await client.generate_content(
            contents="Extract key information from the document",
            file_search_store_names=[store.name],
            response_mime_type="application/json",
            response_schema=response_schema
        )
        
        import json
        data = json.loads(response.text)
        print(f"Summary: {data['summary']}")
        print(f"Key points: {data['key_points']}")

asyncio.run(structured_output_example())
```

### Managing Stores

```python
async def manage_stores_example():
    async with GeminiFileSearchClient(GeminiFileSearchConfig.from_env()) as client:
        # List all stores
        stores = await client.list_stores()
        print(f"Found {len(stores)} stores")
        for store in stores:
            print(f"  - {store.display_name}: {store.name}")
        
        # Get a specific store
        if stores:
            store = await client.get_store(stores[0].name)
            print(f"\nStore details: {store.display_name}")
        
        # Delete a store (if needed)
        # await client.delete_store(store.name)

asyncio.run(manage_stores_example())
```

## API Reference

### GeminiFileSearchConfig

Configuration container for Gemini File Search.

| Attribute | Type | Description |
|-----------|------|-------------|
| `project_id` | str | GCP project ID (required for Vertex AI) |
| `location` | str | GCP location (default: 'us-central1') |
| `api_key` | str | Gemini API key (required if not using Vertex AI) |
| `use_vertex_ai` | bool | Whether to use Vertex AI (default: True if project_id is set) |
| `timeout` | float | Request timeout in seconds (default: 60.0) |

### GeminiFileSearchClient Methods

#### Store Management
- `create_store(display_name?) -> FileSearchStore`
- `list_stores() -> List[FileSearchStore]`
- `get_store(store_name) -> FileSearchStore`
- `delete_store(store_name) -> None`

#### File Operations
- `upload_file(file, file_search_store_name, display_name?, mime_type?, wait_for_completion?, poll_interval?) -> FileSearchDocument`
- `_wait_for_operation(operation_name, poll_interval?, max_wait_time?) -> Operation`

#### Content Generation
- `generate_content(contents, file_search_store_names, model?, temperature?, max_output_tokens?, response_mime_type?, response_schema?) -> GenerateContentResponse`

### Models

#### FileSearchStore
```python
FileSearchStore(
    name: str,                    # Full resource name
    display_name: Optional[str],   # Display name
    created_at: Optional[datetime] # Creation timestamp
)
```

#### FileSearchDocument
```python
FileSearchDocument(
    name: str,                     # Full resource name
    display_name: Optional[str],   # Display name
    mime_type: Optional[str],      # MIME type
    size_bytes: Optional[int],      # Size in bytes
    state: Optional[str]            # Document state
)
```

#### GenerateContentResponse
```python
response.text                    # Generated text
response.grounding_metadata      # GroundingMetadata or None
response.model                   # Model used
response.finish_reason           # Finish reason
response.citations               # List[Citation] - convenience property
response.has_citations           # bool - convenience property
```

#### Citation
```python
Citation(
    start_index: Optional[int],    # Start index in response
    end_index: Optional[int],      # End index in response
    uri: Optional[str],            # Document URI
    title: Optional[str],          # Document title
    license: Optional[str]         # License info
)
```

## Supported Models

The following models support File Search:

- `gemini-3-pro-preview`
- `gemini-2.5-pro`
- `gemini-2.5-flash` and its preview versions
- `gemini-2.5-flash-lite` and its preview versions

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

**Note:** The limit on File Search store size is computed on the backend, based on the size of your input plus the embeddings generated and stored with it. This is typically approximately 3 times the size of your input data.

## Pricing

- **Embeddings at indexing time**: $0.15 per 1M tokens (based on existing embeddings pricing)
- **Storage**: Free of charge
- **Query time embeddings**: Free of charge
- **Retrieved document tokens**: Charged as regular context tokens

## Authentication

### Vertex AI (Recommended)

The client uses Google Cloud Application Default Credentials (ADC). Set up authentication:

```bash
# Service Account (Recommended for Production)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# User Credentials (Development)
gcloud auth application-default login
```

### API Key

For API key authentication, set the `GEMINI_API_KEY` environment variable:

```bash
export GEMINI_API_KEY="your-api-key"
export GEMINI_USE_VERTEX_AI="false"
```

### Required IAM Roles (Vertex AI)

The service account needs these roles:
- `roles/aiplatform.user` - For using Vertex AI Gemini API
- `roles/storage.objectViewer` - If accessing files from Cloud Storage (optional)

## Error Handling

```python
from gemini_file_search import GeminiFileSearchClient, GeminiFileSearchConfig
from gemini_file_search.client import GeminiFileSearchError

async def safe_operation():
    try:
        async with GeminiFileSearchClient(GeminiFileSearchConfig.from_env()) as client:
            store = await client.create_store(display_name="Test Store")
            print(f"Created store: {store.name}")
    except GeminiFileSearchError as e:
        print(f"Gemini File Search error: {e}")
        print(f"Status code: {e.status_code}")
        print(f"Details: {e.details}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_operation())
```

## Testing

Run tests with pytest:

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_client.py
```

## Troubleshooting

### Common Issues

**Error: "Project ID required for Vertex AI"**
- Ensure `GEMINI_PROJECT_ID` is set
- Or set `GEMINI_USE_VERTEX_AI=false` and provide `GEMINI_API_KEY`

**Error: "API key required when not using Vertex AI"**
- Set `GEMINI_API_KEY` environment variable
- Or use Vertex AI by setting `GEMINI_PROJECT_ID`

**Error: "Permission denied"**
- Verify service account has `roles/aiplatform.user` role (for Vertex AI)
- Check that `GOOGLE_APPLICATION_CREDENTIALS` is set correctly

**Error: "File not found"**
- Verify the file path is correct
- Check file permissions

**Upload operation times out**
- Increase `poll_interval` or `max_wait_time`
- Check file size (max 100 MB per document)
- Verify network connectivity

**No citations in response**
- Ensure files are fully indexed (wait for `wait_for_completion=True`)
- Check that the query is relevant to the uploaded documents
- Verify File Search tool is properly configured

## Best Practices

### 1. Store Organization

```python
# Create separate stores for different document types
legal_store = await client.create_store(display_name="Legal Documents")
technical_store = await client.create_store(display_name="Technical Docs")
```

### 2. Wait for Indexing

```python
# Always wait for indexing to complete before querying
document = await client.upload_file(
    file="document.pdf",
    file_search_store_name=store.name,
    wait_for_completion=True  # Important!
)
```

### 3. Error Handling

```python
try:
    response = await client.generate_content(
        contents="...",
        file_search_store_names=[store.name]
    )
except GeminiFileSearchError as e:
    logger.error(f"File Search error: {e}")
    # Handle error appropriately
```

### 4. Citation Usage

```python
response = await client.generate_content(...)
if response.has_citations:
    for citation in response.citations:
        # Use citation.uri or citation.title to reference sources
        logger.info(f"Cited source: {citation.title}")
```

### 5. Store Size Management

```python
# Keep stores under 20 GB for optimal performance
# Consider splitting large document collections into multiple stores
```

## License

Internal use only.

## References

- [Gemini API File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)
- [Google Gen AI SDK](https://github.com/google/generative-ai-python)

