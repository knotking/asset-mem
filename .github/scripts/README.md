# GitHub Actions helper scripts

Operational scripts invoked by workflows and runnable locally after `gcloud auth`.

| Script | Purpose |
|--------|---------|
| [`apply-pubsub-dlq.sh`](./apply-pubsub-dlq.sh) | Dead-letter topic + policies for worker Pub/Sub |
| [`apply-monitoring-alerts.sh`](./apply-monitoring-alerts.sh) | Cloud Monitoring alert policies (templates in [`docs/deployment/monitoring/policies/`](../../docs/deployment/monitoring/policies/)) |
| [`hardware_tier.py`](./hardware_tier.py) | Load tier expectations, export env vars, audit live GCP |
| [`resolve-hardware-env.sh`](./resolve-hardware-env.sh) | Resolve tier → `GITHUB_ENV` for deploy workflows |
| [`verify-production-hardware.sh`](./verify-production-hardware.sh) | Audit live hardware vs expectations |
| [`apply-production-hardware.sh`](./apply-production-hardware.sh) | Orchestrate tier deploy workflows |
| [`apply-apphosting-hardware.sh`](./apply-apphosting-hardware.sh) | gcloud run update for App Hosting backend |
| [`prod-daily-health-check.py`](./prod-daily-health-check.py) | Daily prod metrics + Vertex summary + token logging |
| [`grant-health-check-iam.sh`](./grant-health-check-iam.sh) | Create read-only `github-health-check@…` SA + WIF binding |

**Workflows:** [`create-environment.yaml`](../workflows/create-environment.yaml), [`apply-operations-config.yaml`](../workflows/apply-operations-config.yaml), [`apply-production-hardware.yaml`](../workflows/apply-production-hardware.yaml), [`daily-prod-health-check.yaml`](../workflows/daily-prod-health-check.yaml)

**Docs:** [`docs/deployment/OPERATIONS.md`](../../docs/deployment/OPERATIONS.md)
