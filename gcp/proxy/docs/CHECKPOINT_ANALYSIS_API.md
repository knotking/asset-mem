# Checkpoint API

This document describes the checkpoint API endpoints for processing property checkpoint images.

## Endpoints

### 1. Analyze Checkpoint (Async)

The Checkpoint Analysis API provides asynchronous image analysis for property checkpoints. The endpoint publishes analysis requests to Pub/Sub for background processing.

**Endpoint:** `POST /{SECRET}/analyze-checkpoint`

See [Architecture](#architecture-async-analysis) below for details.

### 2. Compare Checkpoints (Sync)

The Checkpoint Comparison API compares two checkpoint images (e.g., "Before" vs "After") to identify changes, damage, or repairs. This is a synchronous endpoint that returns results immediately using Gemini AI.

**Endpoint:** `POST /{SECRET}/compare-checkpoints`

**Request Body:**

```json
{
  "image1Url": "gs://bucket/path/to/before.jpg",
  "image2Url": "gs://bucket/path/to/after.jpg",
  "contentType1": "image/jpeg",
  "contentType2": "image/jpeg",
  "location": "Kitchen"
}
```

**Response:**

```json
{
  "summary": "The wall has been painted...",
  "similarityScore": 0.85,
  "semanticChanges": ["Wall color changed", "Crack repaired"],
  "regions": [
    {
      "description": "Crack repair",
      "changeType": "modified",
      "severity": "minor",
      "confidence": 0.95,
      "bbox": { ... }
    }
  ]
}
```

## Architecture (Async Analysis)

```
┌─────────────────────────────────────────────────────────────┐
│              Client Application (Mobile/Web)                │
│  - Creates checkpoint with image                            │
│  - Sets analysisStatus: 'pending'                           │
└───────────┬─────────────────────────────────────────────────┘
            │
            │ POST /analyze-checkpoint
            │ {imageUrl, contentType, location, checkpointId, userId, propertyId}
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              GCP Proxy API (Cloud Run)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Checkpoint Analysis Endpoint                        │  │
│  │  - Validates request                                 │  │
│  │  - Publishes to checkpoint-analysis-topic            │  │
│  │  - Returns 202 Accepted immediately                  │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          │ Pub/Sub Message
                          │ {imageUrl, contentType, location, checkpointId, userId, propertyId}
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│     Cloud Function: pubsub_checkpoint_analysis             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Receives Pub/Sub message                        │  │
│  │  2. Calls Gemini AI for image analysis              │  │
│  │  3. Updates Firestore checkpoint document           │  │
│  │     - Sets analysisStatus: 'completed'              │  │
│  │     - Adds aiAnalysis field                         │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          │ Firestore Update
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         Client Application (Real-time Listener)            │
│  - Listens to Firestore changes                            │
│  - Updates UI when analysis completes                      │
└─────────────────────────────────────────────────────────────┘
```

## Files

### API Layer (`gcp/proxy/api`)

- **`routers/checkpoint.py`**: FastAPI router with `/analyze-checkpoint` and `/compare-checkpoints` endpoints
- **`services/checkpoint_service.py`**: Service handling Pub/Sub publishing and checkpoint comparison logic
- **`schemas/checkpoint.py`**: Pydantic models for request/response validation

### Worker Layer (`gcp/proxy/workers/function`)

- **`main.py`**: Contains `pubsub_checkpoint_analysis()` Cloud Function entry point
- **`checkpoint_service.py`**: Service that calls Gemini AI and updates Firestore

## Configuration

### Environment Variables

The API requires the following environment variable:

| Variable                    | Description                                | Example                     |
| --------------------------- | ------------------------------------------ | --------------------------- |
| `CHECKPOINT_ANALYSIS_TOPIC` | Pub/Sub topic name for checkpoint analysis | `checkpoint-analysis-topic` |
| `GCP_PROJECT_ID`            | Google Cloud Project ID                    | `homegeekdemo`              |
| `GCP_LOCATION`              | GCP location for Vertex AI                 | `us-central1`               |

### Pub/Sub Setup

1. **Create Topic:**

   ```bash
   gcloud pubsub topics create checkpoint-analysis-topic
   ```

2. **Create Subscription (for Cloud Function):**

   ```bash
   gcloud pubsub subscriptions create checkpoint-analysis-subscription \
     --topic=checkpoint-analysis-topic
   ```

3. **Grant Permissions:**
   - API service account needs `roles/pubsub.publisher` on the topic
   - Worker service account needs `roles/pubsub.subscriber` on the subscription

## Worker Function

The `pubsub_checkpoint_analysis` Cloud Function processes checkpoint analysis requests.

### Processing Flow

1. **Receives Pub/Sub Message:**
   - Parses message payload
   - Extracts `checkpointId`, `userId`, `propertyId`, `imageUrl`, `contentType`, `location`

2. **Analyzes Image:**
   - Calls `checkpoint_service.analyze_checkpoint_image()`
   - Uses Gemini 2.5 Flash model
   - Returns structured JSON:
     ```python
     {
       "summary": str,
       "conditions": List[str],
       "detectedItems": List[str],
       "issues": List[str]
     }
     ```

3. **Updates Firestore:**
   - Updates checkpoint document at path:
     ```
     users/{userId}/properties/{propertyId}/checkpoints/{checkpointId}
     ```
   - Sets `analysisStatus: "completed"`
   - Adds `aiAnalysis` field with results

4. **Error Handling:**
   - On failure, sets `analysisStatus: "failed"`
   - Logs errors for monitoring

### Worker Configuration

The worker requires these environment variables:

| Variable         | Description                | Example        |
| ---------------- | -------------------------- | -------------- |
| `GCP_PROJECT_ID` | Google Cloud Project ID    | `homegeekdemo` |
| `GCP_LOCATION`   | GCP location for Vertex AI | `us-central1`  |

The worker uses Firebase Admin SDK with default GCP service account credentials.

## Usage Examples

### Frontend (React/TypeScript)

```typescript
import { analyzeCheckpoint } from "@/lib/api";

// After creating checkpoint
const result = await createCheckpoint(data, mediaFiles);

// Trigger analysis
analyzeCheckpoint({
  imageUrl: imageMedia.gsURI,
  contentType: imageMedia.contentType,
  location: data.location,
  checkpointId: result.id,
  userId: user.uid,
  propertyId: property.id,
}).catch((err) => {
  console.error("Failed to queue analysis:", err);
});

// Listen to Firestore changes for status updates
const unsubscribe = onSnapshot(
  doc(
    db,
    `users/${userId}/properties/${propertyId}/checkpoints/${checkpointId}`
  ),
  (snapshot) => {
    const checkpoint = snapshot.data();
    if (checkpoint.analysisStatus === "completed") {
      // Show analysis results
      console.log(checkpoint.aiAnalysis);
    }
  }
);
```

### cURL Example

```bash
curl -X POST "https://your-api-url/{SECRET}/analyze-checkpoint" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "gs://bucket/path/to/image.jpg",
    "contentType": "image/jpeg",
    "location": "Kitchen",
    "checkpointId": "checkpoint-123",
    "userId": "user-456",
    "propertyId": "property-789"
  }'
```

**Expected Response:**

```json
{
  "status": "accepted",
  "message": "Analysis queued for processing",
  "checkpointId": "checkpoint-123"
}
```

## Firestore Document Structure

The checkpoint document is updated with the following structure:

```typescript
{
  // ... existing checkpoint fields ...
  analysisStatus: 'pending' | 'processing' | 'completed' | 'failed',
  aiAnalysis?: {
    summary: string;
    conditions: string[];
    detectedItems: string[];
    issues: string[];
    aiConfidence: number;
    analyzedAt: Timestamp;
  }
}
```

## Testing

### Manual Testing

1. Create a checkpoint via the mobile app
2. Check Firestore to see `analysisStatus` transition:
   - `pending` → `processing` → `completed`
3. Verify `aiAnalysis` field is populated with results

### Unit Testing

The worker function can be tested with mocked dependencies:

```python
from unittest.mock import patch, MagicMock

@patch('main.analyze_checkpoint_image')
@patch('main.firestore.client')
def test_pubsub_checkpoint_analysis(mock_firestore, mock_analyze):
    # Setup mocks
    mock_analyze.return_value = {
        "summary": "Test summary",
        "conditions": ["good"],
        "detectedItems": ["furniture"],
        "issues": []
    }

    # Call function
    # Assert Firestore update
```

## Error Handling

The API handles errors gracefully:

- **Validation Errors**: Returns 400 with descriptive message
- **Pub/Sub Errors**: Returns 500, logs error
- **Worker Errors**: Worker sets `analysisStatus: "failed"`, logs error

## Monitoring

Key metrics to monitor:

- **API Latency**: Time to publish to Pub/Sub (should be <100ms)
- **Worker Processing Time**: Time from Pub/Sub message to Firestore update
- **Success Rate**: Percentage of analyses that complete successfully
- **Error Rate**: Frequency of `analysisStatus: "failed"`

## Security

- Endpoint protected by webhook secret (`FIREBASE_WEBHOOK_SECRET`)
- Uses HTTPS in production
- Service accounts use least-privilege IAM roles
- Firestore security rules control document access

## Deployment

Deploy the worker function separately from the API:

```bash
gcloud functions deploy pubsub_checkpoint_analysis \
  --gen2 \
  --max-instances 10 \
  --concurrency 1 \
  --region us-central1 \
  --runtime python313 \
  --trigger-topic checkpoint-analysis-topic \
  --memory=512MB \
  --source gcp/proxy/workers/function \
  --entry-point pubsub_checkpoint_analysis \
  --set-env-vars GCP_PROJECT_ID=homegeekdemo \
  --set-env-vars GCP_LOCATION=us-central1
```

## Related Documentation

- [Workers README](../workers/README.md) - Background workers documentation
- [Adding Functions](./ADDING_FUNCTIONS.md) - Guide for adding new API endpoints
- [Architecture](./ARCHITECTURE.md) - System architecture overview
