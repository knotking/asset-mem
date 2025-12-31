# GCP Proxy API - Complete API Reference

This document provides a comprehensive reference for all API endpoints in the GCP Proxy API.

## Base URL

```
Production: https://homecare-agent-proxy-{project-number}.{region}.run.app
Development: http://localhost:8080
```

## Authentication

Most endpoints are protected by webhook secrets passed in the URL path:

- **Firebase endpoints**: `/{FIREBASE_WEBHOOK_SECRET}/endpoint-name`
- **Telegram endpoints**: `/{TELEGRAM_WEBHOOK_SECRET}`

## Health Check

### GET /health

Check the health status of the API and Reasoning Engine connection.

**Request:**
```bash
curl http://localhost:8080/health
```

**Response:**
```json
{
  "status": "ok"
}
```

or if Reasoning Engine is not initialized:

```json
{
  "status": "ok (Reasoning Engine not initialized)"
}
```

**Status Codes:**
- `200 OK` - Service is healthy

---

## Agent Endpoints

### POST /{secret}/firebase-agent-query

Process a query from the agent and return a complete response.

**Request Body:**
```json
{
  "query": "What are the maintenance tasks for my property?",
  "user_id": "user123",
  "session_id": "session456",
  "property_id": "prop789"
}
```

**Response:**
```json
{
  "response": "Here are the maintenance tasks for your property...",
  "session_id": "session456",
  "status": "success"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Error description"
}
```

**Status Codes:**
- `200 OK` - Query processed successfully
- `200 OK` - Error occurred (returns error object)

**Example:**
```bash
curl -X POST "http://localhost:8080/{SECRET}/firebase-agent-query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Hello",
    "user_id": "test_user"
  }'
```

---

### POST /{secret}/firebase-agent-stream

Process a query from the agent and stream the response in real-time.

**Request Body:**
```json
{
  "query": "Explain property maintenance best practices",
  "user_id": "user123",
  "session_id": "session456"
}
```

**Response:**

Server-Sent Events (SSE) stream:
```
data: {"chunk": "Property", "type": "text"}

data: {"chunk": " maintenance", "type": "text"}

data: {"chunk": " involves", "type": "text"}

data: {"type": "done"}
```

**Status Codes:**
- `200 OK` - Streaming response
- `200 OK` - Error occurred (returns error object)

**Example:**
```bash
curl -X POST "http://localhost:8080/{SECRET}/firebase-agent-stream" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Tell me about property maintenance",
    "user_id": "test_user"
  }'
```

---

### POST /{secret}/agent-session

Create a new session for the agent.

**Request Body:**
```json
{
  "user_id": "user123"
}
```

**Response:**
```json
{
  "session_id": "new_session_id_123",
  "status": "success"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Failed to create session"
}
```

**Status Codes:**
- `200 OK` - Session created successfully
- `200 OK` - Error occurred

**Example:**
```bash
curl -X POST "http://localhost:8080/{SECRET}/agent-session" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123"
  }'
```

---

### DELETE /{secret}/agent-session

Delete an existing agent session.

**Request Body:**
```json
{
  "user_id": "user123",
  "session_id": "session456"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Deleted Session"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Session not found"
}
```

**Status Codes:**
- `200 OK` - Session deleted successfully
- `200 OK` - Error occurred

**Example:**
```bash
curl -X DELETE "http://localhost:8080/{SECRET}/agent-session" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "session_id": "session456"
  }'
```

---

## Document Endpoints

### POST /{secret}/extract-doc-info

Extract structured information from property documents using Gemini AI.

**Request Body:**
```json
{
  "docUrl": "https://storage.googleapis.com/bucket/document.pdf",
  "contentType": "application/pdf"
}
```

**Response:**
```json
{
  "documentType": "DEED",
  "propertyAddress": "123 Main Street, Anytown, CA 12345",
  "keyEntities": [
    {
      "name": "Deed Type",
      "value": "Warranty Deed"
    },
    {
      "name": "Recording Date",
      "value": "January 15, 2024"
    }
  ],
  "summary": "Warranty deed for residential property at 123 Main Street."
}
```

**Document Types:**
- `DEED` - Property deeds and titles
- `INSURANCE_POLICY` - Insurance documents
- `UTILITY_BILL` - Utility statements
- `INSPECTION_REPORT` - Property inspections
- `MORTGAGE_STATEMENT` - Loan documents
- `OTHER` - Unclassified documents

**Error Response:**
```json
{
  "documentType": "OTHER",
  "propertyAddress": "N/A",
  "keyEntities": [],
  "summary": "Analysis failed: Error description"
}
```

**Status Codes:**
- `200 OK` - Document analyzed successfully
- `200 OK` - Analysis failed (returns fallback response)

**Example:**
```bash
curl -X POST "http://localhost:8080/{SECRET}/extract-doc-info" \
  -H "Content-Type: application/json" \
  -d '{
    "docUrl": "https://storage.googleapis.com/test/sample.pdf",
    "contentType": "application/pdf"
  }'
```

---

## Checkpoint Endpoints

### POST /{secret}/analyze-checkpoint

Analyze a property checkpoint image using Gemini AI (asynchronous processing).

**Request Body:**
```json
{
  "checkpointId": "checkpoint123",
  "userId": "user123",
  "propertyId": "prop456",
  "imageUrl": "https://storage.googleapis.com/bucket/checkpoint.jpg",
  "contentType": "image/jpeg",
  "location": "Kitchen - Sink Area"
}
```

**Response:**
```json
{
  "status": "accepted",
  "message": "Analysis queued for processing",
  "checkpointId": "checkpoint123"
}
```

**Error Response:**
```json
{
  "detail": "checkpointId, userId, and propertyId are required for async processing"
}
```

**Status Codes:**
- `202 Accepted` - Analysis queued successfully
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Processing error

**Notes:**
- This endpoint returns immediately (202 Accepted)
- Analysis is processed asynchronously via Pub/Sub
- Results are written to Firestore
- Frontend should listen to Firestore changes for completion

**Example:**
```bash
curl -X POST "http://localhost:8080/{SECRET}/analyze-checkpoint" \
  -H "Content-Type: application/json" \
  -d '{
    "checkpointId": "checkpoint123",
    "userId": "user123",
    "propertyId": "prop456",
    "imageUrl": "https://storage.googleapis.com/test/image.jpg",
    "contentType": "image/jpeg",
    "location": "Kitchen"
  }'
```

---

### POST /{secret}/compare-checkpoints

Compare two checkpoint images and identify changes.

**Request Body:**
```json
{
  "image1Url": "https://storage.googleapis.com/bucket/checkpoint1.jpg",
  "image2Url": "https://storage.googleapis.com/bucket/checkpoint2.jpg",
  "contentType1": "image/jpeg",
  "contentType2": "image/jpeg",
  "location": "Kitchen - Sink Area"
}
```

**Response:**
```json
{
  "similarityScore": 85,
  "overallAssessment": "Minor changes detected",
  "semanticChanges": [
    "New appliance visible in second image",
    "Lighting conditions slightly different"
  ],
  "regionsOfInterest": [
    {
      "description": "Countertop area",
      "changeType": "addition",
      "severity": "minor"
    }
  ],
  "recommendation": "Changes are minor and do not require immediate action"
}
```

**Error Response:**
```json
{
  "detail": "Error comparing checkpoints: Error description"
}
```

**Status Codes:**
- `200 OK` - Comparison completed successfully
- `500 Internal Server Error` - Comparison failed

**Example:**
```bash
curl -X POST "http://localhost:8080/{SECRET}/compare-checkpoints" \
  -H "Content-Type: application/json" \
  -d '{
    "image1Url": "https://storage.googleapis.com/test/image1.jpg",
    "image2Url": "https://storage.googleapis.com/test/image2.jpg",
    "contentType1": "image/jpeg",
    "contentType2": "image/jpeg",
    "location": "Living Room"
  }'
```

---

## Service Broker Endpoints

### POST /{secret}/service-broker-agent

Webhook endpoint to receive service broker agent notifications.

**Request Body:**
```json
{
  "event": "service_completed",
  "service_id": "12345",
  "status": "success",
  "data": {
    "provider": "example_provider",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

**Response:**
```json
{
  "status": "ok",
  "message": "Payload received"
}
```

**Error Response:**
```json
{
  "status": "error",
  "message": "Error description"
}
```

**Status Codes:**
- `200 OK` - Payload received and queued for processing
- `200 OK` - Error occurred

**Notes:**
- Returns immediately with 200 OK
- Payload is processed asynchronously
- Processing happens in background

**Example:**
```bash
curl -X POST "http://localhost:8080/{SECRET}/service-broker-agent" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "service_completed",
    "service_id": "12345",
    "status": "success"
  }'
```

---

## Telegram Endpoints

### POST /{telegram_secret}

Telegram webhook endpoint for receiving bot messages.

**Request Body:**

Telegram Update object (sent by Telegram):
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 12345,
      "first_name": "John",
      "username": "johndoe"
    },
    "chat": {
      "id": 12345,
      "type": "private"
    },
    "date": 1678886400,
    "text": "Hello bot!"
  }
}
```

**Response:**
```json
{
  "status": "ok"
}
```

**Status Codes:**
- `200 OK` - Update processed

**Notes:**
- Automatically configured via Telegram Bot API
- Handles text messages, commands, and media
- Integrates with Vertex AI Reasoning Engine
- Sends responses back via Telegram Bot API

---

## Error Handling

### Standard Error Response

All endpoints return errors in a consistent format:

```json
{
  "status": "error",
  "message": "Human-readable error description"
}
```

or for FastAPI HTTPException:

```json
{
  "detail": "Error description"
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful (even for some errors)
- `202 Accepted` - Request accepted for async processing
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Endpoint not found
- `500 Internal Server Error` - Server error

### Error Types

1. **Validation Errors** - Invalid request body or parameters
2. **Authentication Errors** - Invalid webhook secret
3. **Processing Errors** - Failed to process request
4. **External Service Errors** - Vertex AI, Firestore, etc. failures

---

## Rate Limiting

Currently no rate limiting is enforced at the API level. Cloud Run provides automatic scaling and resource management.

**Recommendations:**
- Implement client-side rate limiting
- Use async endpoints for long-running operations
- Monitor Cloud Run quotas and limits

---

## CORS Configuration

The API allows cross-origin requests from any origin:

```python
allow_origins=["*"]
allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
allow_headers=["*"]
```

**Production Recommendation:** Restrict `allow_origins` to specific domains.

---

## Request/Response Headers

### Common Request Headers

```
Content-Type: application/json
```

### Common Response Headers

```
Content-Type: application/json
```

For streaming endpoints:
```
Content-Type: text/event-stream
```

---

## Testing

### Using cURL

```bash
# Set your webhook secret
export SECRET="your-webhook-secret"

# Health check
curl http://localhost:8080/health

# Agent query
curl -X POST "http://localhost:8080/${SECRET}/firebase-agent-query" \
  -H "Content-Type: application/json" \
  -d '{"query": "Hello", "user_id": "test"}'

# Document analysis
curl -X POST "http://localhost:8080/${SECRET}/extract-doc-info" \
  -H "Content-Type: application/json" \
  -d '{"docUrl": "https://example.com/doc.pdf", "contentType": "application/pdf"}'
```

### Using Python

```python
import requests

SECRET = "your-webhook-secret"
BASE_URL = "http://localhost:8080"

# Agent query
response = requests.post(
    f"{BASE_URL}/{SECRET}/firebase-agent-query",
    json={"query": "Hello", "user_id": "test"}
)
print(response.json())

# Document analysis
response = requests.post(
    f"{BASE_URL}/{SECRET}/extract-doc-info",
    json={
        "docUrl": "https://example.com/doc.pdf",
        "contentType": "application/pdf"
    }
)
print(response.json())
```

### Using JavaScript/TypeScript

```typescript
const SECRET = "your-webhook-secret";
const BASE_URL = "http://localhost:8080";

// Agent query
const response = await fetch(`${BASE_URL}/${SECRET}/firebase-agent-query`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "Hello", user_id: "test" })
});
const data = await response.json();
console.log(data);
```

---

## OpenAPI Documentation

The API automatically generates OpenAPI (Swagger) documentation:

**Interactive Docs:**
- Swagger UI: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`

**OpenAPI JSON:**
- `http://localhost:8080/openapi.json`

---

## Related Documentation

- [Agent API Details](./AGENT_API.md)
- [Checkpoint API Details](./CHECKPOINT_API.md)
- [Document API Details](./DOCUMENT_API.md)
- [Service Broker API Details](./SERVICE_BROKER_API.md)
- [Telegram API Details](./TELEGRAM_API.md)
- [Development Guide](./DEVELOPMENT.md)

