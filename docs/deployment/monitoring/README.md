# Cloud Monitoring alert policies

JSON templates in `policies/` are rendered by [`.github/scripts/apply-monitoring-alerts.sh`](../../../.github/scripts/apply-monitoring-alerts.sh).

Placeholders: `__PROJECT_ID__`, `__ENV__`, `__REGION__`, `__PROXY_SERVICE__`, `__TOKEN_METRIC__`, `__PROXY_REQUEST_METRIC__`.

## Apply

```bash
export MONITORING_NOTIFICATION_CHANNEL_IDS="projects/PROJECT/notificationChannels/ID"
./.github/scripts/apply-monitoring-alerts.sh PROJECT_ID staging us-central1
```

Or GitHub Actions: [`.github/workflows/apply-operations-config.yaml`](../../../.github/workflows/apply-operations-config.yaml).

## Tuning

Edit JSON thresholds (duration, `thresholdValue`) per environment. Staging can use lower thresholds for faster feedback; prod may need higher backlog limits during traffic spikes.

**Proxy latency:** Uses `AND_WITH_MATCHING_RESOURCE` — p95 > 30s only fires when a log-based HTTP request metric shows active traffic. `evaluationMissingData: INACTIVE` avoids false positives when Cloud Run stops emitting `request_latencies` on idle services (re-apply after editing `proxy-latency.json`).

See [OPERATIONS.md](../OPERATIONS.md) for the full ops runbook index.
