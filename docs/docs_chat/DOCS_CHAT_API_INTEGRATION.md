# Docs Chat Agent API Integration

## Overview

This document describes the API integration for the Docs Chat Agent, including request/response formats, endpoints, and client integration patterns.

## API Endpoints

### Stream Agent Response

**Endpoint**: `POST /firebase-agent-stream`

**Description**: Streams agent responses for document queries with real-time updates.

**Request Body**:
```typescript
{
  user_id: string;                    // Required: User identifier
  session_id?: string;                // Optional: Session ID for context
  user_query: string;                 // Required: User's question
  primary_agent: "docs";              // Required: Set to "docs" for document queries
  context_doc_uris?: string[];        // Optional: Specific documents to search
  property_id?: string;               // Optional: Property context
  property_address?: string;          // Optional: Property address for context
}
```

**Response**: Server-Sent Events (SSE) stream

**Example Request**:
```bash
curl -X POST https://api.example.com/firebase-agent-stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "user_id": "user123",
    "session_id": "session456",
    "user_query": "What warranty coverage do I have?",
    "primary_agent": "docs",
    "context_doc_uris": ["gs://bucket/user123/warranty.pdf"],
    "property_id": "prop789"
  }'
```

### Non-Streaming Agent Query

**Endpoint**: `POST /firebase-agent-query`

**Description**: Returns complete agent response (non-streaming).

**Request Body**: Same as streaming endpoint

**Response**:
```typescript
{
  status: "success" | "error";
  message: string;  // Complete response with citations
}
```

**Example Response**:
```json
{
  "status": "success",
  "message": "Your appliance has a 2-year limited warranty covering parts and labor for defects in materials and workmanship.\n\nCitations:\n- Appliance Warranty, Section 2"
}
```

## Request Parameters

### Required Parameters

#### `user_id`
- **Type**: `string`
- **Description**: Unique identifier for the user
- **Validation**: Must not be empty
- **Example**: `"user_abc123"`

#### `user_query`
- **Type**: `string`
- **Description**: The user's question about their documents
- **Example**: `"What does my warranty cover?"`

#### `primary_agent`
- **Type**: `"docs"`
- **Description**: Must be set to `"docs"` to activate document query mode
- **Example**: `"docs"`

### Optional Parameters

#### `session_id`
- **Type**: `string`
- **Description**: Session ID for conversation context
- **Default**: Auto-generated if not provided
- **Example**: `"session_xyz789"`

#### `context_doc_uris`
- **Type**: `string[]`
- **Description**: GCS URIs of specific documents to search
- **Behavior**: 
  - If provided and not empty: Searches only these documents (selected docs mode)
  - If empty or omitted: Searches all user documents (all-docs mode)
- **Example**: `["gs://bucket/user123/manual.pdf", "gs://bucket/user123/warranty.pdf"]`

#### `property_id`
- **Type**: `string`
- **Description**: Property ID for scoping document search
- **Example**: `"prop_abc123"`

#### `property_address`
- **Type**: `string`
- **Description**: Property address for additional context
- **Example**: `"123 Main St, City, State 12345"`

## Response Formats

### Successful Document Query

```json
{
  "status": "success",
  "message": "[Answer text based on retrieved documents]\n\nCitations:\n- [Document 1 Title], [Section]\n- [Document 2 Title], [Section]"
}
```

**Example**:
```json
{
  "status": "success",
  "message": "Your HVAC system has a 10-year parts warranty and a 1-year labor warranty from the date of installation. The warranty covers defects in materials and workmanship but excludes damage from improper maintenance or unauthorized repairs.\n\nCitations:\n- HVAC Installation Manual, Warranty Information\n- Service Agreement, Coverage Details"
}
```

### No Documents Found

```json
{
  "status": "success",
  "message": "No relevant information could be found in your uploaded documents or provided context to answer this question."
}
```

### Error Response

```json
{
  "status": "error",
  "message": "Error description"
}
```

**Common Errors**:
- `"User ID is required"` - Missing user_id
- `"Property ID is required for document queries"` - Missing property_id when needed
- `"Unable to search documents at this time"` - RAG service error
- `"Internal server error"` - Unexpected error

## Client Integration

### Web App Integration

**React/TypeScript Example**:

```typescript
import { apiUrls } from "@/lib/utils";

interface DocsQueryRequest {
  user_id: string;
  session_id?: string;
  user_query: string;
  primary_agent: "docs";
  context_doc_uris?: string[];
  property_id?: string;
  property_address?: string;
}

async function queryDocuments(request: DocsQueryRequest): Promise<string> {
  const response = await fetch(apiUrls.agentStream, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${await getAuthToken()}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  // Handle streaming response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let result = "";

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    result += chunk;
    
    // Update UI with partial response
    onPartialResponse(result);
  }

  return result;
}

// Usage
const response = await queryDocuments({
  user_id: user.uid,
  session_id: sessionId,
  user_query: "What warranty do I have?",
  primary_agent: "docs",
  context_doc_uris: selectedDocs.map(d => d.gcsUri),
  property_id: propertyId,
});
```

### Mobile App Integration

**React Native Example**:

```typescript
import { streamAgentResponse } from "@homeapp/common/api";

async function queryDocuments(
  userId: string,
  query: string,
  selectedDocs: string[],
  propertyId: string
) {
  let fullResponse = "";
  
  await streamAgentResponse({
    userId,
    agentSessionId: sessionId,
    userQuery: query,
    contextDocURIs: selectedDocs,
    primaryAgent: "docs",
    propertyId,
    signal: abortController.signal,
    onChunk: (chunk) => {
      fullResponse += chunk;
      // Update UI
      setResponse(fullResponse);
    },
    onComplete: (final) => {
      console.log("Query complete:", final);
    },
    onError: (error) => {
      console.error("Query error:", error);
    },
  });
  
  return fullResponse;
}
```

### Direct API Call (cURL)

**Selected Documents Mode**:
```bash
curl -X POST https://api.example.com/firebase-agent-query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "user_id": "user123",
    "user_query": "What does my warranty cover?",
    "primary_agent": "docs",
    "context_doc_uris": [
      "gs://bucket/user123/warranty.pdf"
    ],
    "property_id": "prop123"
  }'
```

**All Documents Mode**:
```bash
curl -X POST https://api.example.com/firebase-agent-query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "user_id": "user123",
    "user_query": "Do I have any appliance manuals?",
    "primary_agent": "docs",
    "context_doc_uris": [],
    "property_id": "prop123"
  }'
```

## Agent Payload Structure

The API transforms the client request into an agent payload:

**API Request** → **Agent Payload**:

```typescript
// Client sends
{
  user_id: "user123",
  session_id: "session456",
  user_query: "What warranty do I have?",
  primary_agent: "docs",
  context_doc_uris: ["gs://bucket/doc.pdf"],
  property_id: "prop789"
}

// API forwards to agent
{
  user_query: "What warranty do I have?",
  primary_agent: "docs",
  context_doc_uris: ["gs://bucket/doc.pdf"],
  property_id: "prop789"
}
```

## Streaming Response Format

### Event Stream Structure

The streaming endpoint returns Server-Sent Events (SSE):

```
data: {"content": {"parts": [{"text": "Your warranty covers..."}]}, "author": "user_docs_agent"}

data: {"content": {"parts": [{"text": "\n\nCitations:\n- Warranty Document"}]}, "author": "user_docs_agent"}

data: [DONE]
```

### Parsing Stream Events

```typescript
async function parseStreamResponse(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        
        try {
          const event = JSON.parse(data);
          const text = event.content?.parts?.[0]?.text;
          if (text) {
            yield text;
          }
        } catch (e) {
          console.error("Parse error:", e);
        }
      }
    }
  }
}
```

## Error Handling

### Client-Side Error Handling

```typescript
async function queryDocumentsWithErrorHandling(request: DocsQueryRequest) {
  try {
    const response = await fetch(apiUrls.agentQuery, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (data.status === "error") {
      throw new Error(data.message);
    }

    return data.message;
  } catch (error) {
    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes("User ID is required")) {
        console.error("Authentication error");
      } else if (error.message.includes("Property ID is required")) {
        console.error("Missing property context");
      } else {
        console.error("Query failed:", error.message);
      }
    }
    throw error;
  }
}
```

### Retry Logic

```typescript
async function queryWithRetry(
  request: DocsQueryRequest,
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await queryDocuments(request);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors
      if (error.message.includes("required")) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => 
        setTimeout(resolve, 1000 * Math.pow(2, i))
      );
    }
  }

  throw lastError;
}
```

## Rate Limiting

### Limits

- **Requests per minute**: 60 per user
- **Concurrent requests**: 5 per user
- **Request timeout**: 30 seconds

### Handling Rate Limits

```typescript
async function queryWithRateLimit(request: DocsQueryRequest) {
  try {
    return await queryDocuments(request);
  } catch (error) {
    if (error.message.includes("rate limit")) {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 60000));
      return await queryDocuments(request);
    }
    throw error;
  }
}
```

## Authentication

### Firebase Auth Token

```typescript
import { getAuth } from "firebase/auth";

async function getAuthToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error("User not authenticated");
  }
  
  return await user.getIdToken();
}
```

### Including Auth in Requests

```typescript
const token = await getAuthToken();

const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
  body: JSON.stringify(request),
});
```

## Performance Optimization

### Request Debouncing

```typescript
import { debounce } from "lodash";

const debouncedQuery = debounce(
  async (query: string) => {
    return await queryDocuments({
      user_id: userId,
      user_query: query,
      primary_agent: "docs",
      context_doc_uris: selectedDocs,
    });
  },
  500
);
```

### Caching Responses

```typescript
const cache = new Map<string, string>();

async function queryWithCache(request: DocsQueryRequest): Promise<string> {
  const cacheKey = JSON.stringify(request);
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }
  
  const response = await queryDocuments(request);
  cache.set(cacheKey, response);
  
  return response;
}
```

## Testing

### Integration Test Example

```typescript
describe("Docs Chat API", () => {
  it("should query selected documents", async () => {
    const response = await queryDocuments({
      user_id: "test_user",
      user_query: "What warranty do I have?",
      primary_agent: "docs",
      context_doc_uris: ["gs://test/warranty.pdf"],
      property_id: "test_prop",
    });

    expect(response).toContain("warranty");
    expect(response).toContain("Citations:");
  });

  it("should query all documents", async () => {
    const response = await queryDocuments({
      user_id: "test_user",
      user_query: "What documents do I have?",
      primary_agent: "docs",
      context_doc_uris: [],
      property_id: "test_prop",
    });

    expect(response).toBeDefined();
  });

  it("should handle no results", async () => {
    const response = await queryDocuments({
      user_id: "test_user",
      user_query: "What is the capital of France?",
      primary_agent: "docs",
      property_id: "test_prop",
    });

    expect(response).toContain("No relevant information");
  });
});
```

## Monitoring

### Logging Requests

```typescript
function logRequest(request: DocsQueryRequest) {
  console.log("Docs query request:", {
    user_id: request.user_id,
    query: request.user_query,
    docs_count: request.context_doc_uris?.length || "all",
    property_id: request.property_id,
    timestamp: new Date().toISOString(),
  });
}
```

### Tracking Metrics

```typescript
interface QueryMetrics {
  request_count: number;
  success_count: number;
  error_count: number;
  avg_response_time: number;
}

const metrics: QueryMetrics = {
  request_count: 0,
  success_count: 0,
  error_count: 0,
  avg_response_time: 0,
};

async function queryWithMetrics(request: DocsQueryRequest) {
  metrics.request_count++;
  const startTime = Date.now();

  try {
    const response = await queryDocuments(request);
    metrics.success_count++;
    return response;
  } catch (error) {
    metrics.error_count++;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    metrics.avg_response_time = 
      (metrics.avg_response_time * (metrics.request_count - 1) + duration) / 
      metrics.request_count;
  }
}
```

## Related Documentation

- [Docs Chat Overview](DOCS_CHAT_OVERVIEW.md)
- [Docs Chat Implementation](DOCS_CHAT_IMPLEMENTATION.md)
- [Docs Chat Testing Guide](DOCS_CHAT_TESTING.md)
- [Proxy API Documentation](../../gcp/proxy/api/README.md)
