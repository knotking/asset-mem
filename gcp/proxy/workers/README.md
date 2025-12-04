# Workers Documentation

## Overview

The workers directory contains Cloud Functions (Gen2) that process asynchronous background tasks triggered by Pub/Sub messages. The primary worker (`pubsub_to_user_docs`) handles the import of user-uploaded files into the Vertex AI RAG Corpus for retrieval-augmented generation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              GCP Proxy API (Cloud Run)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  File Upload Endpoint (/rag-file-upload)            │  │
│  │  - Receives file uploads from clients                 │  │
│  │  - Uploads files to Google Cloud Storage             │  │
│  │  - Publishes message to user-upload-topic           │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          │ Pub/Sub Message
                          │ {gcs_urls, user_id, user_query, source}
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│     Cloud Function: pubsub_to_user_docs                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Receives Pub/Sub message                        │  │
│  │  2. Separates documents from media files            │  │
│  │  3. Imports documents to RAG Corpus                 │  │
│  │     - Documents: Default LLM parser                 │  │
│  │     - Media: Custom parsing prompt                  │  │
│  │  4. Publishes results to user-upload-result-topic  │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          │ Pub/Sub Result Message
                          │ {success, result, error, ...}
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         GCP Proxy API (Background Listener)                │
│  - Listens to user-upload-result-subscription             │
│  - Processes completion events                            │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
workers/
├── function/
│   ├── main.py              # Cloud Function entry point and core logic
│   ├── prompts.py           # Custom parsing prompts for media files
│   └── requirements.txt     # Python dependencies
├── tests/
│   ├── test_main.py         # Unit tests with mocks
│   └── integration_test.py  # Integration tests with real GCP services
└── README.md                # This file
```

## Core Components

### 1. Main Function (`function/main.py`)

#### `pubsub_to_user_docs(request, context)`

**Entry Point:** Cloud Function (Gen2) entry point triggered by Pub/Sub messages.

**Responsibilities:**
- Decodes base64-encoded Pub/Sub message payload
- Validates required fields (`user_id`, `gcs_urls`)
- Calls `import_to_rag_corpus()` to process files
- Publishes results to `user-upload-result-topic`
- Handles errors and logs processing status

**Input Payload:**
```json
{
  "gcs_urls": ["gs://bucket/path/file1.pdf", "gs://bucket/path/image1.jpg"],
  "user_id": "user123",
  "user_query": "Help me analyze these documents",
  "source": "rag-file-upload"
}
```

**Output (Published to Result Topic):**
```json
{
  "gcs_urls": ["gs://bucket/path/file1.pdf", "gs://bucket/path/image1.jpg"],
  "user_id": "user123",
  "user_query": "Help me analyze these documents",
  "result": {
    "document_import_result": {...},
    "media_import_result": {...}
  },
  "timestamp": "2024-01-01T12:00:00Z",
  "success": true,
  "error": "",
  "source": "rag-file-upload"
}
```

#### `import_to_rag_corpus(gcs_urls, user_id)`

**Purpose:** Imports files from Google Cloud Storage into the Vertex AI RAG Corpus.

**Processing Logic:**
1. **File Classification:** Separates files into two categories:
   - **Documents:** Text-based files (PDF, DOCX, TXT, etc.)
   - **Media:** Image, audio, or video files

2. **Document Import:**
   - Uses default LLM parser (`gemini-2.5-flash`)
   - Standard document parsing and chunking
   - Stores import results in GCS at: `gs://{BUCKET}/uploads/{user_id}/import-results/{timestamp}-documents.ndjson`

3. **Media Import:**
   - Uses custom parsing prompt from `prompts.py`
   - Specialized analysis for images, audio, and video
   - Extracts metadata, model numbers, serial numbers, brands
   - Describes issues/problems in images
   - Stores import results in GCS at: `gs://{BUCKET}/uploads/{user_id}/import-results/{timestamp}-media.ndjson`

**Returns:**
- `(True, result_dict)` on success
- `(False, error_message)` on failure

**Key Features:**
- **Parallel Processing:** Documents and media are processed separately but can be imported concurrently
- **Result Persistence:** Import results are saved to GCS for audit and debugging
- **Error Handling:** Catches exceptions and returns error information

#### `is_media_mime_type(mime_type) -> bool`

**Purpose:** Determines if a MIME type represents a media file (image, audio, or video).

**Logic:**
- Returns `True` if MIME type starts with `image/`, `audio/`, or `video/`
- Returns `False` otherwise (including `None`)

#### `serialize_import_result(result)`

**Purpose:** Converts `ImportRagFilesResponse` objects to serializable dictionaries for JSON encoding.

**Handles:**
- Objects with `to_dict()` method
- `None` values (returns empty dict)
- Fallback string conversion for other types

### 2. Prompts (`function/prompts.py`)

#### `parsing_prompt_media() -> str`

**Purpose:** Returns a custom parsing prompt for media files (images, audio, video).

**Prompt Characteristics:**
- Instructs the LLM to analyze documents/images at GCS URLs
- Requests structured information:
  - Summary of content
  - Model numbers, serial numbers, brands
  - Problem descriptions (e.g., "leak under sink", "cracked screen")
- Ensures factual, content-based analysis
- Explicitly prohibits JSON responses (returns natural language paragraph)

**Usage:** Applied to media files during RAG corpus import via `LlmParserConfig.custom_parsing_prompt`.

## Environment Variables

The Cloud Function requires the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `GCP_PROJECT_ID` | Google Cloud Project ID | `homegeekdemo` |
| `GCP_REGION` | GCP region for Vertex AI | `us-central1` |
| `GCS_BUCKET` | Cloud Storage bucket for user uploads | `homegeek-user-data` |
| `RAG_CORPUS` | Vertex AI RAG Corpus resource name | `projects/homegeekdemo/locations/us-central1/ragCorpora/6917529027641081856` |
| `USER_UPLOAD_RESULT_TOPIC` | Pub/Sub topic for publishing results | `projects/homegeekdemo/topics/user-upload-result-topic` |

## Dependencies

See `function/requirements.txt`:

- `google-cloud-aiplatform==1.107.0` - Vertex AI platform client
- `google-cloud-pubsub==2.31.1` - Pub/Sub client
- `vertexai==1.43.0` - Vertex AI SDK
- `requests==2.32.4` - HTTP client
- `google-genai` - Google Generative AI client

## Deployment

### Prerequisites

1. **GCP Project Setup:**
   - Enable Cloud Functions API
   - Enable Vertex AI API
   - Enable Pub/Sub API
   - Enable Cloud Storage API

2. **Service Account:**
   - Create or use existing service account
   - Grant required IAM roles:
     - `roles/aiplatform.user` - Access Vertex AI RAG Corpus
     - `roles/storage.objectViewer` - Read from GCS bucket
     - `roles/pubsub.publisher` - Publish to result topic

3. **Pub/Sub Topics:**
   - `user-upload-topic` - Trigger topic (must exist)
   - `user-upload-result-topic` - Result topic (must exist)

4. **RAG Corpus:**
   - Create Vertex AI RAG Corpus
   - Note the full resource name for `RAG_CORPUS` environment variable

### Deploy Command

```bash
gcloud functions deploy pubsub_to_user_docs \
  --gen2 \
  --max-instances 1 \
  --concurrency 1 \
  --region us-central1 \
  --runtime python313 \
  --trigger-topic user-upload-topic \
  --memory=512MB \
  --source function \
  --allow-unauthenticated \
  --service-account githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com \
  --entry-point pubsub_to_user_docs \
  --set-env-vars GCP_PROJECT_ID=homegeekdemo \
  --set-env-vars GCP_REGION=us-central1 \
  --set-env-vars GCS_BUCKET=homegeek-user-data \
  --set-env-vars USER_UPLOAD_RESULT_TOPIC=projects/homegeekdemo/topics/user-upload-result-topic \
  --set-env-vars RAG_CORPUS=projects/homegeekdemo/locations/us-central1/ragCorpora/6917529027641081856
```

### Deployment Configuration

- **Platform:** Cloud Functions Gen2
- **Runtime:** Python 3.13
- **Trigger:** Pub/Sub topic (`user-upload-topic`)
- **Concurrency:** 1 (sequential processing per instance)
- **Max Instances:** 1 (prevents duplicate processing)
- **Memory:** 512MB
- **Timeout:** Default (540 seconds)

### Required IAM Permissions

**Service Account Permissions:**
```bash
# Cloud Functions Developer
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/cloudfunctions.developer

# Vertex AI RAG Access
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/aiplatform.user

# Storage Access
gcloud storage buckets add-iam-policy-binding gs://BUCKET_NAME \
  --member="serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

**Vertex AI Service Account Permissions:**
```bash
# Allow Vertex AI service account to write to GCS
gcloud storage buckets add-iam-policy-binding gs://BUCKET_NAME \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-vertex-rag.iam.gserviceaccount.com" \
  --role="roles/storage.objectCreator"

# Allow Vertex AI service account to publish to Pub/Sub
gcloud pubsub topics add-iam-policy-binding projects/PROJECT_ID/topics/user-upload-topic \
  --member="serviceAccount:service-PROJECT_NUMBER@gcp-sa-aiplatform.iam.gserviceaccount.com" \
  --role="roles/pubsub.editor"
```

## Testing

### Unit Tests

Run unit tests with mocked dependencies:

```bash
cd workers/tests
python -m pytest test_main.py -v
```

**Test Coverage:**
- `test_pubsub_to_user_docs_success` - Tests successful processing flow
- `test_pubsub_to_user_docs_missing_fields` - Tests validation of required fields

### Integration Tests

Run integration tests with real GCP services:

```bash
cd workers/tests
python -m pytest integration_test.py -v
```

**Prerequisites:**
- Set environment variables (see `integration_test.py`)
- Valid GCS bucket with test files
- Valid RAG Corpus
- Valid Pub/Sub topics

**Note:** Integration tests make real API calls and may incur costs.

## Error Handling

### Validation Errors

- **Missing `user_id` or `gcs_urls`:** Function logs warning and returns early (no Pub/Sub message published)
- **Invalid payload format:** Base64 decode errors are caught and logged

### Import Errors

- **RAG Corpus Import Failures:** Caught in `import_to_rag_corpus()`, returns `(False, error_message)`
- **Result Publishing Failures:** Caught and logged, but don't prevent function completion

### Error Response Format

When `success: false`, the result topic message includes:
```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "result": "Error string or empty"
}
```

## Monitoring & Logging

### Cloud Logging

The function uses Python's `logging` module with INFO level. Key log points:

- **Function Entry:** Payload received and decoded
- **File Classification:** Documents vs media separation
- **Import Results:** Success/failure of RAG corpus imports
- **Pub/Sub Publishing:** Result message publication status
- **Errors:** Full exception stack traces

### Log Queries

View logs in Cloud Console or via `gcloud`:

```bash
gcloud functions logs read pubsub_to_user_docs --gen2 --region us-central1 --limit 50
```

### Metrics

Monitor via Cloud Monitoring:
- Function invocations
- Execution time
- Error rate
- Pub/Sub message processing lag

## Integration with Proxy API

### Trigger Flow

1. **Client Upload:** Client calls `/rag-file-upload` endpoint
2. **API Processing:** Proxy API uploads files to GCS
3. **Pub/Sub Publish:** API publishes message to `user-upload-topic`
4. **Worker Trigger:** Cloud Function automatically triggered
5. **RAG Import:** Worker imports files to RAG Corpus
6. **Result Publish:** Worker publishes results to `user-upload-result-topic`
7. **API Listener:** Proxy API background thread processes results

### Message Flow

```
API → user-upload-topic → Worker → user-upload-result-topic → API Listener
```

## Troubleshooting

### Common Issues

1. **Function Not Triggering:**
   - Verify Pub/Sub topic exists and messages are being published
   - Check function trigger configuration
   - Verify service account has `pubsub.subscriber` role

2. **RAG Import Failures:**
   - Verify RAG Corpus resource name is correct
   - Check service account has `aiplatform.user` role
   - Verify GCS bucket permissions for Vertex AI service account
   - Check file URLs are accessible

3. **Result Publishing Failures:**
   - Verify `USER_UPLOAD_RESULT_TOPIC` environment variable is set correctly
   - Check service account has `pubsub.publisher` role
   - Verify topic exists

4. **Memory/Timeout Issues:**
   - Increase memory allocation if processing large files
   - Consider increasing timeout for large batches
   - Monitor function execution time in logs

### Debugging

1. **Check Function Logs:**
   ```bash
   gcloud functions logs read pubsub_to_user_docs --gen2 --region us-central1
   ```

2. **Test Pub/Sub Message:**
   ```bash
   gcloud pubsub topics publish user-upload-topic --message '{"gcs_urls":["gs://bucket/file.pdf"],"user_id":"test","user_query":"test"}'
   ```

3. **Verify Environment Variables:**
   ```bash
   gcloud functions describe pubsub_to_user_docs --gen2 --region us-central1 --format="value(serviceConfig.environmentVariables)"
   ```

## Related Documentation

- [GCP Proxy Architecture](../docs/ARCHITECTURE.md) - Overall system architecture
- [GCP Proxy README](../README.md) - Main proxy service documentation
- [API Documentation](../docs/README.md) - API endpoint documentation

## Future Enhancements

Potential improvements:

1. **Batch Processing:** Process multiple files in parallel
2. **Retry Logic:** Automatic retries for transient failures
3. **Progress Updates:** Intermediate progress messages during long imports
4. **File Validation:** Pre-import validation of file types and sizes
5. **Cost Optimization:** Batch imports to reduce API calls
6. **Monitoring:** Cloud Monitoring dashboards for worker metrics
7. **Dead Letter Queue:** Handle failed messages separately
