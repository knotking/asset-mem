# File Search Agent

The File Search Agent provides semantic search capabilities over user-uploaded documents using the **Gemini File Search API**.

## Overview

This agent is designed to replace the existing Vertex AI RAG-based `user_docs_agent` with a more streamlined approach using Gemini's native file handling capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     File Search Agent                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Firestore  │───▶│   Gemini     │───▶│   Gemini     │       │
│  │   Metadata   │    │   Files API  │    │   Model      │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              ask_file_search_retrieval               │       │
│  │                   (Tool Function)                    │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **File Upload**: Files are uploaded via the proxy API, processed by the `file_search_upload` Cloud Function, and metadata is stored in Firestore.

2. **Search Query**: When a user queries their documents:
   - Agent retrieves file metadata from Firestore (`gemini_files` collection)
   - Fetches actual Gemini file objects using the stored `gemini_file_id`
   - Passes files + query to Gemini model for contextual search
   - Returns synthesized answer with source citations

## Usage

### Integration with Property Agent

```python
from property_agent.sub_agents.file_search_agent import file_search_agent

# Use as a sub-agent
doculink_agent = Agent(
    name="doculink_agent",
    tools=[file_search_agent, knowledge_base_agent],
    # ...
)
```

### Standalone Usage

```python
from file_search_agent import ask_file_search_retrieval

result = ask_file_search_retrieval(
    user_query="What is the warranty period?",
    context_doc_uris=["warranty.pdf"],
    tool_context=context,
)
```

## Configuration

Required environment variables:

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Gemini API key for file operations |
| `GCP_PROJECT_ID` | GCP project ID for Firestore |

## Firestore Schema

The agent reads from the `gemini_files` collection:

```json
{
  "id": "user123_20241126120000_abc123",
  "user_id": "user123",
  "property_id": "prop456",
  "gcs_url": "gs://bucket/uploads/user123/file.pdf",
  "gemini_file_id": "files/abc123xyz",
  "gemini_file_uri": "https://generativelanguage.googleapis.com/...",
  "original_filename": "warranty.pdf",
  "mime_type": "application/pdf",
  "status": "active",
  "created_at": "2024-11-26T12:00:00Z",
  "expires_at": "2024-11-28T12:00:00Z"
}
```

## Migration from User Docs Agent

To migrate from the existing `user_docs_agent`:

1. Deploy the file search infrastructure (Cloud Functions, Pub/Sub)
2. Run the migration script to re-upload existing RAG files to Gemini Files API
3. Update the Property Agent to use `file_search_agent` instead of `user_docs_agent`
4. Test thoroughly before removing the old RAG infrastructure

See `docs/GEMINI_FILE_SEARCH_MIGRATION.md` for detailed migration steps.

## Limitations

- Gemini files expire after 48 hours (automatic refresh handled by Cloud Function)
- Maximum 20 files per query (batching for more files)
- 2GB maximum file size per file

