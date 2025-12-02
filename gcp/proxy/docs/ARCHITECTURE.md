# GCP Proxy Architecture

## Overview

The GCP Proxy is a FastAPI-based microservice that acts as a unified API gateway and integration layer between client applications (Firebase web/mobile apps, Telegram bots) and Google Cloud Platform services, primarily Vertex AI Reasoning Engine. It provides RESTful endpoints for AI agent interactions, document processing, file uploads, and session management.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
├──────────────────────┬──────────────────────────────────────────┤
│  Firebase Web/Mobile │         Telegram Bot                     │
│  Applications        │         (via Webhook)                    │
└──────────┬───────────┴──────────────┬───────────────────────────┘
           │                          │
           │ HTTPS                    │ HTTPS
           │                          │
           ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GCP Proxy API (Cloud Run)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              FastAPI Application (main.py)               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │ Telegram API │  │ Firebase API │  │ Service      │  │  │
│  │  │ Handler      │  │ Handler      │  │ Broker API   │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │  │
│  │         │                 │                  │          │  │
│  │  ┌──────┴─────────────────┴──────────────────┴──────┐   │  │
│  │  │         Vertex AI Client (vertex_client.py)     │   │  │
│  │  │  - Session Management                            │   │  │
│  │  │  - Agent Query Streaming                        │   │  │
│  │  │  - Response Parsing                             │   │  │
│  │  └──────────────────────┬──────────────────────────┘   │  │
│  │                         │                               │  │
│  │  ┌──────────────────────┴──────────────────────────┐    │  │
│  │  │      Document Analysis (document_analysis.py) │    │  │
│  │  │  - Gemini 2.5 Flash Integration                │    │  │
│  │  │  - Document Type Classification                │    │  │
│  │  │  - Entity Extraction                           │    │  │
│  │  └────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Pub/Sub Listener (Background Thread)              │  │
│  │  - Listens to user-upload-result-subscription            │  │
│  │  - Processes upload completion events                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ Pub/Sub Messages
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Background Workers (Cloud Functions)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │     pubsub_to_user_docs (workers/function/main.py)       │  │
│  │  - Triggered by user-upload-topic                        │  │
│  │  - Imports files to Vertex AI RAG Corpus                 │  │
│  │  - Publishes results to user-upload-result-topic         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                       │
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GCP Services Layer                           │
├──────────────────┬──────────────────┬───────────────────────────┤
│ Vertex AI        │ Cloud Storage    │ Pub/Sub                   │
│ - Reasoning      │ - User Documents │ - user-upload-topic       │
│   Engine         │ - Uploads        │ - user-upload-result-topic │
│ - RAG Corpus     │                  │                            │
│ - Gemini 2.5     │                  │                            │
│   Flash          │                  │                            │
└──────────────────┴──────────────────┴───────────────────────────┘
```

## Core Components

### 1. API Service (`api/`)

The main FastAPI application deployed on Cloud Run that handles all HTTP requests.

#### 1.1 Main Application (`main.py`)

**Responsibilities:**
- FastAPI app initialization and middleware configuration
- Route registration and request routing
- CORS configuration
- Health check endpoint
- Background Pub/Sub listener thread initialization

**Key Endpoints:**
- `GET /health` - Health check
- `POST /{TELEGRAM_WEBHOOK_SECRET}` - Telegram webhook handler
- `POST /{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query` - Firebase non-streaming agent query
- `POST /{FIREBASE_WEBHOOK_SECRET}/firebase-agent-stream` - Firebase streaming agent query
- `POST /{FIREBASE_WEBHOOK_SECRET}/agent-session` - Create agent session
- `DELETE /{FIREBASE_WEBHOOK_SECRET}/agent-session` - Delete agent session
- `POST /{FIREBASE_WEBHOOK_SECRET}/rag-file-upload` - File upload handler
- `POST /{FIREBASE_WEBHOOK_SECRET}/extract-doc-info` - Document analysis endpoint
- `POST /{FIREBASE_WEBHOOK_SECRET}/service-broker-agent` - Service broker webhook

#### 1.2 Vertex AI Client (`vertex_client.py`)

**Responsibilities:**
- Vertex AI Reasoning Engine initialization and connection
- Session lifecycle management (create, list, delete)
- Agent query streaming with response parsing
- Event data extraction and formatting
- Agent name prettification
- Document publishing to Pub/Sub for RAG processing

**Key Functions:**
- `get_or_create_reasoning_engine_session()` - Session management
- `stream_agent_answers()` - Stream agent responses
- `extract_event_data_with_transfer_target()` - Parse agent events
- `publish_doc_to_secure_store()` - Publish documents to Pub/Sub

#### 1.3 Telegram API Handler (`telegram_api.py`)

**Responsibilities:**
- Telegram bot initialization using aiogram
- Message handling (text, attachments)
- File upload to Google Cloud Storage
- Response formatting for Telegram MarkdownV2
- JSON to Markdown conversion
- Link formatting (Google Maps, YouTube)
- Dual-format response extraction (Markdown + JSON)

**Key Features:**
- Attachment handling (documents, photos, audio, video)
- File size validation (10MB limit for RAG)
- Message deduplication
- Streaming responses to users
- Markdown formatting with proper escaping

#### 1.4 Firebase API Handler (`firebase_api.py`)

**Responsibilities:**
- Firebase webhook request handling
- User authentication validation
- Agent query processing (streaming and non-streaming)
- File upload coordination
- Response formatting for Firebase clients

**Key Functions:**
- `handle_firebase_agent_query()` - Non-streaming agent queries
- `stream_firebase_agent_answers()` - Streaming agent responses
- `handle_firebase_file_upload()` - File upload handler

#### 1.5 Document Analysis (`document_analysis.py`)

**Responsibilities:**
- Document type classification using Gemini 2.5 Flash
- Property address extraction and normalization
- Key entity extraction (policy numbers, dates, amounts)
- Document summarization
- Structured JSON response generation

**Document Types Supported:**
- DEED
- INSURANCE_POLICY
- UTILITY_BILL
- INSPECTION_REPORT
- MORTGAGE_STATEMENT
- OTHER

#### 1.6 Service Broker API (`service_broker_api.py`)

**Responsibilities:**
- Service broker agent webhook handling
- Asynchronous payload processing
- Background task scheduling

#### 1.7 GCP Utilities (`gcp_utils.py`)

**Responsibilities:**
- Google Cloud Storage file upload
- Pub/Sub event publishing
- Pub/Sub subscription listening
- User file listing from GCS

#### 1.8 Data Models (`models.py`)

**Key Models:**
- `AgentRequest` - Request payload for agent queries
- `ExtractDocInfoRequest` - Document analysis request
- `ExtractDocInfoResponse` - Document analysis response
- `DocumentType` - Enum for document types
- `KeyEntity` - Extracted entity model

### 2. Background Workers (`workers/`)

Cloud Functions that process asynchronous tasks triggered by Pub/Sub.

#### 2.1 User Upload Worker (`workers/function/main.py`)

**Responsibilities:**
- Triggered by `user-upload-topic` Pub/Sub messages
- Imports uploaded files to Vertex AI RAG Corpus
- Handles document and media files separately
- Uses custom parsing prompts for media files
- Publishes results to `user-upload-result-topic`

**Processing Flow:**
1. Receive Pub/Sub message with GCS URLs
2. Separate documents from media files
3. Import documents to RAG corpus with default parser
4. Import media files with custom parsing prompt
5. Publish import results to result topic

**Key Functions:**
- `pubsub_to_user_docs()` - Cloud Function entry point
- `import_to_rag_corpus()` - RAG corpus import logic
- `is_media_mime_type()` - Media type detection

## Data Flow

### Agent Query Flow

```
1. Client Request
   └─> POST /firebase-agent-stream
       └─> Request: {user_id, user_query, context_doc_uris, ...}

2. Firebase API Handler
   └─> Validates request
       └─> Calls stream_agent_answers()

3. Vertex AI Client
   └─> Gets/creates session
       └─> Builds payload with optional agents
           └─> Streams query to Reasoning Engine

4. Reasoning Engine
   └─> Processes query with agents
       └─> Returns streaming events

5. Response Processing
   └─> Parses events (text, function calls, transfers)
       └─> Formats for client (Markdown, JSON conversion)
           └─> Streams to client via SSE

6. Client receives streaming response
```

### File Upload Flow

```
1. Client Upload
   └─> POST /rag-file-upload
       └─> Request: {user_id, context_doc_uris, user_query}

2. Firebase API Handler
   └─> Calls publish_doc_to_secure_store()

3. Pub/Sub Publishing
   └─> Publishes to user-upload-topic
       └─> Payload: {gcs_urls, user_id, user_query, source}

4. Cloud Function Trigger
   └─> pubsub_to_user_docs() triggered
       └─> Imports files to RAG Corpus
           └─> Publishes result to user-upload-result-topic

5. Proxy Listener
   └─> Background thread listens to result topic
       └─> Processes completion events
```

### Telegram Message Flow

```
1. Telegram Webhook
   └─> POST /{TELEGRAM_WEBHOOK_SECRET}
       └─> Telegram Update object

2. aiogram Dispatcher
   └─> Routes to appropriate handler
       ├─> Text messages → handle_text_message()
       └─> Attachments → handle_attachment()

3. Attachment Processing
   └─> Downloads from Telegram
       └─> Uploads to GCS
           └─> Creates AgentRequest
               └─> Streams agent response

4. Response Formatting
   └─> Converts JSON to Markdown
       └─> Formats links (Maps, YouTube)
           └─> Escapes for Telegram MarkdownV2
               └─> Sends to user
```

## Key Technologies

### Core Framework
- **FastAPI** - Modern Python web framework for API endpoints
- **aiogram** - Asynchronous Telegram Bot framework
- **Pydantic** - Data validation and settings management

### Google Cloud Platform
- **Cloud Run** - Serverless container platform for API service
- **Cloud Functions (Gen2)** - Serverless functions for background workers
- **Vertex AI Reasoning Engine** - AI agent orchestration platform
- **Vertex AI RAG** - Retrieval-Augmented Generation corpus
- **Gemini 2.5 Flash** - Multimodal AI model for document analysis
- **Cloud Storage** - Object storage for user uploads
- **Pub/Sub** - Asynchronous messaging for event-driven processing

### Supporting Libraries
- **telegramify_markdown** - Telegram MarkdownV2 formatting
- **google-cloud-*** - GCP client libraries
- **aiohttp** - Async HTTP client

## Configuration

### Environment Variables

**API Service (Cloud Run):**
- `GCP_PROJECT_ID` - GCP project ID
- `GCP_REGION` - GCP region (e.g., us-central1)
- `REASONING_ENGINE_ID` - Vertex AI Reasoning Engine ID
- `TELEGRAM_BOT_TOKEN` - Telegram bot API token
- `TELEGRAM_WEBHOOK_SECRET` - Secret for Telegram webhook URL
- `FIREBASE_WEBHOOK_SECRET` - Secret for Firebase webhook URLs
- `USER_UPLOAD_TOPIC` - Pub/Sub topic for file uploads
- `USER_UPLOAD_RESULT_SUBSCRIPTION` - Pub/Sub subscription for upload results
- `GCS_BUCKET` - Google Cloud Storage bucket name

**Worker Function:**
- `GCP_PROJECT_ID` - GCP project ID
- `GCP_REGION` - GCP region
- `GCS_BUCKET` - Storage bucket name
- `RAG_CORPUS` - Vertex AI RAG Corpus resource name
- `USER_UPLOAD_RESULT_TOPIC` - Result topic for publishing

## Deployment Architecture

### API Service Deployment

**Platform:** Google Cloud Run
- **Runtime:** Python 3.x
- **Scaling:** Automatic (min instances: 0, max instances: 100)
- **Concurrency:** Configurable per instance
- **Memory:** Configurable (default: 512MB-2GB)
- **Timeout:** 300 seconds (5 minutes)

**Deployment Steps:**
1. Build Docker image from `api/Dockerfile`
2. Push to Artifact Registry
3. Deploy to Cloud Run with environment variables
4. Configure webhook URLs for Telegram

### Worker Function Deployment

**Platform:** Cloud Functions (Gen2)
- **Runtime:** Python 3.13
- **Trigger:** Pub/Sub topic (`user-upload-topic`)
- **Concurrency:** 1 (sequential processing)
- **Memory:** 512MB
- **Max Instances:** 1 (to prevent duplicate processing)

## Security

### Authentication & Authorization
- **Webhook Secrets** - All endpoints use secret-based authentication via URL path
- **Service Account** - Cloud Run and Functions use service accounts with minimal required permissions
- **IAM Roles** - Fine-grained IAM policies for GCP resource access

### Data Security
- **Encryption in Transit** - All communications use HTTPS/TLS
- **Encryption at Rest** - GCS buckets use default encryption
- **User Isolation** - Files stored per user ID in separate GCS paths

## Scalability & Performance

### Horizontal Scaling
- Cloud Run automatically scales based on request volume
- Multiple instances handle concurrent requests
- Stateless design enables easy scaling

### Streaming Responses
- Server-Sent Events (SSE) for real-time agent responses
- Reduces perceived latency for long-running queries
- Enables progressive response rendering

### Background Processing
- File uploads processed asynchronously via Pub/Sub
- Prevents API timeouts for large file operations
- Decouples upload from processing

## Monitoring & Observability

### Logging
- Structured logging using Python `logging` module
- Cloud Logging integration for centralized logs
- Log levels: INFO, WARNING, ERROR

### Error Handling
- Graceful error handling with user-friendly messages
- Fallback responses for service failures
- Error logging with stack traces

### Health Checks
- `/health` endpoint for service health monitoring
- Validates Reasoning Engine connectivity
- Used by Cloud Run for health checks

## Future Enhancements

### Potential Improvements
1. **Caching Layer** - Redis/Memcached for session and response caching
2. **Rate Limiting** - Per-user rate limiting to prevent abuse
3. **Metrics & Tracing** - Cloud Monitoring and Cloud Trace integration
4. **WebSocket Support** - Real-time bidirectional communication
5. **Batch Processing** - Batch document analysis for multiple files
6. **Retry Logic** - Automatic retries for transient failures
7. **Circuit Breakers** - Prevent cascading failures

## Related Documentation

- [Main README](../README.md) - Deployment and setup instructions
- [API Documentation](./README.md) - Feature-specific API docs
- [Adding Functions](../api/ADDING_FUNCTIONS.md) - Guide for adding new endpoints
- [Workers README](../workers/README.md) - Background workers documentation

