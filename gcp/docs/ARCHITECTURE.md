# GCP Architecture

## Overview

The GCP directory contains a comprehensive AI-powered property care system built on Google Cloud Platform. It consists of multi-agent AI systems, API gateway services, shared libraries, and infrastructure-as-code components that work together to provide checkpoint-aware property care, document retrieval, service recommendations, and knowledge retrieval capabilities.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Client Applications                             │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│  Firebase Web/Mobile  │   Telegram Bot        │   Service Broker         │
│  Applications         │   (via Webhook)       │   (External)             │
└──────────┬────────────┴──────────┬───────────┴──────────┬───────────────┘
           │                       │                       │
           │ HTTPS                 │ HTTPS                 │ HTTPS
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    GCP Proxy API (Cloud Run)                            │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │              FastAPI Application                                   │ │
│  │  - Telegram Webhook Handler                                        │ │
│  │  - Firebase API Endpoints                                          │ │
│  │  - Service Broker Webhook                                          │ │
│  │  - Document Analysis (Gemini 2.5 Flash)                            │ │
│  │  - Vertex AI Client Integration                                    │ │
│  │  - Pub/Sub Event Listener                                         │ │
│  └──────────────────────┬─────────────────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────────────────┘
                          │
                          │ HTTP/Streaming
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Vertex AI Reasoning Engine                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Property Agent (Root Orchestrator)            │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │              DocuLink Agent (doculink_agent)               │  │  │
│  │  │  Tools: checkpoint_agent | user_docs | knowledge_base      │  │  │
│  │  │  Sub-agent: checkpoint_progress_agent (optional analysis)  │  │  │
│  │  │    → parallel: coverage | diy | service | cost → synthesis │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          │ Tool Calls
                          │
        ┌─────────────────┼─────────────────┬─────────────────┐
        │                 │                 │                 │
        ▼                 ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Vertex AI    │  │ External APIs │  │ Google Cloud │  │ Pub/Sub      │
│ RAG Corpus   │  │ - SerpAPI     │  │ Storage      │  │ Topics       │
│ - Knowledge  │  │ - YouTube     │  │ - User Docs  │  │ - Uploads    │
│   Base       │  │ - Google Search│ │ - Results    │  │ - Results    │
│ - User Docs  │  │ - Google Maps │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                          │
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Background Workers (Cloud Functions)                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  1. pubsub_to_user_docs                                          │  │
│  │     - Triggered by user-upload-topic                             │  │
│  │     - Imports files to RAG Corpus                                │  │
│  │                                                                  │  │
│  │  2. pubsub_checkpoint_analysis                                   │  │
│  │     - Triggered by checkpoint-analysis-topic                     │  │
│  │     - Analyzes images with Gemini Vision                         │  │
│  │     - Performs room detection and comparison                     │  │
│  │                                                                  │  │
│  │  3. pubsub_checkpoint_metrics                                    │  │
│  │     - Triggered by checkpoint-metrics-topic                      │  │
│  │     - Aggregates property condition stats                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Agents (`gcp/agents/homecare/`)

A sophisticated multi-agent AI system deployed on Vertex AI Reasoning Engine that orchestrates checkpoint retrieval, optional checkpoint analysis, document retrieval, and service recommendations.

#### 1.1 Property Agent (Root Orchestrator)

**Location:** `gcp/agents/homecare/property_agent/`

**Purpose:** Main orchestrator that routes user requests to specialized sub-agents based on input parameters.

**Key Responsibilities:**
- Analyzes input schema (`user_query`, `context_doc_uris`, `checkpoint_ids`, `property_address`, `primary_agent`, …)
- Delegates property queries to DocuLink (`doculink_agent`) for checkpoint, user-docs, and knowledge-base paths
- Handles casual queries directly without delegation
- Returns sub-agent responses verbatim without modification

**Routing Logic:**
1. **`primary_agent` or `checkpoint_ids`:** → DocuLink (checkpoint or docs path)
2. **Other property queries:** → DocuLink (tool selection among checkpoint / user docs / knowledge base)
3. **Casual Queries:** → Direct reply, no delegation

**Input Schema:**
```python
class DiagnosisInput(BaseModel):
    user_query: str
    context_doc_uris: Optional[List[str]]
    checkpoint_ids: Optional[List[str]]
    property_address: Optional[str]
    primary_agent: Optional[Literal["checkpoint", "docs"]]
    checkpoint_optional_agents: Optional[List[str]]  # ["coverage", "diy", "service", "cost"]
```

#### 1.2 DocuLink Agent

**Location:** `property_agent/agent.py` (`doculink_agent`)

**Purpose:** Single delegation target from the root agent for property queries — checkpoint retrieval, user-document RAG, knowledge-base RAG, and optional checkpoint analysis.

**Tools (ADK `AgentTool`):**

1. **Checkpoint Agent** (`checkpoint_agent/`)
   - Firestore vector search over property checkpoints
   - Requires `property_id` for semantic checkpoint queries
   - Honors `checkpoint_ids` when the user selects specific checkpoints
   - Passes `search_location` for geo-aware optional branches
   - Returns dual-format markdown + fenced JSON for rich UI rendering

2. **User Docs Agent** (`user_docs_agent/`)
   - Vertex AI RAG over the user upload corpus
   - Scoped by `context_doc_uris` when provided (includes chat attachments)
   - Tool: `ask_user_docs_retrieval`

3. **Knowledge Base Agent** (`knowledge_base_agent/`)
   - Vertex AI RAG over the shared reference corpus
   - Used when no user documents apply to the query

**Tool selection (priority):** See `property_agent/prompts.py` → `doculink_agent_system_instruction()` — `primary_agent`, non-empty `checkpoint_optional_agents`, `checkpoint_ids`, query intent, then `context_doc_uris`, else knowledge base.

**Optional checkpoint analysis:** When `checkpoint_optional_agents` is non-empty, DocuLink calls `checkpoint_agent` once for retrieval, then transfers to `checkpoint_progress_agent`, which runs Python-parallel branches (`coverage`, `diy`, `service`, `cost`) and a synthesis step. Output is progressive dual-format (markdown + ```json `analysis` object) for webapp/mapp.

**Branch modules (invoked from checkpoint analysis, not separate root routes):**

| Branch | Module | Role |
|--------|--------|------|
| Coverage | `coverage_agent/` | Warranty/insurance via user docs |
| DIY | `diy_agent/` + `orchestrator.py` | Parallel fetch + synthesis; YouTube/shopping |
| Service | `service_agent/` | SerpAPI local pros + optional Google Search |
| Cost | `cost_agent/` | AI + library cost estimates |
| Shopping | `shopping_agent/` | Product recommendations (used by DIY) |

**Fallback:** If retrieval returns nothing, DocuLink may answer from `user_query` with an explicit “no relevant information found” preface.

#### 1.4 Agent Tools and Integrations

**RAG Integration:**
- Vertex AI RAG Engine for document retrieval
- Separate corpora for knowledge base and user documents
- Citation support with URL formatting

**External API Integrations:**
- **SerpAPI**: Local business search
- **YouTube API**: Video tutorial search
- **Google Search**: General information retrieval
- **Google Maps**: Location-based services

**Multimodal / media (outside live agent triage):**
- Checkpoint photos/videos: analyzed asynchronously by the checkpoint-analysis Cloud Function (Gemini), not via a root-level triage agent
- Proxy `extract-doc-info`: Gemini document classification on upload
- Chat attachments: sent as `context_doc_uris` into DocuLink user-docs RAG

### 2. Proxy Service (`gcp/proxy/`)

FastAPI-based API gateway that provides unified access to the agent system from multiple client platforms.

#### 2.1 API Service (`proxy/api/`)

**Deployment:** Google Cloud Run

**Key Components:**

1. **Main Application** (`main.py`)
   - FastAPI app with CORS middleware
   - Route registration and request routing
   - Health check endpoint
   - Background Pub/Sub listener thread

2. **Telegram API Handler** (`telegram_api.py`)
   - aiogram-based Telegram bot integration
   - Message handling (text, attachments)
   - File upload to Google Cloud Storage
   - Markdown formatting for Telegram
   - JSON to Markdown conversion
   - Link formatting (Google Maps, YouTube)

3. **Firebase API Handler** (`firebase_api.py`)
   - Firebase webhook request handling
   - User authentication validation
   - Streaming and non-streaming agent queries
   - File upload coordination

4. **Vertex AI Client** (`vertex_client.py`)
   - Reasoning Engine session management
   - Agent query streaming
   - Response parsing and formatting
   - Event data extraction
   - Document publishing to Pub/Sub

5. **Document Analysis** (`document_analysis.py`)
   - Gemini 2.5 Flash integration
   - Document type classification
   - Property address extraction
   - Key entity extraction
   - Document summarization

6. **Service Broker API** (`service_broker_api.py`)
   - External service broker webhook handling
   - Asynchronous payload processing

**Key Endpoints:**
- `GET /health` - Health check
- `POST /{TELEGRAM_WEBHOOK_SECRET}` - Telegram webhook
- `POST /{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query` - Non-streaming query
- `POST /{FIREBASE_WEBHOOK_SECRET}/firebase-agent-stream` - Streaming query
- `POST /{FIREBASE_WEBHOOK_SECRET}/agent-session` - Create session
- `DELETE /{FIREBASE_WEBHOOK_SECRET}/agent-session` - Delete session
- `POST /{FIREBASE_WEBHOOK_SECRET}/rag-file-upload` - File upload
- `POST /{FIREBASE_WEBHOOK_SECRET}/extract-doc-info` - Document analysis
- `POST /{FIREBASE_WEBHOOK_SECRET}/service-broker-agent` - Service broker webhook

#### 2.2 Background Workers (`proxy/workers/`)

**Deployment:** Google Cloud Functions (Gen2)

**Worker 1: `pubsub_to_user_docs`**
- **Purpose:** Processes file uploads asynchronously by importing them to Vertex AI RAG Corpus.
- **Trigger:** `user-upload-topic` Pub/Sub messages.

**Worker 2: `pubsub_checkpoint_analysis`**
- **Purpose:** Analyzes property checkpoint images.
- **Trigger:** `checkpoint-analysis-topic` Pub/Sub messages.
- **Capabilities:**
  - Image analysis using Gemini 2.5 Flash
  - Room/Area detection
  - Condition assessment
  - Automatic comparison with previous checkpoints

**Worker 3: `pubsub_checkpoint_metrics`**
- **Purpose:** Aggregates property-level metrics based on checkpoint data.
- **Trigger:** `checkpoint-metrics-topic` Pub/Sub messages.
- **Outputs:** Condition scores, issue summaries, and deterioration trends.

### 3. Common Libraries (`gcp/common/`)

Shared Python libraries used across the GCP components.

#### 3.1 Pub/Sub Client (`common/pubsub/`)

**Purpose:** Comprehensive Google Cloud Pub/Sub integration module.

**Features:**
- Topic management (create, list, get, delete)
- Subscription management (create, list, get, delete, update)
- Message publishing (single and batch)
- Message pulling and acknowledgment
- Async/await support
- Metadata handling
- Configuration via environment variables or Secret Manager

**Key Classes:**
- `PubSubConfig`: Configuration management
- `PubSubClient`: Main client for Pub/Sub operations

#### 3.2 Storage Client (`common/storage/`)

**Purpose:** Google Cloud Storage integration.

**Features:**
- Bucket operations
- File upload/download
- Blob management
- Async support

#### 3.3 Gemini Integrations

Multiple specialized Gemini integration modules:

1. **Gemini File Search** (`gemini_file_search/`)
   - File-based search capabilities
   - Document indexing and retrieval

2. **Gemini Google Search** (`gemini_google_search/`)
   - Google Search integration via Gemini
   - Search result processing

3. **Gemini Maps Grounding** (`gemini_maps_grounding/`)
   - Google Maps integration
   - Location-based services

4. **Gemini URL Context** (`gemini_url_context/`)
   - URL content extraction
   - Web page analysis

5. **Gemini Robotics** (`gemini_robotics/`)
   - Robotics-specific Gemini capabilities

#### 3.4 Communication Platforms (`common/cpaas/`)

**Purpose:** Communication Platform as a Service integrations.

**Providers:**
- **Infobip** (`cpaas/infobip/`)
- **Twilio** (`cpaas/twilio/`)

**Features:**
- SMS/MMS sending
- Voice calls
- Multi-provider support
- Unified interface

#### 3.5 Conversational AI (`common/conv_ai/`)

**Purpose:** Conversational AI client integration.

**Features:**
- Chat interface
- Message handling
- Context management

### 4. Infrastructure (`gcp/terraform/`)

Infrastructure as Code using Terraform for managing GCP resources.

#### 4.1 Modules

1. **Cloud Function Module** (`modules/cloud-function/`)
   - Cloud Functions deployment
   - Environment variables
   - IAM permissions

2. **Cloud Run Module** (`modules/cloud-run/`)
   - Cloud Run service deployment
   - Container configuration
   - Scaling settings

3. **Pub/Sub Module** (`modules/pubsub/`)
   - Topic creation
   - Subscription management
   - IAM policies

4. **Storage Module** (`modules/storage/`)
   - GCS bucket creation
   - Lifecycle policies
   - IAM permissions

5. **IAM Module** (`modules/iam/`)
   - Service account creation
   - Role bindings
   - Custom roles

6. **Secrets Module** (`modules/secrets/`)
   - Secret Manager integration
   - Secret versioning

#### 4.2 Environments

- **Production** (`environments/prod/`)
- **Staging** (`environments/staging/`)

**Configuration:**
- Environment-specific variables
- Resource naming conventions
- Scaling configurations

## Data Flow

### Agent Query Flow

```
1. Client Request
   └─> POST /firebase-agent-stream
       └─> Request: {user_id, user_query, context_doc_uris, checkpoint_ids, primary_agent, ...}

2. Proxy API Handler
   └─> Validates request
       └─> Gets/creates Reasoning Engine session
           └─> Streams query to Property Agent

3. Property Agent (Root Orchestrator)
   └─> Delegates property queries to DocuLink Agent (or direct reply for casual queries)

4. DocuLink Agent
   └─> Selects tool: checkpoint_agent, ask_user_docs_agent, or ask_knowledge_base_agent
       └─> Optional checkpoint analysis (coverage, DIY, service, cost) when requested
           └─> Each branch calls tools (RAG, APIs, search)
               └─> Synthesis returns dual-format markdown + JSON for checkpoint flows

5. Response Assembly
   └─> Property Agent returns sub-agent response verbatim
       └─> Proxy formats for client
           └─> Streams via SSE to client
```

### File Upload Flow

```
1. Client Upload
   └─> POST /rag-file-upload
       └─> Request: {user_id, context_doc_uris, user_query}

2. Proxy API Handler
   └─> Publishes to user-upload-topic
       └─> Returns immediately (async processing)

3. Cloud Function Trigger
   └─> pubsub_to_user_docs() triggered
       └─> Separates documents from media
           ├─> Documents → RAG corpus (default parser)
           └─> Media → RAG corpus (custom prompt)
               └─> Publishes results to user-upload-result-topic

4. Proxy Listener
   └─> Background thread listens to result topic
       └─> Processes completion events
           └─> Can notify clients or update state
```

### Checkpoint Analysis Flow

```
1. Client Action
   └─> User creates checkpoint in Mobile App
       └─> Uploads image to Storage
           └─> POST /analyze-checkpoint

2. Proxy API Handler
   └─> Validates request
       └─> Publishes to checkpoint-analysis-topic
           └─> Returns 202 Accepted immediately

3. Analysis Worker (Cloud Function)
   └─> Triggered by Pub/Sub
       └─> Calls Gemini 2.5 Flash for analysis
           └─> Detects room type and assets
               └─> Performs comparison with previous checkpoint (if applicable)
                   └─> Writes results to Firestore

4. Metrics Worker (Cloud Function)
   └─> Triggered by analysis completion
       └─> Aggregates metrics for property
           └─> Updates property summary in Firestore

5. Real-time UI Update
   └─> Mobile App listens to Firestore document
       └─> UI updates automatically when analysis completes
```

### Telegram Message Flow

```
1. Telegram Webhook
   └─> POST /{TELEGRAM_WEBHOOK_SECRET}
       └─> Telegram Update object

2. aiogram Dispatcher
   └─> Routes to handler
       ├─> Text messages → handle_text_message()
       └─> Attachments → handle_attachment()

3. Attachment Processing
   └─> Downloads from Telegram
       └─> Uploads to GCS
           └─> Creates AgentRequest with context_doc_uris
               └─> Streams agent response

4. Response Formatting
   └─> Converts JSON to Markdown
       └─> Formats links (Maps, YouTube)
           └─> Escapes for Telegram MarkdownV2
               └─> Sends to user
```

## Key Technologies

### AI/ML
- **Vertex AI Reasoning Engine** - Agent orchestration platform
- **Vertex AI RAG** - Retrieval-Augmented Generation corpus
- **Gemini 2.5 Flash** - Multimodal AI model
- **Google ADK** - Agent Development Kit

### Backend Framework
- **FastAPI** - Modern Python web framework
- **aiogram** - Asynchronous Telegram Bot framework
- **Pydantic** - Data validation

### Google Cloud Platform
- **Cloud Run** - Serverless container platform
- **Cloud Functions (Gen2)** - Serverless functions
- **Cloud Storage** - Object storage
- **Pub/Sub** - Asynchronous messaging
- **Secret Manager** - Secrets management

### Infrastructure
- **Terraform** - Infrastructure as Code
- **Docker** - Containerization
- **UV** - Fast Python package manager

### External APIs
- **SerpAPI** - Local business search
- **YouTube API** - Video search
- **Google Maps API** - Location services

## Configuration

### Environment Variables

**Agents:**
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `GOOGLE_CLOUD_LOCATION` - GCP region
- `AGENT_ENGINE_ID` - Reasoning Engine resource name
- `KNOWLEDGE_BASE_RAG_CORPUS` - Knowledge base corpus resource name
- `USER_UPLOAD_RAG_CORPUS` - User documents corpus resource name
- `GCS_BUCKET` - Storage bucket name
- `USER_UPLOAD_FOLDER` - Upload folder path

**Proxy API:**
- `GCP_PROJECT_ID` - GCP project ID
- `GCP_REGION` - GCP region
- `REASONING_ENGINE_ID` - Reasoning Engine ID
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_WEBHOOK_SECRET` - Telegram webhook secret
- `FIREBASE_WEBHOOK_SECRET` - Firebase webhook secret
- `USER_UPLOAD_TOPIC` - Pub/Sub topic for uploads
- `USER_UPLOAD_RESULT_SUBSCRIPTION` - Result subscription
- `GCS_BUCKET` - Storage bucket name

**Worker Function:**
- `GCP_PROJECT_ID` - GCP project ID
- `GCP_REGION` - GCP region
- `RAG_CORPUS` - RAG corpus resource name
- `USER_UPLOAD_RESULT_TOPIC` - Result topic
- `GCS_BUCKET` - Storage bucket name

**External APIs:**
- `SERP_API_KEY` - SerpAPI key

## Deployment Architecture

### Agents Deployment

**Platform:** Vertex AI Reasoning Engine

**Deployment Process:**
1. Build agent using Google ADK
2. Deploy to Vertex AI Agent Engine
3. Grant RAG corpus access permissions
4. Update environment variables with Agent Engine ID

**Key Commands:**
```bash
cd gcp/agents/homecare
make deploy          # Deploy agent
make grant-permissions  # Grant RAG access
```

### Proxy API Deployment

**Platform:** Google Cloud Run

**Deployment Process:**
1. Build Docker image from `api/Dockerfile`
2. Push to Artifact Registry
3. Deploy to Cloud Run with environment variables
4. Configure webhook URLs for Telegram

**Scaling:**
- Automatic scaling (min: 0, max: 100 instances)
- Configurable concurrency per instance
- Memory: 512MB-2GB configurable
- Timeout: 300 seconds (5 minutes)

### Worker Function Deployment

**Platform:** Cloud Functions (Gen2)

**Deployment Process:**
1. Package function code
2. Deploy with Pub/Sub trigger
3. Configure environment variables

**Configuration:**
- Runtime: Python 3.13
- Trigger: Pub/Sub topic (`user-upload-topic`)
- Concurrency: 1 (sequential processing)
- Memory: 512MB
- Max Instances: 1

### Infrastructure Deployment

**Platform:** Terraform

**Deployment Process:**
1. Initialize Terraform backend
2. Configure environment-specific variables
3. Plan and apply infrastructure changes

**Environments:**
- Staging
- Production

## Security

### Authentication & Authorization

**Webhook Security:**
- Secret-based authentication via URL paths
- Separate secrets for Telegram and Firebase
- Service broker webhook authentication

**Service Accounts:**
- Cloud Run uses service account with minimal permissions
- Cloud Functions use service account for GCP access
- Reasoning Engine service agent for RAG access

**IAM Roles:**
- Fine-grained IAM policies for GCP resources
- Custom roles for RAG corpus access
- Principle of least privilege

### Data Security

**Encryption:**
- Encryption in transit (HTTPS/TLS)
- Encryption at rest (GCS default encryption)
- Secret Manager for sensitive credentials

**Data Isolation:**
- User files stored per user ID in separate GCS paths
- Session isolation in Reasoning Engine
- RAG corpus access controls

## Scalability & Performance

### Horizontal Scaling

**Cloud Run:**
- Automatic scaling based on request volume
- Multiple instances handle concurrent requests
- Stateless design enables easy scaling

**Cloud Functions:**
- Automatic scaling per function
- Configurable concurrency limits

### Streaming Responses

**Server-Sent Events (SSE):**
- Real-time agent responses
- Reduces perceived latency
- Progressive response rendering

### Background Processing

**Async File Processing:**
- File uploads processed asynchronously via Pub/Sub
- Prevents API timeouts for large files
- Decouples upload from processing

### Caching & Optimization

**RAG Corpus:**
- Pre-indexed documents for fast retrieval
- Separate corpora for different document types
- Efficient vector search

## Monitoring & Observability

### Logging

**Structured Logging:**
- Python `logging` module with structured output
- Cloud Logging integration
- Log levels: INFO, WARNING, ERROR

**Log Sources:**
- Proxy API (Cloud Run logs)
- Worker functions (Cloud Functions logs)
- Agent execution (Vertex AI logs)

### Error Handling

**Graceful Degradation:**
- User-friendly error messages
- Fallback responses for service failures
- Error logging with stack traces

**Health Checks:**
- `/health` endpoint for service monitoring
- Reasoning Engine connectivity validation
- Used by Cloud Run for health checks

### Metrics

**Cloud Monitoring:**
- Request counts and latencies
- Error rates
- Resource utilization
- Pub/Sub message processing rates

## Development Workflow

### Local Development

**Agents:**
```bash
cd gcp/agents/homecare
make setup      # Install dependencies
make run        # Run locally with ADK
```

**Proxy:**
```bash
cd gcp/proxy/api
uvicorn main:app --host=0.0.0.0 --port=8080 --reload
```

### Testing

**Agent Evaluation:**
- Golden datasets in `property_agent/evals/*.evalset.json` (recorded via `adk web`)
- Pytest runner: `gcp/agents/homecare/eval/test_eval.py` (`make test-eval`)
- Google ADK `AgentEvaluator` with tool trajectory and response matching scores (`property_agent/evals/test_config.json`)

**Integration Tests:**
- Firebase integration tests
- Worker function integration tests
- End-to-end workflow tests

### Deployment

**Agents:**
```bash
make deploy
make grant-permissions
```

**Proxy:**
```bash
gcloud run deploy homecare-agent-proxy --source api --region us-central1
```

**Workers:**
```bash
gcloud functions deploy pubsub_to_user_docs --gen2 --runtime python313
```

## Related Documentation

- **[Proxy Architecture](../proxy/docs/ARCHITECTURE.md)** - Detailed proxy service architecture
- **[Setup and Deployment](./SETUP_AND_DEPLOYMENT.md)** - Comprehensive setup guide
- **[Agents README](../agents/homecare/README.md)** - Agent system documentation
- **[Terraform README](../terraform/README.md)** - Infrastructure documentation
