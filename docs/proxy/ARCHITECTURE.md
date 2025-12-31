# GCP Proxy API - Architecture Documentation

This document describes the architecture, design patterns, and technical implementation of the GCP Proxy API.

## System Overview

The GCP Proxy API is a FastAPI-based microservice that serves as a unified API gateway for the HomeApp ecosystem. It provides a clean abstraction layer between client applications and Google Cloud Platform services.

### Core Responsibilities

1. **API Gateway** - Unified entry point for all backend operations
2. **Authentication** - Webhook-based security for endpoints
3. **Request Routing** - Direct requests to appropriate services
4. **Business Logic** - Process and transform data
5. **Integration** - Connect to GCP services (Vertex AI, Firestore, Pub/Sub, Storage)
6. **Error Handling** - Graceful error handling and logging

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │    mapp      │  │   webapp     │  │   Telegram   │              │
│  │  (React      │  │  (Next.js)   │  │     Bot      │              │
│  │   Native)    │  │              │  │              │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼──────────────────────┘
          │                  │                  │
          │ HTTPS            │ HTTPS            │ HTTPS
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼──────────────────────┐
│                    GCP Proxy API (FastAPI)                            │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Application Layer                         │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │              main.py (FastAPI App)                   │   │    │
│  │  │  • CORS Middleware                                   │   │    │
│  │  │  • Lifecycle Management (lifespan)                   │   │    │
│  │  │  • Router Registration                               │   │    │
│  │  │  • Health Check Endpoint                             │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  │                                                               │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │              core/ (Configuration)                   │   │    │
│  │  │  • config.py - Environment variables & settings      │   │    │
│  │  │  • events.py - Startup/shutdown lifecycle hooks      │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Router Layer (HTTP)                       │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │ agent.py     │  │ documents.py │  │ checkpoint.py│      │    │
│  │  │ • Query      │  │ • Extract    │  │ • Analyze    │      │    │
│  │  │ • Stream     │  │   Doc Info   │  │ • Compare    │      │    │
│  │  │ • Session    │  │              │  │              │      │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │    │
│  │  ┌──────────────┐  ┌──────────────┐                         │    │
│  │  │ telegram.py  │  │ service_     │                         │    │
│  │  │ • Webhook    │  │ broker.py    │                         │    │
│  │  └──────┬───────┘  └──────┬───────┘                         │    │
│  └─────────┼──────────────────┼──────────────────────────────────┘  │
│            │                  │                                      │
│  ┌─────────▼──────────────────▼──────────────────────────────────┐  │
│  │                  Service Layer (Business Logic)               │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │  │
│  │  │ agent_service.py │  │ document_        │                  │  │
│  │  │ • Query handling │  │ service.py       │                  │  │
│  │  │ • Streaming      │  │ • Gemini AI      │                  │  │
│  │  └──────────────────┘  │   integration    │                  │  │
│  │  ┌──────────────────┐  └──────────────────┘                  │  │
│  │  │ checkpoint_      │  ┌──────────────────┐                  │  │
│  │  │ service.py       │  │ vertex_service.py│                  │  │
│  │  │ • Pub/Sub pub    │  │ • Reasoning      │                  │  │
│  │  │ • Comparison     │  │   Engine         │                  │  │
│  │  └──────────────────┘  └──────────────────┘                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │  │
│  │  │ telegram_bot.py  │  │ service_broker_  │                  │  │
│  │  │ • Bot logic      │  │ service.py       │                  │  │
│  │  └──────────────────┘  └──────────────────┘                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Schema Layer (Data Models)                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │ agent.py     │  │ document.py  │  │ checkpoint.py│      │    │
│  │  │ • Request    │  │ • Request    │  │ • Request    │      │    │
│  │  │ • Response   │  │ • Response   │  │ • Response   │      │    │
│  │  │ • Session    │  │ • DocType    │  │ • Comparison │      │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Utility Layer                             │    │
│  │  ┌──────────────────┐  ┌──────────────────┐                 │    │
│  │  │ gcp.py           │  │ optional_        │                 │    │
│  │  │ • GCP clients    │  │ agents.py        │                 │    │
│  │  │ • Helpers        │  │ • Agent config   │                 │    │
│  │  └──────────────────┘  └──────────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
                              │
                              │ Service Calls
                              │
┌─────────────────────────────▼─────────────────────────────────────────┐
│                      Google Cloud Platform                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ Vertex AI    │  │  Firestore   │  │   Pub/Sub    │                │
│  │ • Reasoning  │  │  • User data │  │  • Async     │                │
│  │   Engine     │  │  • Properties│  │    tasks     │                │
│  │ • Gemini AI  │  │  • Checkpts  │  │              │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│  ┌──────────────┐  ┌──────────────┐                                  │
│  │ Cloud        │  │  Cloud       │                                  │
│  │ Storage      │  │  Logging     │                                  │
│  │ • Documents  │  │  • Metrics   │                                  │
│  │ • Images     │  │  • Traces    │                                  │
│  └──────────────┘  └──────────────┘                                  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Layered Architecture

### 1. Application Layer

**Purpose:** Application initialization, configuration, and lifecycle management.

**Components:**
- `main.py` - FastAPI application instance
- `core/config.py` - Environment variables and settings
- `core/events.py` - Startup/shutdown hooks

**Responsibilities:**
- Initialize FastAPI app
- Configure CORS middleware
- Register routers
- Manage application lifecycle
- Provide health check endpoint

### 2. Router Layer

**Purpose:** HTTP request handling and routing.

**Components:**
- `routers/agent.py` - Agent query endpoints
- `routers/documents.py` - Document analysis endpoints
- `routers/checkpoint.py` - Checkpoint processing endpoints
- `routers/telegram.py` - Telegram webhook endpoint
- `routers/service_broker.py` - Service broker webhook

**Responsibilities:**
- Define HTTP endpoints
- Parse request bodies
- Validate input using schemas
- Delegate to service layer
- Format responses
- Handle HTTP-specific errors

**Pattern:**
```python
@router.post("/endpoint-name")
async def endpoint_handler(request_data: RequestSchema):
    try:
        result = await service_function(request_data)
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"status": "error", "message": str(e)}
```

### 3. Service Layer

**Purpose:** Business logic and external service integration.

**Components:**
- `services/agent_service.py` - Agent query processing
- `services/document_service.py` - Document analysis with Gemini
- `services/checkpoint_service.py` - Checkpoint analysis and comparison
- `services/vertex_service.py` - Vertex AI Reasoning Engine integration
- `services/telegram_bot.py` - Telegram bot logic
- `services/service_broker_service.py` - Service broker processing

**Responsibilities:**
- Implement business logic
- Call external APIs (Vertex AI, Firestore, etc.)
- Transform data
- Handle service-specific errors
- Return structured responses

**Pattern:**
```python
def service_function(request: RequestSchema) -> ResponseSchema:
    # Business logic
    result = process_data(request)
    
    # External API call
    api_response = external_api.call(result)
    
    # Transform and return
    return ResponseSchema(**api_response)
```

### 4. Schema Layer

**Purpose:** Data validation and serialization.

**Components:**
- `schemas/agent.py` - Agent request/response models
- `schemas/document.py` - Document analysis models
- `schemas/checkpoint.py` - Checkpoint processing models

**Responsibilities:**
- Define request/response structures
- Validate input data
- Serialize/deserialize JSON
- Type checking

**Pattern:**
```python
from pydantic import BaseModel

class RequestSchema(BaseModel):
    field1: str
    field2: Optional[int] = None

class ResponseSchema(BaseModel):
    status: str
    data: Dict[str, Any]
```

### 5. Utility Layer

**Purpose:** Shared utilities and helpers.

**Components:**
- `utils/gcp.py` - GCP client initialization and helpers
- `utils/optional_agents.py` - Agent configuration

**Responsibilities:**
- Initialize GCP clients
- Provide helper functions
- Share common code

---

## Design Patterns

### 1. Dependency Injection

Services are initialized once and imported where needed:

```python
# In service module
client = genai.Client(vertexai=True, project=PROJECT_ID)

# In router
from services.document_service import extract_doc_info
```

### 2. Async/Await

Async operations for I/O-bound tasks:

```python
@router.post("/endpoint")
async def handler(request_data: Schema):
    result = await async_service_call(request_data)
    return result
```

### 3. Streaming Responses

Server-Sent Events for real-time updates:

```python
async def stream_data():
    async for chunk in data_source():
        yield json.dumps(chunk) + "\n"

@router.post("/stream")
async def stream_endpoint():
    return StreamingResponse(stream_data(), media_type="text/event-stream")
```

### 4. Pub/Sub Pattern

Asynchronous processing for long-running tasks:

```python
# Publish to topic
publisher.publish(topic_path, data.encode())
return {"status": "accepted"}

# Worker processes message
def worker(message):
    process_data(message.data)
    message.ack()
```

### 5. Error Handling

Graceful error handling with fallbacks:

```python
try:
    result = process_data()
    return SuccessResponse(data=result)
except Exception as e:
    logger.error(f"Error: {e}")
    return ErrorResponse(message=str(e))
```

---

## Data Flow

### Synchronous Request Flow

```
1. Client sends HTTP request
   ↓
2. FastAPI receives request
   ↓
3. Router validates request body (Pydantic)
   ↓
4. Router calls service function
   ↓
5. Service processes business logic
   ↓
6. Service calls external API (Vertex AI, etc.)
   ↓
7. Service transforms response
   ↓
8. Router formats response
   ↓
9. FastAPI returns HTTP response to client
```

### Asynchronous Request Flow (Pub/Sub)

```
1. Client sends HTTP request
   ↓
2. Router publishes message to Pub/Sub topic
   ↓
3. Router returns 202 Accepted immediately
   ↓
4. Worker function subscribes to topic
   ↓
5. Worker processes message asynchronously
   ↓
6. Worker updates Firestore with results
   ↓
7. Client listens to Firestore for updates
```

### Streaming Response Flow

```
1. Client sends HTTP request
   ↓
2. Router initiates streaming response
   ↓
3. Service generates data chunks
   ↓
4. Router yields chunks as Server-Sent Events
   ↓
5. Client receives chunks in real-time
   ↓
6. Stream completes with final event
```

---

## Key Components

### FastAPI Application

**File:** `main.py`

**Initialization:**
```python
app = FastAPI(
    title="HomeApp Proxy API",
    description="API for handling HomeApp proxy requests",
    version="1.0.0",
    lifespan=lifespan
)
```

**Middleware:**
- CORS - Cross-origin resource sharing
- Logging - Request/response logging

**Router Registration:**
```python
if settings.FIREBASE_WEBHOOK_SECRET:
    prefix = f"/{settings.FIREBASE_WEBHOOK_SECRET}"
    app.include_router(agent.router, prefix=prefix)
    app.include_router(documents.router, prefix=prefix)
    app.include_router(checkpoint.router, prefix=prefix)
```

### Configuration Management

**File:** `core/config.py`

**Settings Class:**
```python
class Settings:
    TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET")
    FIREBASE_WEBHOOK_SECRET = os.environ.get("FIREBASE_WEBHOOK_SECRET")
    GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
    # ... more settings
```

**Usage:**
```python
from core.config import settings
project_id = settings.GCP_PROJECT_ID
```

### Lifecycle Management

**File:** `core/events.py`

**Lifespan Context:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    initialize_services()
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    cleanup_resources()
```

### Vertex AI Integration

**File:** `services/vertex_service.py`

**Reasoning Engine:**
- Session management
- Query processing
- Response streaming

**Gemini AI:**
- Document analysis
- Image analysis
- Structured output generation

### Firebase Integration

**Firestore:**
- User data storage
- Property information
- Checkpoint records
- Analysis results

**Authentication:**
- Service account authentication
- Automatic initialization

### Pub/Sub Integration

**Publisher:**
```python
publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(project_id, topic_name)
publisher.publish(topic_path, data.encode())
```

**Subscriber (Worker):**
```python
subscriber = pubsub_v1.SubscriberClient()
subscription_path = subscriber.subscription_path(project_id, subscription_name)
subscriber.subscribe(subscription_path, callback=process_message)
```

---

## Security Architecture

### Authentication

**Webhook Secrets:**
- Secrets embedded in URL paths
- Different secrets for different channels
- Prevents unauthorized access

**Service Account:**
- GCP service account for API authentication
- Least privilege principle
- Roles: Vertex AI User, Firestore User, Pub/Sub Publisher

### Authorization

**Client-Level:**
- User ID validation
- Property ownership checks
- Session management

**API-Level:**
- Webhook secret validation
- Request validation with Pydantic

### Data Security

**In Transit:**
- HTTPS required in production
- TLS 1.2+ encryption

**At Rest:**
- Firestore encryption
- Cloud Storage encryption
- No local file storage

---

## Scalability

### Horizontal Scaling

**Cloud Run:**
- Auto-scaling based on load
- 0 to N instances
- Concurrent request handling

**Stateless Design:**
- No local state storage
- Session data in Firestore
- Enables easy scaling

### Async Processing

**Pub/Sub:**
- Decouple long-running tasks
- Worker functions scale independently
- Retry logic for failures

**Streaming:**
- Real-time responses
- Reduced memory usage
- Better user experience

### Performance Optimization

**Direct URL Processing:**
- No file downloads for analysis
- Reduced latency
- Lower memory usage

**Efficient Models:**
- Gemini 2.0 Flash for speed
- Low temperature for consistency
- Structured output for parsing

---

## Monitoring and Observability

### Logging

**Structured Logging:**
```python
logger.info(f"Processing request: {request_id}")
logger.error(f"Error occurred: {error}", exc_info=True)
```

**Log Levels:**
- INFO - Normal operations
- WARNING - Potential issues
- ERROR - Errors with stack traces

**Cloud Logging:**
- Automatic integration
- Searchable logs
- Log-based metrics

### Metrics

**Cloud Run Metrics:**
- Request count
- Request latency
- Error rate
- Instance count
- CPU/memory usage

**Custom Metrics:**
- Business logic metrics
- Service-specific counters
- Performance timers

### Health Checks

**Endpoint:** `/health`

**Checks:**
- API responsiveness
- Reasoning Engine connection
- Service availability

---

## Error Handling Strategy

### Levels of Error Handling

1. **Router Level** - HTTP-specific errors
2. **Service Level** - Business logic errors
3. **External API Level** - Third-party service errors

### Error Response Format

**Standard:**
```json
{
  "status": "error",
  "message": "Human-readable error description"
}
```

**FastAPI HTTPException:**
```json
{
  "detail": "Error description"
}
```

### Graceful Degradation

**Fallback Responses:**
```python
try:
    result = analyze_document()
except Exception as e:
    logger.error(f"Analysis failed: {e}")
    return FallbackResponse(
        documentType="OTHER",
        summary=f"Analysis failed: {str(e)}"
    )
```

---

## Deployment Architecture

### Cloud Run

**Container:**
- Python 3.13+ runtime
- FastAPI application
- Dependencies from requirements.txt

**Configuration:**
- Auto-scaling: 0-100 instances
- Memory: 512MB-2GB
- CPU: 1-2 vCPUs
- Timeout: 300s

**Networking:**
- Public endpoint
- HTTPS only
- Cloud Load Balancer

### Environment Variables

**Runtime Configuration:**
- Secrets via environment variables
- No secrets in code
- Cloud Run environment configuration

### CI/CD

**GitHub Actions:**
- Automated deployment
- Build and push container
- Deploy to Cloud Run

---

## Related Documentation

- [API Overview](./API_OVERVIEW.md) - Complete API reference
- [Development Guide](./DEVELOPMENT.md) - Local development setup
- [Deployment Guide](./DEPLOYMENT.md) - Deployment instructions
- [Configuration Guide](./CONFIGURATION.md) - Environment variables

