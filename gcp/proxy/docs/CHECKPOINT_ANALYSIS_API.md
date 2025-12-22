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
