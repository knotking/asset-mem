# Adding Functions to GCP Proxy API

This guide explains how to add new API endpoints and functions to the GCP Proxy API (`gcp/proxy/api`).

## Overview

The GCP Proxy API is a FastAPI application that serves as a backend proxy for various services. When adding a new function, you'll typically:

1. **Define models** for request/response validation
2. **Create a handler module** with your business logic
3. **Register the endpoint** in `main.py`
4. **Add documentation** for the new endpoint
5. **Test** the implementation

## Step-by-Step Guide

### Step 1: Define Request/Response Models

Add your models to `models.py`:

```python
from pydantic import BaseModel
from typing import Optional, List

class YourRequest(BaseModel):
    """Request model for your endpoint"""
    required_field: str
    optional_field: Optional[str] = None
    list_field: Optional[List[str]] = None

class YourResponse(BaseModel):
    """Response model for your endpoint"""
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None
```

**Best Practices:**
- Use Pydantic `BaseModel` for automatic validation
- Add docstrings to explain each field
- Use `Optional` for fields that may not be present
- Use type hints (`str`, `int`, `List`, `Dict`, etc.)

### Step 2: Create Handler Module

Create a new file `your_api.py` in `gcp/proxy/api/`:

```python
"""
Your API Module

Brief description of what this module does.
"""

import os
import logging
from typing import Dict, Any
from models import YourRequest, YourResponse

logger = logging.getLogger(__name__)

# Initialize any clients or services here
# Example:
# from google import genai
# client = genai.Client(vertexai=True, project=os.environ.get("GCP_PROJECT_ID"))

def your_handler_function(request: YourRequest) -> YourResponse:
    """
    Main handler function for your endpoint.
    
    Args:
        request: YourRequest containing input data
        
    Returns:
        YourResponse with processed results
        
    Raises:
        Exception: If processing fails
    """
    try:
        logger.info(f"Processing request: {request.required_field}")
        
        # Your business logic here
        result = process_data(request)
        
        return YourResponse(
            status="success",
            message="Operation completed",
            data=result
        )
        
    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        return YourResponse(
            status="error",
            message=str(e),
            data=None
        )

def process_data(request: YourRequest) -> Dict[str, Any]:
    """Helper function for processing logic"""
    # Implementation here
    return {}
```

**File Structure:**
- Module docstring at the top
- Import statements
- Logger initialization
- Client/service initialization (if needed)
- Main handler function(s)
- Helper functions (if needed)

### Step 3: Register Endpoint in main.py

Add your endpoint to `main.py`:

```python
# Import your handler
from your_api import your_handler_function

# Import your models
from models import YourRequest

# Add endpoint (use appropriate HTTP method)
@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/your-endpoint")
async def your_endpoint(request: Request):
    """
    Your endpoint description.
    
    This endpoint does X, Y, and Z.
    
    Request body:
    {
        "required_field": "value",
        "optional_field": "optional_value"
    }
    """
    logger.info("Your endpoint received a request.")
    try:
        data = await request.json()
        request_obj = YourRequest(**data)
        logger.info(f"Processing: {request_obj.model_dump_json()}")
        
        result = your_handler_function(request_obj)
        
        logger.info(f"Completed: {result.status}")
        return result.model_dump()
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error processing request: {e}")
        return {"status": "error", "message": str(e)}
```

**Endpoint Patterns:**

1. **Firebase Webhook Endpoints** (protected by `FIREBASE_WEBHOOK_SECRET`):
   ```python
   @app.post(f"/{FIREBASE_WEBHOOK_SECRET}/your-endpoint")
   ```

2. **Telegram Webhook Endpoints** (protected by `TELEGRAM_WEBHOOK_SECRET`):
   ```python
   @app.post(f"/{TELEGRAM_WEBHOOK_SECRET}")
   ```

3. **Public Endpoints** (no secret):
   ```python
   @app.get("/your-public-endpoint")
   ```

**HTTP Methods:**
- `@app.get()` - For retrieving data
- `@app.post()` - For creating/processing data
- `@app.put()` - For updating data
- `@app.delete()` - For deleting data

### Step 4: Add Documentation

Create `YOUR_API.md` in `gcp/proxy/api/`:

```markdown
# Your API

This document describes the [your endpoint name] endpoint in the GCP proxy API.

## Overview

Brief description of what this endpoint does and why it exists.

## Architecture

```
┌─────────────────┐
│  Client         │
└────────┬────────┘
         │ POST /your-endpoint
         │ { request data }
         ↓
┌─────────────────────────────────┐
│  GCP Proxy API (FastAPI)       │
│  └─ your_endpoint()             │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  your_api.py                    │
│  └─ your_handler_function()     │
└─────────────────────────────────┘
```

## Files

### 1. `models.py`
Defines request/response models:
- `YourRequest`: Input validation
- `YourResponse`: Output structure

### 2. `your_api.py`
Core handler logic:
- `your_handler_function()`: Main processing function

### 3. `main.py`
FastAPI endpoint registration:
- `your_endpoint()`: HTTP endpoint handler

## API Endpoint

### URL
```
POST /{FIREBASE_WEBHOOK_SECRET}/your-endpoint
```

### Request Body
```json
{
  "required_field": "value",
  "optional_field": "optional_value"
}
```

### Response Body
```json
{
  "status": "success",
  "message": "Operation completed",
  "data": {
    "result": "processed_data"
  }
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

Required:
```bash
FIREBASE_WEBHOOK_SECRET=your-secret
GCP_PROJECT_ID=your-project-id  # If using GCP services
```

## Usage Examples

### cURL Example
```bash
curl -X POST "https://your-api-url/{SECRET}/your-endpoint" \
  -H "Content-Type: application/json" \
  -d '{
    "required_field": "value"
  }'
```

### Python Example
```python
import requests

response = requests.post(
    f"https://your-api-url/{SECRET}/your-endpoint",
    json={"required_field": "value"}
)
print(response.json())
```

## Error Handling

The endpoint handles errors gracefully:
- Validation errors return 200 with `{"status": "error"}`
- Processing errors are logged and returned
- Always returns valid JSON

## Testing

### Manual Testing
```bash
# Test with valid data
curl -X POST "http://localhost:8080/{SECRET}/your-endpoint" \
  -H "Content-Type: application/json" \
  -d '{"required_field": "test"}'
```

### Integration Testing
Add tests to `tests/` directory if needed.

## Security

- Endpoint protected by webhook secret
- Use HTTPS in production
- Validate all input data
- Log security-relevant events

## Deployment

Deployed as part of the GCP proxy service:
```bash
cd gcp/proxy/api
gcloud run deploy homecare-agent-proxy --source .
```

## Related Documentation

- [GCP Proxy README](../../README.md)
- [Document Analysis API](./DOCUMENT_ANALYSIS_API.md)
```

### Step 5: Handle Async Operations (If Needed)

If your function needs to perform async operations:

**Option 1: Async Handler Function**
```python
async def your_async_handler(request: YourRequest) -> YourResponse:
    """Async handler for long-running operations"""
    result = await some_async_operation(request)
    return YourResponse(status="success", message="Done", data=result)
```

**Option 2: Background Processing**
```python
# In main.py
@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/your-endpoint")
async def your_endpoint(request: Request):
    """Returns immediately, processes in background"""
    data = await request.json()
    
    # Schedule async processing
    asyncio.run_coroutine_threadsafe(
        your_async_handler(data),
        main_loop
    )
    
    return {"status": "ok", "message": "Processing started"}
```

### Step 6: Add Streaming Support (If Needed)

For streaming responses (like chat or long-running operations):

```python
from fastapi.responses import StreamingResponse
import json

async def stream_your_data(request: YourRequest):
    """Generator function for streaming responses"""
    async for chunk in your_streaming_source(request):
        yield json.dumps(chunk) + "\n"

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/your-streaming-endpoint")
async def your_streaming_endpoint(request: Request):
    """Streaming endpoint"""
    data = await request.json()
    request_obj = YourRequest(**data)
    
    return StreamingResponse(
        stream_your_data(request_obj),
        media_type="text/event-stream"
    )
```

## Common Patterns

### Pattern 1: Simple Request/Response
```python
# Handler
def simple_handler(request: YourRequest) -> YourResponse:
    result = process(request)
    return YourResponse(status="success", data=result)

# Endpoint
@app.post(f"/{SECRET}/simple")
async def simple_endpoint(request: Request):
    data = await request.json()
    result = simple_handler(YourRequest(**data))
    return result.model_dump()
```

### Pattern 2: Using Vertex AI/Gemini
```python
from google import genai

client = genai.Client(
    vertexai=True,
    project=os.environ.get("GCP_PROJECT_ID"),
    location=os.environ.get("GCP_LOCATION", "us-central1")
)

def ai_handler(request: YourRequest) -> YourResponse:
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=[request.prompt],
        config={"temperature": 0.7}
    )
    return YourResponse(status="success", data={"text": response.text})
```

### Pattern 3: Using Firebase/Firestore
```python
import firebase_admin
from firebase_admin import firestore

db = firestore.client()

def firestore_handler(request: YourRequest) -> YourResponse:
    doc_ref = db.collection("your_collection").document(request.doc_id)
    doc = doc_ref.get()
    return YourResponse(status="success", data=doc.to_dict())
```

### Pattern 4: Using Pub/Sub
```python
from google.cloud import pubsub_v1

publisher = pubsub_v1.PublisherClient()

def pubsub_handler(request: YourRequest) -> YourResponse:
    topic_path = publisher.topic_path(
        os.environ.get("GCP_PROJECT_ID"),
        "your-topic"
    )
    publisher.publish(topic_path, request.data.encode())
    return YourResponse(status="success", message="Published")
```

## Testing Checklist

- [ ] Model validation works correctly
- [ ] Handler function processes requests
- [ ] Endpoint returns expected response format
- [ ] Error handling works (invalid input, exceptions)
- [ ] Logging is appropriate
- [ ] Documentation is complete
- [ ] Environment variables are documented
- [ ] Security considerations are addressed

## Code Review Checklist

- [ ] Follows existing code patterns
- [ ] Uses proper type hints
- [ ] Includes docstrings
- [ ] Handles errors gracefully
- [ ] Logs important events
- [ ] Validates input data
- [ ] Returns consistent response format
- [ ] Documentation is clear and complete

## Examples in Codebase

Reference these existing implementations:

1. **Document Analysis** (`document_analysis.py`, `DOCUMENT_ANALYSIS_API.md`)
   - Uses Vertex AI Gemini
   - Structured JSON response
   - Error handling with fallbacks

2. **Firebase API** (`firebase_api.py`)
   - Async streaming responses
   - Session management
   - File upload handling

3. **Service Broker** (`service_broker_api.py`, `SERVICE_BROKER_API.md`)
   - Background async processing
   - Webhook pattern
   - Payload validation

4. **Telegram API** (`telegram_api.py`)
   - Webhook handling
   - Message processing
   - External API integration

## Troubleshooting

### Issue: "Module not found"
**Solution:** Ensure your module is in `gcp/proxy/api/` and imported correctly in `main.py`

### Issue: "Validation error"
**Solution:** Check your Pydantic models match the request structure

### Issue: "Endpoint not found"
**Solution:** Verify the endpoint path matches the registered route in `main.py`

### Issue: "Environment variable not set"
**Solution:** Add required env vars to Cloud Run deployment or `.env` file

## Next Steps

After adding your function:

1. **Test locally:**
   ```bash
   cd gcp/proxy/api
   uvicorn main:app --host=0.0.0.0 --port=8080 --reload
   ```

2. **Update requirements.txt** if you added new dependencies:
   ```bash
   pip freeze > requirements.txt
   ```

3. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy homecare-agent-proxy --source .
   ```

4. **Update main README** if your endpoint is a major feature

## Related Documentation

- [GCP Proxy README](../../README.md)
- [Document Analysis API](./DOCUMENT_ANALYSIS_API.md)
- [Service Broker API](./SERVICE_BROKER_API.md)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Pydantic Documentation](https://docs.pydantic.dev/)

