# Reports API Documentation

## Base URL

```
https://your-api-domain.com/{FIREBASE_WEBHOOK_SECRET}
```

All endpoints require the Firebase webhook secret in the URL path for authentication.

## Endpoints

### 1. Analyze Report

Queue an inspection report for asynchronous analysis.

**Endpoint**: `POST /analyze-report`

**Request Body**:
```json
{
  "reportUri": "gs://bucket-name/reports/user123/prop456/report.pdf",
  "contentType": "application/pdf",
  "reportId": "abc123",
  "userId": "user123",
  "propertyId": "prop456"
}
```

**Request Schema**:
```typescript
interface AnalyzeReportRequest {
  reportUri: string;      // GCS URI (gs://...)
  contentType: string;    // MIME type (application/pdf or image/*)
  reportId: string;       // Firestore document ID
  userId: string;         // User ID who owns the report
  propertyId: string;     // Property ID the report belongs to
}
```

**Response**: `202 Accepted`
```json
{
  "status": "accepted",
  "message": "Analysis queued for processing",
  "reportId": "abc123",
  "messageId": "pubsub-message-id-12345"
}
```

**Description**:
- Publishes analysis request to Pub/Sub for async processing
- Returns immediately (does not wait for analysis to complete)
- Frontend should listen to Firestore for status updates
- Analysis typically completes in 30-60 seconds

**Error Responses**:

`400 Bad Request`:
```json
{
  "detail": "reportUri is required"
}
```

`500 Internal Server Error`:
```json
{
  "detail": "Failed to publish to Pub/Sub: [error message]"
}
```

**Example**:
```bash
curl -X POST "https://api.example.com/secret123/analyze-report" \
  -H "Content-Type: application/json" \
  -d '{
    "reportUri": "gs://my-bucket/reports/user1/prop1/inspection.pdf",
    "contentType": "application/pdf",
    "reportId": "report_001",
    "userId": "user_001",
    "propertyId": "prop_001"
  }'
```

---

### 2. Chat with Report

Ask questions about a previously analyzed inspection report.

**Endpoint**: `POST /chat-with-report`

**Request Body**:
```json
{
  "userQuery": "What are the critical issues in this report?",
  "reportId": "abc123",
  "userId": "user123",
  "propertyId": "prop456",
  "reportContext": null
}
```

**Request Schema**:
```typescript
interface ChatWithReportRequest {
  userQuery: string;              // User's question
  reportId: string;               // Report to query
  userId: string;                 // User ID (for auth & data access)
  propertyId: string;             // Property ID
  reportContext?: object | null;  // Optional: pre-loaded analysis data
}
```

**Response**: `200 OK`
```json
{
  "answer": "Based on the inspection report, there are 3 critical issues...",
  "reportId": "abc123"
}
```

**Response Schema**:
```typescript
interface ChatResponse {
  answer: string;     // AI-generated answer
  reportId: string;   // Report that was queried
}
```

**Description**:
- Retrieves report analysis from Firestore (if reportContext not provided)
- Uses report agent to generate context-aware answer
- References page numbers, costs, and severity levels
- Typical response time: 2-5 seconds

**Common Questions**:
- "What are the critical issues?"
- "How much will repairs cost?"
- "What should I fix first?"
- "Can I do any repairs myself?"
- "What did the inspector say about [system]?"

**Error Responses**:

`400 Bad Request`:
```json
{
  "detail": "userQuery cannot be empty"
}
```

`404 Not Found`:
```json
{
  "detail": "Report not found or not analyzed yet"
}
```

`500 Internal Server Error`:
```json
{
  "detail": "Error processing your question: [error message]"
}
```

**Example**:
```bash
curl -X POST "https://api.example.com/secret123/chat-with-report" \
  -H "Content-Type: application/json" \
  -d '{
    "userQuery": "What are the most expensive repairs needed?",
    "reportId": "report_001",
    "userId": "user_001",
    "propertyId": "prop_001"
  }'
```

---

### 3. Get Report Summary

Retrieve a summary of an analyzed inspection report.

**Endpoint**: `GET /report-summary/{report_id}`

**Path Parameters**:
- `report_id`: ID of the inspection report

**Query Parameters**:
- `user_id`: User ID who owns the report (required)
- `property_id`: Property ID the report belongs to (required)

**Response**: `200 OK`
```json
{
  "summary": "Overall property condition is fair with several areas requiring attention...",
  "overallCondition": "fair",
  "keyFindings": [
    "Electrical panel requires immediate upgrade",
    "Roof has 5-7 years remaining life",
    "Foundation in good condition with minor cracks"
  ],
  "totalIssues": 15,
  "criticalIssues": 2,
  "totalEstimatedCost": 12500.00
}
```

**Response Schema**:
```typescript
interface ReportSummaryResponse {
  summary: string;              // Overall summary text
  overallCondition: string;     // excellent | good | fair | poor | critical
  keyFindings: string[];        // Array of key findings
  totalIssues: number;          // Total number of issues found
  criticalIssues: number;       // Number of critical severity issues
  totalEstimatedCost: number;   // Sum of all cost estimates
}
```

**Description**:
- Retrieves summary metrics from analyzed report
- Aggregates data from aiAnalysis field
- Fast read-only operation
- Useful for dashboards and list views

**Error Responses**:

`404 Not Found`:
```json
{
  "detail": "Report report_001 not found or not analyzed yet"
}
```

`500 Internal Server Error`:
```json
{
  "detail": "Error retrieving report summary: [error message]"
}
```

**Example**:
```bash
curl "https://api.example.com/secret123/report-summary/report_001?user_id=user_001&property_id=prop_001"
```

---

## Authentication

All endpoints require the Firebase webhook secret in the URL path:

```
/{FIREBASE_WEBHOOK_SECRET}/analyze-report
/{FIREBASE_WEBHOOK_SECRET}/chat-with-report
/{FIREBASE_WEBHOOK_SECRET}/report-summary/{report_id}
```

The webhook secret is set via environment variable:
```bash
FIREBASE_WEBHOOK_SECRET=your-secret-here
```

## Rate Limiting

Currently no rate limiting is enforced. Consider implementing:
- Per-user limits: 10 analysis requests per hour
- Per-user limits: 100 chat queries per hour
- Global limits based on quota/cost controls

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "detail": "Human-readable error message"
}
```

HTTP Status Codes:
- `200`: Success
- `202`: Accepted (async processing)
- `400`: Bad request (validation error)
- `404`: Not found
- `500`: Internal server error

## Webhooks

The system does not currently send webhooks. Status updates are delivered via:
- **Firestore real-time listeners**: Frontend subscribes to report document changes
- **Status field**: `uploading` → `analyzing` → `complete` or `failed`

Future enhancement: Add webhook support for external integrations.

## SDKs

### JavaScript/TypeScript

```typescript
import { getAuth } from 'firebase/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const WEBHOOK_SECRET = process.env.NEXT_PUBLIC_FIREBASE_WEBHOOK_SECRET;

async function analyzeReport(reportUri: string, reportId: string, userId: string, propertyId: string) {
  const response = await fetch(`${API_URL}/${WEBHOOK_SECRET}/analyze-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reportUri,
      contentType: 'application/pdf',
      reportId,
      userId,
      propertyId,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }
  
  return await response.json();
}

async function chatWithReport(reportId: string, userId: string, propertyId: string, question: string) {
  const response = await fetch(`${API_URL}/${WEBHOOK_SECRET}/chat-with-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userQuery: question,
      reportId,
      userId,
      propertyId,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Chat failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.answer;
}
```

### Python

```python
import requests
import os

API_URL = os.environ['API_URL']
WEBHOOK_SECRET = os.environ['FIREBASE_WEBHOOK_SECRET']

def analyze_report(report_uri, report_id, user_id, property_id):
    url = f"{API_URL}/{WEBHOOK_SECRET}/analyze-report"
    payload = {
        "reportUri": report_uri,
        "contentType": "application/pdf",
        "reportId": report_id,
        "userId": user_id,
        "propertyId": property_id
    }
    response = requests.post(url, json=payload)
    response.raise_for_status()
    return response.json()

def chat_with_report(report_id, user_id, property_id, question):
    url = f"{API_URL}/{WEBHOOK_SECRET}/chat-with-report"
    payload = {
        "userQuery": question,
        "reportId": report_id,
        "userId": user_id,
        "propertyId": property_id
    }
    response = requests.post(url, json=payload)
    response.raise_for_status()
    return response.json()['answer']
```

## Pagination

Currently not implemented. All results are returned in single response.

Future enhancement for endpoints that might return large datasets:
```json
{
  "data": [...],
  "pagination": {
    "cursor": "next_page_token",
    "hasMore": true,
    "total": 50
  }
}
```

## Versioning

Current version: `v1` (implicit, no version in URL)

Future versions will use URL path versioning:
```
/v2/{FIREBASE_WEBHOOK_SECRET}/analyze-report
```

## Testing

### Test Report URIs

Use these test files in staging environment:
```
gs://test-bucket/reports/sample_clean_report.pdf
gs://test-bucket/reports/sample_critical_issues.pdf
gs://test-bucket/reports/sample_complex_report.pdf
```

### Postman Collection

See `docs/reports/postman_collection.json` for complete API test collection.

## Support

For API issues:
- Check Cloud Function logs in Google Cloud Console
- Review Pub/Sub dead letter queue for failed messages
- Monitor Firestore for stuck reports (status: "analyzing" for > 5 minutes)
- Contact support with request ID from error response

