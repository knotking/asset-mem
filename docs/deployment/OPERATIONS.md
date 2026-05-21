# Operations (Phase 3.2)

Production operations: **Pub/Sub DLQ**, **Cloud Monitoring alerts**, **incident runbooks**, and **proxy Pub/Sub shutdown** (implemented in `gcp/proxy/api/core/events.py`).

## Quick apply

### New environment

[`create-environment.yaml`](../../.github/workflows/create-environment.yaml) runs `apply-pubsub-dlq.sh` after topics/subscriptions are created.

**After first worker deploy**, re-run DLQ so Eventarc subscriptions get policies:

```bash
./.github/scripts/apply-pubsub-dlq.sh PROJECT_ID ENV
```

Or use workflow dispatch: [**Apply operations config**](../../.github/workflows/apply-operations-config.yaml).

### Existing staging / prod

1. **DLQ**
   ```bash
   ./.github/scripts/apply-pubsub-dlq.sh homegeek-staging staging
   ```
2. **Alerts** (attach notification channels first — see below)
   ```bash
   export MONITORING_NOTIFICATION_CHANNEL_IDS="projects/PROJECT_ID/notificationChannels/CHANNEL_ID"
   export PROXY_HEALTH_HOST="https://homecare-agent-proxy-staging-xxxxx.run.app"
   ./.github/scripts/apply-monitoring-alerts.sh homegeek-staging staging us-central1
   ```

GitHub environment variable (optional): `MONITORING_NOTIFICATION_CHANNEL_IDS` — comma-separated channel resource names for the apply workflow.

Create channels: Cloud Console → Monitoring → Alerting → Edit notification channels → copy resource name (`projects/.../notificationChannels/...`).

## Pub/Sub dead letter queue

| Resource | Name pattern |
|----------|----------------|
| DLQ topic | `worker-dlq-{ENV}` |
| Worker topics | `user-upload-topic-{ENV}`, `checkpoint-analysis-topic-{ENV}`, `document-analysis-topic-{ENV}`, `checkpoint-metrics-topic-{ENV}` |
| Manual subs | `user-upload-subscription-{ENV}`, `user-upload-result-subscription-{ENV}` |

Failed deliveries (default **5** attempts) forward to the DLQ topic. Inspect with:

```bash
gcloud pubsub subscriptions pull worker-dlq-{ENV}-sub \
  --project=PROJECT_ID --limit=5 --auto-ack
```

(Create a temporary pull subscription on the DLQ topic if you need to drain messages.)

Script: [`.github/scripts/apply-pubsub-dlq.sh`](../../.github/scripts/apply-pubsub-dlq.sh)

## Monitoring alerts

Policies under [`monitoring/policies/`](./monitoring/policies/):

| Policy | Purpose |
|--------|---------|
| HomeApp proxy 5xx rate | Cloud Run `homecare-agent-proxy-{ENV}` errors |
| HomeApp proxy latency p95 | Slow proxy (Vertex / cold start) |
| HomeApp Pub/Sub backlog | `num_undelivered_messages` on `*-{ENV}` subscriptions |
| HomeApp worker 5xx | Gen2 workers (`pubsub-*-{ENV}` on Cloud Run) |
| HomeApp token quota exceeded | Log-based metric for `TOKEN_QUOTA_EXCEEDED` |

Script: [`.github/scripts/apply-monitoring-alerts.sh`](../../.github/scripts/apply-monitoring-alerts.sh)

**Verify:** Monitoring → Alerting → select policy → *Test notification* or induce a synthetic 503 on staging proxy `/health` (stop Reasoning Engine client) for readiness alerts.

## Incident runbooks

| Scenario | Runbook |
|----------|---------|
| Proxy / API down, 5xx, auth failures | [runbooks/proxy-down.md](./runbooks/proxy-down.md) |
| Vertex / Reasoning Engine outage | [runbooks/vertex-outage.md](./runbooks/vertex-outage.md) |
| Worker backlog, DLQ growth, stuck checkpoints | [runbooks/worker-backlog.md](./runbooks/worker-backlog.md) |

## Proxy Pub/Sub listener shutdown

On Cloud Run scale-in or deploy, the proxy [`lifespan`](../../gcp/proxy/api/core/events.py) cancels the streaming pull and joins the listener thread (10s timeout) so in-flight callbacks are not left dangling.

## Related

- [Production Launch Checklist](./PRODUCTION_LAUNCH_CHECKLIST.md) §3
- [Launch Plan Progress](./LAUNCH_PLAN_PROGRESS.md) Phase 3
- [Workers deployment](./WORKERS_DEPLOYMENT.md#dead-letter-queue)
- [GCP logs skill](../../.claude/skills/gcp-logs-homeapp/SKILL.md)
