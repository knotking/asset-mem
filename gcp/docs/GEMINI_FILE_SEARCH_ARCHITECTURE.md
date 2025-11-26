# Gemini File Search Architecture

This document describes the architecture for the Gemini File Search infrastructure, which provides semantic document search capabilities using Google's Gemini API File Search feature.

## Overview

The Gemini File Search system enables users to upload documents and perform semantic search queries across their files. It replaces the previous Vertex AI RAG-based approach with Gemini's native file handling capabilities.

### Key Benefits

- **Simplified Architecture**: Direct file upload to Gemini API eliminates RAG corpus management
- **Better Performance**: Native Gemini file context provides faster, more accurate responses
- **Automatic Refresh**: Files are automatically refreshed before expiry (48-hour limit)
- **Multi-tenant**: Full user isolation with per-user file collections
- **Property Association**: Files can be associated with specific properties

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Client Applications                                 │
│                                                                                  │
│     ┌──────────────────┐              ┌──────────────────┐                      │
│     │    Web App       │              │   Mobile App     │                      │
│     │    (Next.js)     │              │   (Expo)         │                      │
│     └────────┬─────────┘              └────────┬─────────┘                      │
│              │                                  │                                │
└──────────────┼──────────────────────────────────┼────────────────────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              GCP Infrastructure                                  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         Cloud Run - Proxy API                              │  │
│  │                                                                            │  │
│  │   ┌─────────────────────┐    ┌─────────────────────┐                      │  │
│  │   │  /file-search/*    │    │  /firebase-*        │                      │  │
│  │   │  File Search API    │    │  Agent Endpoints    │                      │  │
│  │   └──────────┬──────────┘    └──────────┬──────────┘                      │  │
│  │              │                          │                                  │  │
│  └──────────────┼──────────────────────────┼──────────────────────────────────┘  │
│                 │                          │                                     │
│       ┌─────────┴─────────┐      ┌─────────┴─────────┐                          │
│       ▼                   ▼      ▼                   ▼                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────────┐  │
│  │   Pub/Sub   │    │  Firestore  │    │        Vertex AI Agent Engine       │  │
│  │   Topics    │    │  Database   │    │                                     │  │
│  │             │    │             │    │  ┌─────────────────────────────────┐│  │
│  │ - upload    │    │ - gemini_   │    │  │       Property Agent            ││  │
│  │ - result    │    │   files     │    │  │                                 ││  │
│  │ - refresh   │    │ - file_     │    │  │  ┌────────────────────────────┐ ││  │
│  │             │    │   search_   │    │  │  │    File Search Agent       │ ││  │
│  └──────┬──────┘    │   stores    │    │  │  │                            │ ││  │
│         │           └──────┬──────┘    │  │  │  ask_file_search_retrieval │ ││  │
│         │                  │           │  │  └────────────────────────────┘ ││  │
│         ▼                  │           │  └─────────────────────────────────┘│  │
│  ┌─────────────────────────┼───────────┴─────────────────────────────────────┘  │
│  │       Cloud Functions   │                                                    │
│  │                         │                                                    │
│  │  ┌──────────────────┐   │   ┌──────────────────┐                            │
│  │  │  file-search-    │───┼──▶│  file-search-    │                            │
│  │  │  upload          │   │   │  refresh         │                            │
│  │  └────────┬─────────┘   │   └────────┬─────────┘                            │
│  │           │             │            │                                       │
│  └───────────┼─────────────┼────────────┼───────────────────────────────────────┘
│              │             │            │                                        │
│              ▼             ▼            ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                         Google Gemini API                                    │ │
│  │                                                                              │ │
│  │   ┌─────────────────┐         ┌─────────────────┐                           │ │
│  │   │   Files API     │         │   Models API    │                           │ │
│  │   │                 │         │                 │                           │ │
│  │   │ - upload_file() │         │ - generate()    │                           │ │
│  │   │ - get_file()    │         │   with files    │                           │ │
│  │   │ - delete_file() │         │                 │                           │ │
│  │   └─────────────────┘         └─────────────────┘                           │ │
│  │                                                                              │ │
│  └──────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────────┐ │
│  │                         Cloud Storage (GCS)                                   │ │
│  │                                                                               │ │
│  │   gs://homegeek-user-data-{env}/                                             │ │
│  │   └── uploads/                                                                │ │
│  │       └── {user_id}/                                                          │ │
│  │           └── {filename}                                                      │ │
│  │                                                                               │ │
│  └───────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. File Upload Flow

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌────────────┐     ┌─────────────┐
│ Client  │────▶│ Proxy    │────▶│ Pub/Sub │────▶│ Cloud      │────▶│ Gemini      │
│         │     │ API      │     │ Topic   │     │ Function   │     │ Files API   │
└─────────┘     └──────────┘     └─────────┘     └────────────┘     └─────────────┘
                     │                                 │
                     │                                 ▼
                     │                           ┌───────────┐
                     │                           │ Firestore │
                     │                           │ Metadata  │
                     │                           └───────────┘
                     │                                 │
                     │                                 ▼
                     │                           ┌───────────┐
                     └───────────────────────────│ Pub/Sub   │
                         (listen for result)     │ Result    │
                                                 └───────────┘
```

**Steps:**
1. Client uploads file to GCS (via Firebase Storage SDK)
2. Client calls `/file-search/upload` with GCS URL
3. Proxy publishes message to `file-search-upload-topic`
4. Cloud Function processes message:
   - Downloads file from GCS
   - Uploads to Gemini Files API
   - Stores metadata in Firestore
   - Publishes result to `file-search-result-topic`
5. Client receives confirmation

### 2. File Query Flow

```
┌─────────┐     ┌──────────┐     ┌───────────┐     ┌─────────────┐
│ Client  │────▶│ Proxy    │────▶│ Firestore │     │ Gemini      │
│         │     │ API      │     │ Metadata  │────▶│ Files API   │
└─────────┘     └──────────┘     └───────────┘     └─────────────┘
                     │                                    │
                     │                                    ▼
                     │                              ┌───────────┐
                     │◀─────────────────────────────│ Gemini    │
                     │         (response)           │ Model     │
                     │                              └───────────┘
```

**Steps:**
1. Client calls `/file-search/query` with search query
2. Proxy retrieves file metadata from Firestore
3. Proxy fetches Gemini file objects
4. Proxy sends files + query to Gemini model
5. Response returned to client with source citations

### 3. Agent Integration Flow

```
┌─────────┐     ┌──────────────┐     ┌────────────────────┐
│ Client  │────▶│ Agent Engine │────▶│ File Search Agent  │
│         │     │              │     │                    │
└─────────┘     └──────────────┘     └────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                                               │
                      ▼                                               ▼
               ┌───────────┐                                   ┌───────────┐
               │ Firestore │                                   │ Gemini    │
               │ Metadata  │──────────────────────────────────▶│ API       │
               └───────────┘                                   └───────────┘
```

**Steps:**
1. User sends message to Property Agent
2. Property Agent routes to File Search Agent
3. File Search Agent:
   - Queries Firestore for user's files
   - Retrieves Gemini file objects
   - Searches using Gemini model with file context
   - Returns answer with citations

## Data Models

### Firestore Collections

#### `gemini_files` Collection

Stores metadata for each uploaded file.

```json
{
  "id": "user123_20241126120000_abc12345",
  "user_id": "user123",
  "property_id": "property456",
  "gcs_url": "gs://bucket/uploads/user123/document.pdf",
  "gemini_file_id": "files/abc123xyz789",
  "gemini_file_uri": "https://generativelanguage.googleapis.com/v1beta/files/abc123xyz789",
  "original_filename": "document.pdf",
  "mime_type": "application/pdf",
  "file_size_bytes": 1048576,
  "file_hash": "sha256:...",
  "status": "active",
  "created_at": "2024-11-26T12:00:00Z",
  "expires_at": "2024-11-28T12:00:00Z",
  "last_refreshed_at": null,
  "error_message": null,
  "metadata": {}
}
```

**Status Values:**
- `pending`: File queued for processing
- `processing`: Upload in progress
- `active`: File ready for use
- `expired`: File expired in Gemini
- `failed`: Upload/processing failed
- `deleted`: File deleted by user

#### `file_search_stores` Collection

Groups files for organized querying.

```json
{
  "id": "user123_20241126120000",
  "store_id": "user123_20241126120000",
  "user_id": "user123",
  "property_id": "property456",
  "name": "Property Documents",
  "description": "All documents for my property",
  "file_ids": ["files/abc123", "files/def456"],
  "status": "active",
  "created_at": "2024-11-26T12:00:00Z",
  "updated_at": "2024-11-26T12:00:00Z",
  "expires_at": "2024-11-28T12:00:00Z",
  "config": {}
}
```

## Infrastructure Components

### Terraform Modules

| Module | Purpose |
|--------|---------|
| `modules/pubsub` | Pub/Sub topics and subscriptions for file processing |
| `modules/firestore` | Firestore database and indexes for metadata |
| `modules/file-search-function` | Cloud Functions for upload and refresh |
| `modules/storage` | GCS buckets for file storage |

### Pub/Sub Topics

| Topic | Purpose | Triggered By |
|-------|---------|--------------|
| `file-search-upload-topic` | New file uploads | Proxy API |
| `file-search-result-topic` | Processing results | Cloud Function |
| `file-search-refresh-topic` | File refresh requests | Cloud Scheduler |

### Cloud Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `file-search-upload` | Pub/Sub | Process file uploads |
| `file-search-refresh` | Pub/Sub | Refresh expiring files |

### Cloud Scheduler

| Job | Schedule | Purpose |
|-----|----------|---------|
| `file-search-refresh-scheduler` | Every 6 hours | Trigger file refresh |

## Security

### Authentication
- All API endpoints require `user_id` for authorization
- Files are isolated per user via Firestore queries
- No cross-user file access is possible

### Secrets Management
- Gemini API key stored in Secret Manager
- Mounted as environment variable in Cloud Functions

### Data Privacy
- Files stored in user-specific GCS paths
- Metadata includes only references, not file content
- Firestore security rules enforce user isolation

## Monitoring

### Logging
- All operations logged with user_id context
- Cloud Function logs available in Cloud Logging
- Structured logging for easy querying

### Metrics to Track
- File upload success/failure rate
- Query latency
- File refresh success rate
- Expired file count

### Alerts
- File processing failures
- High refresh failure rate
- API error rate spikes

## Costs

### Gemini API
- Files API: Per-file storage charges
- Model API: Per-token charges for queries
- File refresh incurs re-upload costs

### GCP Resources
- Cloud Functions: Per-invocation
- Pub/Sub: Per-message
- Firestore: Per-read/write/storage
- Cloud Storage: Per-GB storage

## Limitations

1. **File Expiry**: Gemini files expire after 48 hours
   - Mitigated by automatic refresh every 6 hours

2. **File Size**: Maximum 2GB per file
   - Large files should be split before upload

3. **Files per Query**: Maximum ~20 files per model context
   - Large collections should be pre-filtered

4. **Regional Availability**: Some regions may have limited support
   - Currently deployed in `us-central1`

