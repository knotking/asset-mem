# Workers Documentation

## Overview

The workers directory contains Cloud Functions (Gen2) that process asynchronous background tasks triggered by Pub/Sub messages. The workers include:

- `pubsub_to_user_docs`: Handles the import of user-uploaded files into the Vertex AI RAG Corpus for retrieval-augmented generation.
- `pubsub_checkpoint_analysis`: Analyzes checkpoint images using Gemini AI and updates Firestore with analysis results.

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
│   ├── main.py              # Cloud Function entry points
│   ├── rag_service.py       # RAG corpus import logic (RagService class)
│   ├── checkpoint_service.py # Checkpoint image analysis logic
│   ├── config.py            # Configuration and environment variables
│   ├── utils.py             # Helper functions (parsing, serialization)
│   ├── exceptions.py        # Custom exceptions
│   ├── prompts.py           # Custom parsing prompts for media files
│   └── requirements.txt     # Python dependencies
├── tests/
│   ├── test_main.py         # Unit tests with mocks
│   └── integration_test.py  # Integration tests with real GCP services
└── README.md                # This file
```

## Core Components

### 1. Main Functions (`function/main.py`)

#### `pubsub_to_user_docs(request, context)`

**Entry Point:** Cloud Function (Gen2) entry point triggered by Pub/Sub messages on `user-upload-topic`.

**Responsibilities:**

- Parses the Pub/Sub message using `utils.parse_pubsub_message`.
- Instantiates `RagService`.
- Calls `rag_service.import_files()` to process files.
- Publishes results to `user-upload-result-topic`.
- Handles errors (`WorkerError`, `ConfigurationError`, `RagImportError`) and logs processing status.

#### `pubsub_checkpoint_analysis(request, context)`

**Entry Point:** Cloud Function (Gen2) entry point triggered by Pub/Sub messages on `checkpoint-analysis-topic`.

**Responsibilities:**

- Parses the Pub/Sub message to extract checkpoint analysis request.
- Calls `checkpoint_service.analyze_checkpoint_image()` to analyze the image using Gemini AI.
- Updates Firestore checkpoint document with analysis results.
- Sets `analysisStatus` to `completed` on success or `failed` on error.
- Handles errors and logs processing status.

### 2. RAG Service (`function/rag_service.py`)

#### `RagService` Class

**Purpose:** Encapsulates the logic for importing files into the Vertex AI RAG Corpus.

**Key Methods:**

- `__init__`: Validates configuration and initializes Vertex AI.
- `import_files(gcs_urls, user_id)`: Orchestrates the import process.
- `_classify_files(gcs_urls)`: Separates files into documents and media.
- `_import_documents(...)`: Imports text-based documents.
- `_import_media(...)`: Imports media files using custom prompts.

### 3. Checkpoint Service (`function/checkpoint_service.py`)

#### `analyze_checkpoint_image(image_url, content_type, location)`

**Purpose:** Analyzes a checkpoint image using Google Gemini AI.

**Parameters:**

- `image_url`: GCS URI of the image (gs://bucket/path)
- `content_type`: MIME type of the image
- `location`: Optional location description

**Returns:**
Dictionary with analysis results:

```python
{
    "summary": str,
    "conditions": List[str],
    "detectedItems": List[str],
    "issues": List[str]
}
```

**Key Features:**

- Uses Gemini 2.5 Flash model for fast analysis
- Structured JSON response with schema validation
- Detects property conditions, items, and issues

### 4. Configuration (`function/config.py`)

**Purpose:** Centralizes environment variable management and validation.

**Variables:**

- `RAG_CORPUS`: Vertex AI RAG Corpus resource name.
- `USER_UPLOAD_RESULT_TOPIC`: Pub/Sub topic for results.
- `PROJECT_ID`: GCP Project ID.
- `GCS_BUCKET`: GCS Bucket name.
- `USER_UPLOAD_FOLDER`: Folder prefix for uploads.

### 5. Utilities (`function/utils.py`)

**Purpose:** Provides helper functions for common tasks.

- `parse_pubsub_message(request)`: Extracts and decodes Pub/Sub payloads.
- `serialize_import_result(result)`: Converts API responses to dicts.
- `is_media_mime_type(mime_type)`: Identifies media files.
- `parse_location_from_corpus(corpus_path)`: Extracts location from corpus resource name.

### 6. Exceptions (`function/exceptions.py`)

**Purpose:** Defines custom exceptions for better error handling.

- `WorkerError`: Base exception.
- `ConfigurationError`: Raised for missing/invalid config.
- `RagImportError`: Raised when RAG import fails.

## Environment Variables

The Cloud Function requires the following environment variables:

| Variable                   | Description                           | Example                                                                      | Required For        |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- | ------------------- |
| `GCP_PROJECT_ID`           | Google Cloud Project ID               | `homegeekdemo`                                                               | All workers         |
| `GCP_REGION`               | GCP region for Vertex AI              | `us-central1`                                                                | All workers         |
| `GCP_LOCATION`             | GCP location for Vertex AI            | `us-central1`                                                                | Checkpoint analysis |
| `GCS_BUCKET`               | Cloud Storage bucket for user uploads | `homegeek-user-data`                                                         | RAG import          |
| `RAG_CORPUS`               | Vertex AI RAG Corpus resource name    | `projects/homegeekdemo/locations/us-central1/ragCorpora/6917529027641081856` | RAG import          |
| `USER_UPLOAD_RESULT_TOPIC` | Pub/Sub topic for publishing results  | `projects/homegeekdemo/topics/user-upload-result-topic`                      | RAG import          |
| `USER_UPLOAD_FOLDER`       | Folder prefix for uploads             | `uploads-prod`                                                               | RAG import          |

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
     - `roles/aiplatform.user` - Access Vertex AI RAG Corpus and Gemini
     - `roles/storage.objectViewer` - Read from GCS bucket
     - `roles/pubsub.publisher` - Publish to result topics
     - `roles/firestore.user` - Update Firestore documents (for checkpoint analysis)

### Deploy Commands

#### Deploy RAG Import Worker

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

#### Deploy Checkpoint Analysis Worker

```bash
gcloud functions deploy pubsub_checkpoint_analysis \
  --gen2 \
  --max-instances 10 \
  --concurrency 1 \
  --region us-central1 \
  --runtime python313 \
  --trigger-topic checkpoint-analysis-topic \
  --memory=512MB \
  --source function \
  --allow-unauthenticated \
  --service-account githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com \
  --entry-point pubsub_checkpoint_analysis \
  --set-env-vars GCP_PROJECT_ID=homegeekdemo \
  --set-env-vars GCP_LOCATION=us-central1
```

**Note:** The checkpoint analysis worker requires:

- Pub/Sub topic `checkpoint-analysis-topic` to be created
- Firebase Admin SDK credentials (uses default GCP service account)
- Firestore write permissions for checkpoint documents

## Testing

### Unit Tests

Run unit tests with mocked dependencies:

```bash
cd workers/tests
python -m pytest test_main.py -v
```

### Integration Tests

Run integration tests with real GCP services:

```bash
cd workers/tests
python -m pytest integration_test.py -v
```

## Error Handling

Errors are now categorized into specific exceptions:

- **ConfigurationError**: Missing environment variables.
- **RagImportError**: Failures during RAG corpus import.
- **WorkerError**: General worker failures.

All errors are logged and, where appropriate, reported back via the result topic with `success: false`.
