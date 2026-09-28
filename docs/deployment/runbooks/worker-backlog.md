# Runbook: Worker backlog / Pub/Sub DLQ

## Symptoms

- Alert: **AssetMem Pub/Sub backlog** or **worker 5xx**
- Checkpoints/documents stuck in `processing` in Firestore
- Growth on topic `worker-dlq-{ENV}`

## Immediate checks

1. **Cloud Functions (Gen2)** → `pubsub-checkpoint-analysis-{ENV}`, `pubsub-document-analysis-{ENV}`, `pubsub-to-user-docs-{ENV}`, `pubsub-checkpoint-metrics-{ENV}` → Errors
2. **Pub/Sub** → Subscriptions → sort by oldest unacked age / undelivered count
3. **DLQ topic** `worker-dlq-{ENV}` — message rate > 0
4. **Token quota:** worker logs for `TokenQuotaExceeded`

## Common causes

| Cause | Fix |
|-------|-----|
| Worker deploy broken | Re-run relevant `deploy-*-analysis` / `deploy-pubsub-user-docs` workflow |
| Gemini / Vertex quota | Same as [vertex-outage.md](./vertex-outage.md); backoff |
| Poison message | Inspect DLQ payload; fix data; skip or patch subscriber |
| Missing Eventarc DLQ | Run `apply-pubsub-dlq.sh` after worker deploy |
| Firestore permission | Worker SA roles from `create-environment.yaml` |

## Mitigation

1. Scale workers: increase `max-instances` in deploy workflow env (checkpoint analysis often `10`).
2. Pause producers only if necessary (stop bulk uploads) — rare.
3. Drain DLQ after fix:
   ```bash
   gcloud pubsub topics list-subscriptions worker-dlq-ENV --project=PROJECT_ID
   # Create short-lived pull sub, inspect messages, fix root cause, ack or purge
   ```

## Recovery

1. Backlog trending down 15+ minutes
2. Spot-check: upload doc → RAG import; analyze checkpoint → Firestore result
3. Re-run `apply-pubsub-dlq.sh` if new subscriptions were created without DLQ policy

## Related deploys

- [WORKERS_DEPLOYMENT.md](../WORKERS_DEPLOYMENT.md)
- [apply-pubsub-dlq.sh](../../../.github/scripts/apply-pubsub-dlq.sh)
