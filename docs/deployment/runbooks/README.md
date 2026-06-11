# Incident runbooks

| Runbook | When to use |
|---------|-------------|
| [proxy-down.md](./proxy-down.md) | 5xx from API, `/health` 503, CORS/auth errors, App Hosting can’t reach proxy |
| [vertex-outage.md](./vertex-outage.md) | Reasoning Engine unavailable, agent timeouts, `reasoning_engine_not_initialized` |
| [worker-backlog.md](./worker-backlog.md) | Pub/Sub backlog alert, checkpoint/doc analysis stuck, messages in `worker-dlq-*` |
| [single-loop-cutover.md](./single-loop-cutover.md) | Property Agent Architecture message SSOT go/no-go, rollback, UX parity |

Parent index: [OPERATIONS.md](../OPERATIONS.md).
