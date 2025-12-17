# Checkpoint Metrics Worker

This worker aggregates checkpoint AI analysis results into a **property-level metrics summary** that the mobile app can subscribe to.

## Firestore output

Writes/updates:

- `users/{userId}/properties/{propertyId}/metrics/summary`

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


