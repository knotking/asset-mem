# Apply production hardware

Manual workflow: [apply-production-hardware.yaml](./apply-production-hardware.yaml)

Audits or applies **hardware-only** settings (CPU, memory, min/max instances, concurrency, timeouts) for a **traffic tier** across proxy, workers, agent, and App Hosting.

## Inputs

| Input | Description |
|-------|-------------|
| `environment` | `staging` or `prod` |
| `traffic_tier` | `idle` (default), `ph`, `scale_10x`, `scale_100x` |
| `mode` | `audit` — compare live GCP to [hardware-expectations.yaml](../../docs/deployment/hardware-expectations.yaml) (**fails** the workflow on mismatch); `apply` — orchestrate deploy workflows then **report-only** audit (mismatches are warnings + artifact, workflow stays green) |
| `run_health_checks` | Optional curl web + proxy `/health` |
| `skip_agent` / `skip_webapp` | Partial apply |
| `set_github_vars` | Persist tier vars on GitHub environment (needs admin) |

## Typical flows

### Product Hunt (T-3)

1. `mode: apply`, `traffic_tier: ph`, `environment: prod`
2. `mode: audit`, `traffic_tier: ph` — attach artifact to launch sign-off

### Post-PH wind-down

`mode: apply`, `traffic_tier: idle`, `environment: prod`

### Normal monitoring

`mode: audit`, `traffic_tier: idle` weekly on staging

## Individual deploy workflows

Each `deploy-*` workflow that touches Cloud Run, Cloud Functions, Agent Engine, or App Hosting runs **Resolve hardware tier** before deploy. You do **not** need **Apply production hardware** for a single service — defaults are:

- `traffic_tier`: **idle** (input default, or `HARDWARE_TIER`, or fallback)
- `environment`: **staging** on manual dispatch unless you select **prod**

Redeploying one service updates only that service’s hardware; caps come from [hardware-expectations.yaml](../../docs/deployment/hardware-expectations.yaml) for the chosen environment + tier.

Full prod tier matrix and GCP defaults: [PRODUCTION_HARDWARE_ALLOCATIONS.md](../../docs/deployment/PRODUCTION_HARDWARE_ALLOCATIONS.md#prod-scaling-reference).

## Apply mode orchestration

Dispatches **in parallel** (same `traffic_tier` on each), then polls every **60 seconds** until all child runs finish:

1. `deploy-homecare-agent.yaml` (`action: update`) — unless `skip_agent`
2. `deploy-homecare-agent-proxy.yaml`
3. Worker deploy workflows (checkpoint-analysis, document-analysis, metrics, user-docs, report-generation)
4. `deploy-webapp-apphosting.yaml` — unless `skip_webapp`

Total wall time is roughly the **slowest** deploy (often the agent), not the sum of all workflows. Services are independent; parallel dispatch is safe for hardware-only redeploys.

Requires `actions: write` and `checks: read` on `GITHUB_TOKEN`.

## Scripts

| Script | Role |
|--------|------|
| [hardware_tier.py](../scripts/hardware_tier.py) | Load yaml, export env, audit GCP |
| [resolve-hardware-env.sh](../scripts/resolve-hardware-env.sh) | Used by deploy workflows |
| [apply-production-hardware.sh](../scripts/apply-production-hardware.sh) | Orchestrate child workflows |
| [verify-production-hardware.sh](../scripts/verify-production-hardware.sh) | Audit wrapper |
| [apply-apphosting-hardware.sh](../scripts/apply-apphosting-hardware.sh) | gcloud run update for App Hosting backend |

## Docs

[PRODUCTION_HARDWARE_ALLOCATIONS.md](../../docs/deployment/PRODUCTION_HARDWARE_ALLOCATIONS.md)
