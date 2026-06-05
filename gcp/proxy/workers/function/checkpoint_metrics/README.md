# Checkpoint Metrics Worker

This worker aggregates checkpoint AI analysis results into a **property-level metrics summary** that the mobile app can subscribe to.

## Firestore output

Writes/updates:

- `users/{userId}/properties/{propertyId}/metrics/summary`

## Aggregation modes

Pub/Sub payload `mode` controls how the summary is updated:

- **`incremental`** (default from checkpoint analysis on success): reads the existing
  `metrics/summary` doc and patches it with the completed `checkpoint` snapshot in the
  payload (1 read + 1 write). Falls back to a full scan when the sliding window is full
  (60 checkpoints), the summary version mismatches, or the same `checkpointId` is
  re-applied.
- **`full`**: queries up to 60 recent checkpoints and recomputes the summary (repair /
  backfill path).

## Unit tests

Unit tests focus on the most testable logic:

- `metrics_aggregator.compute_property_metrics_from_checkpoints()` (pure computation)
- `utils.parse_pubsub_message()` (payload decoding)

### Run tests locally

From this directory:

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pytest
```

### Notes

- Tests are **offline** (no Firebase / PubSub / GCP calls).
- `aggregate_property_metrics()` itself is intentionally thin (Firestore read + write) and can be covered with mocks later if needed.


