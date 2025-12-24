# Service Broker Agent API

This document describes the service broker agent webhook endpoint in the GCP proxy API.

## Overview

The Service Broker Agent webhook receives notifications from external service broker agents. The endpoint is designed to:

- **Receive JSON payloads** from service broker agents
- **Return immediately** with a 200 OK response
- **Process payloads asynchronously** on the main event loop

This asynchronous design ensures the webhook responds quickly while allowing complex processing to happen in the background.

## Architecture

```
┌─────────────────────────┐
│  Service Broker Agent   │
│  (External Service)     │
└───────────┬─────────────┘
            │ POST /service-broker-agent
            │ { JSON payload }
            ↓
┌─────────────────────────────────┐
│  GCP Proxy API (FastAPI)        │
│  └─ service_broker_agent_webhook│
│     └─ Returns 200 immediately  │
└───────────┬─────────────────────┘
            │ asyncio.run_coroutine_threadsafe()
            ↓
┌─────────────────────────────────┐
│  main_loop (async event loop)   │
│  └─ handle_service_broker_payload│
│     └─ Async processing (TODO)  │
└─────────────────────────────────┘
```

## Files

### 1. `service_broker_api.py`

Core handler for processing service broker payloads:

```python
class ServiceBrokerPayload(BaseModel):
    """
    Model for service broker agent webhook payload.
    Add fields as needed based on the actual payload structure.
    """
    pass

async def handle_service_broker_payload(payload: Dict[str, Any]) -> None:
    """
    Async handler for processing service broker agent payloads.
    Called asynchronously on the main event loop.
    """
    logger.info(f"Processing service broker payload asynchronously: {payload}")
    # TODO: Implement actual async processing logic
    logger.info("Service broker payload processing complete")
```

### 2. `main.py`

FastAPI endpoint definition:

```python
@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/service-broker-agent")
async def service_broker_agent_webhook(request: Request):
    """
    Webhook endpoint to receive service broker agent notifications.
    Returns 200 immediately and processes the payload asynchronously.
    """
    payload = await request.json()
    logger.info(f"Service broker agent webhook payload: {payload}")
    
    # Schedule async processing on main_loop and return immediately
    asyncio.run_coroutine_threadsafe(
        handle_service_broker_payload(payload),
        main_loop
    )
    
    return {"status": "ok", "message": "Payload received"}
```

## API Endpoint

### URL
```
POST /{FIREBASE_WEBHOOK_SECRET}/service-broker-agent
```

### Request Body
```json
{
  // Any JSON payload - structure TBD based on service broker requirements
  "key": "value",
  "nested": {
    "data": "example"
  }
}
```

### Response Body
```json
{
  "status": "ok",
  "message": "Payload received"
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Configuration

### Environment Variables

Required environment variables:

```bash
FIREBASE_WEBHOOK_SECRET=your-secret     # Webhook authentication secret
```

## Usage Examples

### cURL Example

```bash
curl -X POST "https://your-api-url/{SECRET}/service-broker-agent" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "service_completed",
    "service_id": "12345",
    "status": "success",
    "data": {
      "provider": "example_provider",
      "timestamp": "2025-01-15T10:30:00Z"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Payload received"
}
```

### Python Example

```python
import requests

response = requests.post(
    f"https://your-api-url/{SECRET}/service-broker-agent",
    json={
        "event": "service_completed",
        "service_id": "12345",
        "status": "success"
    }
)
print(response.json())  # {"status": "ok", "message": "Payload received"}
```

## Async Processing Pattern

The webhook uses `asyncio.run_coroutine_threadsafe()` to schedule async processing:

```python
# In main.py
main_loop = asyncio.get_event_loop()

# In the webhook handler
asyncio.run_coroutine_threadsafe(
    handle_service_broker_payload(payload),
    main_loop
)
```

This pattern:
1. **Decouples** the HTTP response from payload processing
2. **Ensures** the webhook responds within timeout limits
3. **Allows** complex processing without blocking
4. **Uses** the shared main event loop for consistency

## TODO: Implementation Tasks

The following tasks need to be implemented in `service_broker_api.py`:

### 1. Define Payload Model
Update `ServiceBrokerPayload` with actual fields:

```python
class ServiceBrokerPayload(BaseModel):
    event: str                          # Event type
    service_id: str                     # Service identifier
    status: str                         # Event status
    data: Optional[Dict[str, Any]]      # Additional data
    timestamp: Optional[datetime]       # Event timestamp
```

### 2. Implement Processing Logic
Add actual processing in `handle_service_broker_payload()`:

```python
async def handle_service_broker_payload(payload: Dict[str, Any]) -> None:
    # Parse and validate payload
    broker_payload = ServiceBrokerPayload(**payload)
    
    # Route based on event type
    if broker_payload.event == "service_completed":
        await handle_service_completed(broker_payload)
    elif broker_payload.event == "service_failed":
        await handle_service_failed(broker_payload)
    # ... more event handlers
```

### 3. Add Error Handling
Implement robust error handling:

```python
async def handle_service_broker_payload(payload: Dict[str, Any]) -> None:
    try:
        # Processing logic
        pass
    except ValidationError as e:
        logger.error(f"Invalid payload: {e}")
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        # Consider retry logic or dead letter queue
```

### 4. Add Database Integration
Store or update data based on payload:

```python
async def handle_service_completed(payload: ServiceBrokerPayload) -> None:
    # Update Firestore, send notifications, etc.
    await update_service_status(payload.service_id, payload.status)
    await notify_user(payload.service_id)
```

### 5. Add Monitoring
Track processing metrics:

```python
async def handle_service_broker_payload(payload: Dict[str, Any]) -> None:
    start_time = time.time()
    try:
        # Processing
        metrics.increment("service_broker.processed")
    except Exception:
        metrics.increment("service_broker.failed")
    finally:
        metrics.timing("service_broker.duration", time.time() - start_time)
```

## Logging

The API logs key events at INFO level:

```
INFO: Service broker agent webhook received a request.
INFO: Service broker agent webhook payload: {...}
INFO: Processing service broker payload asynchronously: {...}
INFO: Service broker payload processing complete
```

## Security

### Authentication
- Endpoint protected by `FIREBASE_WEBHOOK_SECRET`
- Only authorized services should know the secret

### Best Practices
- Keep `FIREBASE_WEBHOOK_SECRET` confidential
- Use HTTPS for all API calls
- Validate payload structure before processing
- Consider adding request signing/verification from broker

## Error Handling

### Webhook Level
Returns error response if JSON parsing fails:

```python
except Exception as e:
    logger.error(f"Error processing service broker agent webhook: {e}")
    return {"status": "error", "message": str(e)}
```

### Processing Level
Errors during async processing are logged but don't affect the webhook response:

```python
# In handle_service_broker_payload
try:
    # Processing
except Exception as e:
    logger.error(f"Failed to process payload: {e}")
```

## Testing

### Manual Testing

```bash
# Test basic payload
curl -X POST "http://localhost:8080/{SECRET}/service-broker-agent" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Expected: {"status": "ok", "message": "Payload received"}
```

### Check Logs
After sending request, check logs for async processing:

```
INFO: Service broker agent webhook received a request.
INFO: Service broker agent webhook payload: {'test': 'data'}
INFO: Processing service broker payload asynchronously: {'test': 'data'}
INFO: Service broker payload processing complete
```

## Deployment

Deployed as part of the GCP proxy service. No additional configuration needed beyond existing environment variables.

```bash
# Standard deployment
cd gcp/proxy/api
gcloud run deploy homecare-agent-proxy \
  --source . \
  --platform managed \
  --region us-central1
```

## Related Documentation

- [GCP Proxy README](../../README.md)
- [Document Analysis API](./DOCUMENT_ANALYSIS_API.md)
- [Firebase API](../routers/agent.py)

