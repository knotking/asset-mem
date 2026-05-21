# Cloud Monitoring alert policies

JSON templates in `policies/` are rendered by [`.github/scripts/apply-monitoring-alerts.sh`](../../../.github/scripts/apply-monitoring-alerts.sh).

Placeholders: `__PROJECT_ID__`, `__ENV__`, `__REGION__`, `__PROXY_SERVICE__`, `__TOKEN_METRIC__`.

## Apply

```bash
export MONITORING_NOTIFICATION_CHANNEL_IDS="projects/PROJECT/notificationChannels/ID"
./.github/scripts/apply-monitoring-alerts.sh PROJECT_ID staging us-central1
```

Or GitHub Actions: [`.github/workflows/apply-operations-config.yaml`](../../../.github/workflows/apply-operations-config.yaml).

## Tuning

Edit JSON thresholds (duration, `thresholdValue`) per environment. Staging can use lower thresholds for faster feedback; prod may need higher backlog limits during traffic spikes.

See [OPERATIONS.md](../OPERATIONS.md) for the full ops runbook index.
