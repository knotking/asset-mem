# GitHub Actions helper scripts

Operational scripts invoked by workflows and runnable locally after `gcloud auth`.

| Script | Purpose |
|--------|---------|
| [`apply-pubsub-dlq.sh`](./apply-pubsub-dlq.sh) | Dead-letter topic + policies for worker Pub/Sub |
| [`apply-monitoring-alerts.sh`](./apply-monitoring-alerts.sh) | Cloud Monitoring alert policies (templates in [`docs/deployment/monitoring/policies/`](../../docs/deployment/monitoring/policies/)) |

**Workflows:** [`create-environment.yaml`](../workflows/create-environment.yaml), [`apply-operations-config.yaml`](../workflows/apply-operations-config.yaml)

**Docs:** [`docs/deployment/OPERATIONS.md`](../../docs/deployment/OPERATIONS.md)
