# Analysis Agent API Integration

## Overview

This document describes how the Analysis Agent integrates with external APIs, the Proxy Service, and client applications. It covers API endpoints, request/response formats, authentication, and error handling.

## Architecture

```
Client Applications (Telegram, Web App, Mobile App)
        ↓
Proxy Service (FastAPI on Cloud Run)
        ↓
Analysis Agent (via Agent Service)
        ↓
External APIs (SerpAPI, SerpAPI, YouTube, Google Search, etc.)
```

## Proxy Service Integration

### Endpoint

**POST** `/api/agent/query`

### Authentication

**Firebase Authentication:**
```http
Authorization: Bearer <firebase_id_token>
```

**Process:**
1. Client obtains Firebase ID token
2. Include token in Authorization header
3. Proxy validates token with Firebase Admin SDK
4. Extract user_id from validated token
5. Pass user_id to agent for document access

### Request Format

```json
{
  "user_query": "My kitchen faucet is leaking at the base",
  "diagnosis_uris": [
    "gs://homeapp-bucket/users/user123/uploads/faucet_leak.jpg"
  ],
  "context_doc_uris": [
    "gs://homeapp-bucket/users/user123/documents/warranty.pdf"
  ],
  "property_address": "123 Main St, San Francisco, CA 94102",
  "location_coordinates": {
    "lat": 37.7749,
    "lng": -122.4194
  },
  "location_radius": 50,
  "property_id": "prop_abc123",
  "analysis_optional_agents": ["coverage", "diy", "service", "cost"],
  "session_id": "session_xyz789"
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_query` | string | Yes | User's question or problem description |
| `diagnosis_uris` | array[string] | No | GCS URIs of media files for analysis |
| `context_doc_uris` | array[string] | No | GCS URIs of context documents |
| `property_address` | string | No | Property address for location-based services |
| `location_coordinates` | object | No | GPS coordinates {lat, lng} |
| `location_radius` | integer | No | Search radius in miles (default: 50) |
| `property_id` | string | No | Property identifier |
| `analysis_optional_agents` | array[string] | No | Optional agents to run (default: all) |
| `session_id` | string | No | Session identifier for conversation context |

### Response Format

```json
{
  "status": "success",
  "response": {
    "markdown": "# Fix Kitchen Faucet Leak\n\n## Problem Diagnosis\n...",
    "json": {
      "analysis": {
        "title": "Fix Kitchen Faucet Leak",
        "triageResult": {
          "diagnosis": "Kitchen faucet showing active water leak..."
        },
        "coverageResult": { /* ... */ },
        "diyResults": { /* ... */ },
        "serviceResults": { /* ... */ },
        "costEstimationResults": { /* ... */ }
      }
    }
  },
  "session_id": "session_xyz789",
  "message_id": "msg_abc456",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | "success" or "error" |
| `response.markdown` | string | Human-readable Markdown response |
| `response.json` | object | Structured JSON response |
| `session_id` | string | Session identifier |
| `message_id` | string | Unique message identifier |
| `timestamp` | string | ISO 8601 timestamp |
| `error` | string | Error message (only if status="error") |

### Error Response

```json
{
  "status": "error",
  "error": "Invalid authentication token",
  "error_code": "AUTH_INVALID",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTH_INVALID` | Invalid or expired authentication token | 401 |
| `AUTH_MISSING` | No authentication token provided | 401 |
| `VALIDATION_ERROR` | Invalid request parameters | 400 |
| `AGENT_ERROR` | Agent processing error | 500 |
| `TIMEOUT` | Request timeout | 504 |
| `RATE_LIMIT` | Rate limit exceeded | 429 |
| `STORAGE_ERROR` | File storage/retrieval error | 500 |

## File Upload Integration

### Endpoint

**POST** `/api/agent/upload`

### Purpose
Upload media files (images, videos, documents) for analysis.

### Request Format (Multipart)

```http
POST /api/agent/upload
Authorization: Bearer <firebase_id_token>
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="faucet_leak.jpg"
Content-Type: image/jpeg

[binary data]
--boundary
Content-Disposition: form-data; name="property_id"

prop_abc123
--boundary--
```

### Response Format

```json
{
  "status": "success",
  "file_uri": "gs://homeapp-bucket/users/user123/uploads/faucet_leak.jpg",
  "file_id": "file_xyz789",
  "upload_timestamp": "2024-01-15T10:30:00Z"
}
```

### Supported File Types

**Images:**
- JPEG/JPG (max 10MB)
- PNG (max 10MB)
- GIF (max 5MB)
- WebP (max 10MB)

**Videos:**
- MP4 (max 100MB)
- MOV (max 100MB)
- AVI (max 100MB)

**Documents:**
- PDF (max 20MB)

### File Processing Flow

1. Client uploads file to `/api/agent/upload`
2. Proxy validates file type and size
3. File stored in Cloud Storage with user-scoped path
4. GCS URI returned to client
5. Client includes URI in `diagnosis_uris` for analysis request

## External API Integrations

### 1. SerpAPI Integration

**Purpose:** Local business search

**API Endpoint:** `https://serpapi.com/search`

**Configuration:**
```python
SERPAPI_KEY = os.environ.get("SERPAPI_KEY")
```

**Request Example:**
```python
params = {
    "engine": "google_local",
    "q": "plumber",
    "location": "San Francisco, CA",
    "api_key": SERPAPI_KEY
}
```

**Response Parsing:**
```python
results = response.json().get("local_results", [])
for result in results:
    business = {
        "name": result.get("title"),
        "address": result.get("address"),
        "phone": result.get("phone"),
        "rating": result.get("rating"),
        "reviews": result.get("reviews"),
        "website": result.get("website")
    }
```

**Rate Limits:**
- Based on subscription tier
- Typical: 5,000-100,000 searches/month

**Error Handling:**
- Invalid API key: Return empty results
- Rate limit exceeded: Queue for retry
- API timeout: Fall back to Google Search

### 2. SerpAPI Fusion API Integration

**Purpose:** Service provider listings with reviews

**API Endpoint:** `https://api.yelp.com/v3/businesses/search`

**Configuration:**
```python
 = os.environ.get("")
```

**Request Example:**
```python
headers = {"Authorization": f"Bearer {}"}
params = {
    "term": "plumber",
    "location": "San Francisco, CA",
    "radius": 80467,  # 50 miles in meters
    "sort_by": "distance",
    "limit": 10
}
```

**Response Parsing:**
```python
businesses = response.json().get("businesses", [])
for business in businesses:
    provider = {
        "name": business.get("name"),
        "address": " ".join(business.get("location", {}).get("display_address", [])),
        "phone": business.get("phone"),
        "rating": business.get("rating"),
        "reviews": business.get("review_count"),
        "url": business.get("url"),
        "distance": business.get("distance")  # in meters
    }
```

**Rate Limits:**
- 5,000 API calls per day (free tier)
- 25,000 API calls per day (paid tier)

**Error Handling:**
- Invalid API key: Return empty results
- Rate limit exceeded: Fall back to SerpAPI or Google Search
- No results: Try broader search radius

### 3. YouTube Data API Integration

**Purpose:** Video tutorial search

**API Endpoint:** `https://www.googleapis.com/youtube/v3/search`

**Configuration:**
```python
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY")
```

**Request Example:**
```python
params = {
    "part": "snippet",
    "q": "how to fix leaking faucet",
    "type": "video",
    "videoDuration": "medium",  # 4-20 minutes
    "relevanceLanguage": "en",
    "maxResults": 10,
    "key": YOUTUBE_API_KEY
}
```

**Response Parsing:**
```python
items = response.json().get("items", [])
for item in items:
    video = {
        "title": item["snippet"]["title"],
        "url": f"https://youtube.com/watch?v={item['id']['videoId']}",
        "description": item["snippet"]["description"],
        "thumbnail": item["snippet"]["thumbnails"]["high"]["url"],
        "channel": item["snippet"]["channelTitle"]
    }
```

**Rate Limits:**
- 10,000 quota units per day (free tier)
- Search costs 100 units per request
- ~100 searches per day

**Error Handling:**
- Quota exceeded: Return cached results or generic message
- Invalid API key: Return empty results
- No results: Broaden search query

### 4. Google Search API Integration

**Purpose:** General web search and fallback

**API Endpoint:** `https://www.googleapis.com/customsearch/v1`

**Configuration:**
```python
GOOGLE_SEARCH_API_KEY = os.environ.get("GOOGLE_SEARCH_API_KEY")
GOOGLE_SEARCH_ENGINE_ID = os.environ.get("GOOGLE_SEARCH_ENGINE_ID")
```

**Request Example:**
```python
params = {
    "key": GOOGLE_SEARCH_API_KEY,
    "cx": GOOGLE_SEARCH_ENGINE_ID,
    "q": "how to fix leaking faucet DIY",
    "num": 10
}
```

**Response Parsing:**
```python
items = response.json().get("items", [])
for item in items:
    result = {
        "title": item.get("title"),
        "url": item.get("link"),
        "snippet": item.get("snippet")
    }
```

**Rate Limits:**
- 100 queries per day (free tier)
- 10,000 queries per day (paid tier)

**Error Handling:**
- Quota exceeded: Return cached results
- Invalid API key: Return error message
- No results: Return generic guidance

### 5. Google Maps Geocoding API

**Purpose:** Convert addresses to coordinates

**API Endpoint:** `https://maps.googleapis.com/maps/api/geocode/json`

**Configuration:**
```python
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")
```

**Request Example:**
```python
params = {
    "address": "123 Main St, San Francisco, CA",
    "key": GOOGLE_MAPS_API_KEY
}
```

**Response Parsing:**
```python
result = response.json().get("results", [{}])[0]
location = result.get("geometry", {}).get("location", {})
coordinates = {
    "lat": location.get("lat"),
    "lng": location.get("lng")
}
```

**Rate Limits:**
- Based on billing account
- Typical: 40,000 requests per month free

**Error Handling:**
- Invalid address: Use address string directly
- API error: Fall back to address-based search
- Rate limit: Queue for later processing

## Vertex AI RAG Integration

### Purpose
Document retrieval for coverage information

### Configuration

```python
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION")
RAG_CORPUS_NAME = f"projects/{PROJECT_ID}/locations/{LOCATION}/ragCorpora/user-{user_id}"
```

### RAG Query

```python
from vertexai.preview import rag

response = rag.retrieval_query(
    rag_resources=[
        rag.RagResource(
            rag_corpus=RAG_CORPUS_NAME,
            rag_file_ids=context_doc_uris  # optional filter
        )
    ],
    text=query,
    similarity_top_k=10,
    vector_distance_threshold=0.3
)
```

### Response Processing

```python
contexts = response.contexts.contexts
for context in contexts:
    source_uri = context.source_uri
    text = context.text
    distance = context.distance
```

### User Corpus Management

**Corpus Creation:**
- Created per user on first document upload
- Naming: `user-{user_id}`
- Automatic indexing of uploaded documents

**Document Indexing:**
- Automatic on upload to designated GCS path
- Supports PDF, DOCX, TXT, images (with OCR)
- Vector embeddings generated automatically

**Access Control:**
- Corpus scoped to individual user
- No cross-user document access
- Firebase Auth enforces user isolation

## Client Integration Examples

### Web Application (React)

```typescript
// Upload file
const uploadFile = async (file: File, propertyId: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('property_id', propertyId);
  
  const token = await firebase.auth().currentUser?.getIdToken();
  
  const response = await fetch('/api/agent/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const data = await response.json();
  return data.file_uri;
};

// Query agent
const queryAgent = async (query: string, diagnosisUris: string[]) => {
  const token = await firebase.auth().currentUser?.getIdToken();
  
  const response = await fetch('/api/agent/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_query: query,
      diagnosis_uris: diagnosisUris,
      analysis_optional_agents: ['coverage', 'diy', 'service', 'cost']
    })
  });
  
  const data = await response.json();
  return data.response.json.analysis;
};
```

### Telegram Bot (Python)

```python
from aiogram import Bot, Dispatcher, types
import aiohttp

async def handle_message(message: types.Message):
    # Get user's Firebase token (stored in session)
    token = await get_user_token(message.from_user.id)
    
    # Handle photo message
    if message.photo:
        # Download photo
        photo = message.photo[-1]
        file = await bot.get_file(photo.file_id)
        file_data = await bot.download_file(file.file_path)
        
        # Upload to proxy
        async with aiohttp.ClientSession() as session:
            form = aiohttp.FormData()
            form.add_field('file', file_data, filename='photo.jpg')
            
            async with session.post(
                f'{PROXY_URL}/api/agent/upload',
                headers={'Authorization': f'Bearer {token}'},
                data=form
            ) as resp:
                upload_result = await resp.json()
                file_uri = upload_result['file_uri']
        
        # Query agent
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{PROXY_URL}/api/agent/query',
                headers={'Authorization': f'Bearer {token}'},
                json={
                    'user_query': message.caption or 'What is this?',
                    'diagnosis_uris': [file_uri]
                }
            ) as resp:
                result = await resp.json()
                markdown_response = result['response']['markdown']
        
        # Send response
        await message.reply(markdown_response, parse_mode='Markdown')
```

### Mobile App (React Native)

```typescript
import { getAuth } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';

// Pick and upload image
const pickAndAnalyzeImage = async () => {
  // Pick image
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8
  });
  
  if (result.canceled) return;
  
  // Upload image
  const formData = new FormData();
  formData.append('file', {
    uri: result.assets[0].uri,
    type: 'image/jpeg',
    name: 'photo.jpg'
  } as any);
  
  const token = await getAuth().currentUser?.getIdToken();
  
  const uploadResponse = await fetch(`${API_URL}/api/agent/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const uploadData = await uploadResponse.json();
  
  // Query agent
  const queryResponse = await fetch(`${API_URL}/api/agent/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_query: 'What is wrong with this?',
      diagnosis_uris: [uploadData.file_uri]
    })
  });
  
  const queryData = await queryResponse.json();
  return queryData.response.json.analysis;
};
```

## Webhook Integration

### Purpose
Asynchronous processing for long-running analyses

### Flow

1. Client submits query to `/api/agent/query`
2. Proxy returns immediately with `status: "processing"`
3. Agent processes in background
4. Result published to Pub/Sub topic
5. Webhook delivers result to client callback URL

### Webhook Request

```json
{
  "session_id": "session_xyz789",
  "message_id": "msg_abc456",
  "status": "completed",
  "response": {
    "markdown": "# Fix Kitchen Faucet Leak\n\n...",
    "json": { /* ... */ }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Webhook Signature

```http
X-Webhook-Signature: sha256=abc123...
X-Webhook-Timestamp: 1705318200
```

**Verification:**
```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

## Rate Limiting

### Per-User Limits

| Resource | Limit | Window |
|----------|-------|--------|
| Queries | 100 | 1 hour |
| File Uploads | 50 | 1 hour |
| Total API Calls | 500 | 1 day |

### Implementation

```python
from redis import Redis
from datetime import timedelta

redis_client = Redis()

def check_rate_limit(user_id: str, resource: str, limit: int, window: timedelta) -> bool:
    key = f"rate_limit:{user_id}:{resource}"
    current = redis_client.get(key)
    
    if current is None:
        redis_client.setex(key, window, 1)
        return True
    
    if int(current) >= limit:
        return False
    
    redis_client.incr(key)
    return True
```

### Rate Limit Response

```json
{
  "status": "error",
  "error": "Rate limit exceeded",
  "error_code": "RATE_LIMIT",
  "retry_after": 3600,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Monitoring and Logging

### Metrics Tracked

- Request count by endpoint
- Response times (p50, p95, p99)
- Error rates by type
- API call counts by service
- Cache hit rates
- User activity patterns

### Logging Format

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "analysis_agent",
  "user_id": "user123",
  "session_id": "session_xyz789",
  "message": "Analysis completed successfully",
  "duration_ms": 15234,
  "agents_executed": ["triage", "coverage", "diy", "service", "cost"],
  "api_calls": {
    "serpapi": 1,
    "yelp": 1,
    "youtube": 1,
    "google_search": 2
  }
}
```

### Error Logging

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "ERROR",
  "service": "analysis_agent",
  "user_id": "user123",
  "session_id": "session_xyz789",
  "error": "SerpAPI rate limit exceeded",
  "error_code": "SERPAPI_RATE_LIMIT",
  "stack_trace": "...",
  "context": {
    "query": "plumber near San Francisco",
    "agent": "service_agent"
  }
}
```

## Security Considerations

### Authentication
- Firebase ID tokens validated on every request
- Tokens expire after 1 hour
- Refresh tokens handled by client SDKs

### Authorization
- User can only access their own documents
- RAG corpus scoped to user_id
- File uploads stored in user-specific paths

### Data Privacy
- User queries not logged in production
- Media files encrypted at rest
- API keys stored in Secret Manager

### Input Validation
- File type and size validation
- Query length limits (max 5000 characters)
- URI format validation
- SQL injection prevention (parameterized queries)

### Rate Limiting
- Per-user rate limits enforced
- API key rotation for external services
- DDoS protection via Cloud Armor

