# Production hardware allocations

Tiered CPU, memory, scaling, and timeouts for App Hosting, Cloud Run proxy, Cloud Functions workers, and Vertex AI Agent Engine. **Hardware only** — not product env vars, Stripe, or secrets.

**Source of truth:** [hardware-expectations.yaml](./hardware-expectations.yaml)

**Apply / audit:** GitHub Actions → [Apply production hardware](../../.github/workflows/apply-production-hardware.yaml) (see [README](../../.github/workflows/README-apply-production-hardware.md))

## How deploy workflows pick a tier

Every hardware-aware deploy workflow runs [resolve-hardware-env.sh](../../.github/scripts/resolve-hardware-env.sh) before deploy. It loads [hardware-expectations.yaml](./hardware-expectations.yaml) for the target **environment** and **traffic tier**.

**Tier resolution order** (same for proxy, agent, workers, and App Hosting):

1. `traffic_tier` workflow input (manual dispatch; UI default **idle**)
2. GitHub environment variable `HARDWARE_TIER` (optional)
3. Fallback **`idle`**

**Environment resolution:**

| Trigger | `environment` | `traffic_tier` |
|---------|---------------|----------------|
| Manual dispatch (defaults) | **staging** | **idle** |
| Manual dispatch → pick `prod` | prod | idle (unless you change tier) |
| Push to `main` (path trigger) | **staging** | **idle** (no input; uses var or fallback) |
| Apply production hardware | your input | your input |

**Workflows that apply tiers:** `deploy-homecare-agent-proxy`, `deploy-homecare-agent`, `deploy-webapp-apphosting`, and all five worker deploy workflows (checkpoint-analysis, document-analysis, checkpoint-metrics, user-docs, report-generation).

**Local agent deploy** (`make update` / `deployment/deploy.py`) does **not** run tier resolve. Set `AGENT_MIN_INSTANCES`, `AGENT_MAX_INSTANCES`, etc. in `gcp/agents/homecare/.env` or export them after `hardware_tier.py export-env` if you want caps to match CI.

**Before hardware-sizing is merged:** proxy deploy on `main` does not pass `--max-instances` (Cloud Run default **100**); worker workflows use hardcoded fallbacks (often **10**). After merge, path deploys apply [staging idle](#staging-idle-reference); prod uses [Prod scaling reference](#prod-scaling-reference) when you dispatch with `environment: prod`.

## Traffic tiers

| Tier | When to use |
|------|-------------|
| **idle** | Default prod; low/no traffic; scale-to-zero |
| **ph** | Product Hunt / marketing spike |
| **scale_10x** | Sustained ~10× PH peak traffic |
| **scale_100x** | Major scale; GCP quota review first |

### Traffic assumptions

| Tier | Peak concurrent web | Peak concurrent chats (SSE) | Checkpoint analyses/hr | Doc uploads/hr |
|------|--------------------:|----------------------------:|-------------------------:|---------------:|
| idle | &lt;10 | &lt;5 | &lt;10 | &lt;5 |
| ph | 500–2,000 | 50–200 | 200–500 | 50–150 |
| scale_10x | 5,000–20,000 | 500–2,000 | 2,000–5,000 | 500–1,500 |
| scale_100x | 50,000+ | 5,000+ | 20,000+ | 5,000+ |

## Scaling rules

| Knob | Rule |
|------|------|
| `max_instances` | Scales with tier (~10× / ~100× from PH); see yaml |
| `min_instances` | idle=0; ph=1 (web/proxy/agent); scale_10x=2; scale_100x=5 |
| Memory / CPU | Step at tier boundaries; not linear |
| Proxy `concurrency` | Lower at higher tiers (SSE): 80 → 40 → 30 → 20 |

## Prod scaling reference

Values below are **prod** tiers from [hardware-expectations.yaml](./hardware-expectations.yaml). For **staging idle** (default on push-to-`main` deploys), see [Staging idle reference](#staging-idle-reference).

**GCP defaults when deploy omits a knob** (why AssetMem idle caps matter):

| Surface | Typical GCP default (unset) |
|---------|----------------------------|
| Proxy (Cloud Run) | min **0**, max **100**; 1 CPU, 512Mi, concurrency **80** |
| Workers (Cloud Functions Gen2) | max **100** per function |
| App Hosting | min **0**; CPU/memory follow platform unless `runConfig` is set |
| Agent (Vertex AI) | min/max and CPU/memory unset in `deploy.py` → Vertex platform defaults |

AssetMem **idle** tiers keep `max_instances` low as a **cost circuit breaker**, not primary abuse protection (auth, token quota, and optional Cloud Armor handle abuse).

### App Hosting, proxy, agent

| Surface | idle | ph | scale_10x | scale_100x |
|---------|------|-----|-----------|------------|
| App Hosting cpu / MiB | default / 512 | 1 / 1024 | 2 / 2048 | 4 / 4096 |
| App Hosting min / max | 0 / 2 | 1 / 10 | 2 / 20 | 5 / 100 |
| Proxy cpu / memory | 1 / 1Gi | 2 / 2Gi | 4 / 4Gi | 8 / 8Gi |
| Proxy min / max | 0 / 2 | 1 / 10 | 2 / 30 | 5 / 100 |
| Proxy concurrency | 80 | 40 | 30 | 20 |
| Agent min / max | 0 / 2 | 1 / 5 | 2 / 15 | 5 / 50 |
| Agent CPU / memory / concurrency | default | 4 / 8Gi / 10 | 4 / 8Gi / 10 | 8 / 16Gi / 8 |

`default` = not set in yaml (`null`); platform or Vertex decides. Agent CPU/memory/concurrency are only set from **ph** upward.

### Workers

| Worker | max (idle) | max (ph) | max (scale_10x) | max (scale_100x) | memory | timeout |
|--------|----------:|---------:|----------------:|-----------------:|--------|---------|
| checkpoint-analysis | 3 | 15 | 50 | 200 | 512Mi (1Gi ph+) | 300s |
| document-analysis | 3 | 10 | 40 | 150 | 512Mi | 300s |
| checkpoint-metrics | 3 | 5 | 20 | 50 | 256Mi | 60s |
| user_docs | 1 | 3 | 10 | 30 | 512Mi | 540s |
| report-generation | 2 | 5 | 15 | 50 | 2048Mi | 540s |

All workers use concurrency **1**. Report-generation memory is **2048Mi** at every tier (Playwright PDF).

## Staging idle reference

Push-to-`main` deploys and manual workflow dispatch (default **environment: staging**, **traffic_tier: idle**) apply these caps. Full staging tiers (`ph`, etc.) are in [hardware-expectations.yaml](./hardware-expectations.yaml) (`staging:` block).

### App Hosting, proxy, agent

| Surface | staging idle |
|---------|--------------|
| App Hosting cpu / MiB | default / 512 |
| App Hosting min / max | 0 / 2 |
| Proxy cpu / memory | 1 / **512Mi** |
| Proxy min / max | 0 / 2 |
| Proxy concurrency | 80 |
| Agent min / max | default (unset in yaml) |
| Agent CPU / memory / concurrency | default (unset in yaml) |

Staging idle does **not** set Agent Engine min/max or resource limits — only prod idle (and higher prod tiers) pass `AGENT_*` from tier resolve. Proxy memory is **512Mi** on staging vs **1Gi** on prod idle.

### Workers

| Worker | max | memory | timeout |
|--------|----:|--------|---------|
| checkpoint-analysis | 3 | 512Mi | 300s |
| document-analysis | 3 | 512Mi | 300s |
| checkpoint-metrics | 3 | 256Mi | 60s |
| user_docs | 1 | 512Mi | 540s |
| report-generation | 2 | 2048Mi | 540s |

Worker idle caps match prod idle; only proxy memory and agent scaling differ on staging.

## Runbook

### Default (idle)

Prod stays on **idle** until a spike is planned. Individual deploy workflows (e.g. **Deploy Homecare Agent Proxy**) default to `traffic_tier: idle` and `environment: staging` on manual dispatch; push-to-`main` path deploys use **staging** + **idle** when inputs are absent. To apply idle caps on **prod**, dispatch with `environment: prod` or run **Apply production hardware** with `traffic_tier: idle`.

### Product Hunt (T-3)

```text
Actions → Apply production hardware
  environment: prod
  traffic_tier: ph
  mode: apply
```

Then `mode: audit` with `traffic_tier: ph` to confirm.

### Post-PH (T+7)

```text
traffic_tier: idle
mode: apply
```

### Growth

When sustained load nears PH caps: `traffic_tier: scale_10x`, `mode: apply`, then audit.

## Cost floor (always-on)

| Tier | Warm instances |
|------|----------------|
| idle | None (scale-to-zero) |
| ph | ~1 each web, proxy, agent |
| scale_10x | ~2 each |
| scale_100x | ~5 each + high max caps |

## Related

- [PRODUCT_HUNT_LAUNCH.md](./PRODUCT_HUNT_LAUNCH.md) § Timeline
- [PRODUCTION_LAUNCH_CHECKLIST.md](./PRODUCTION_LAUNCH_CHECKLIST.md) §6
- [ENVIRONMENTS.md](./ENVIRONMENTS.md)
- App Hosting overlays: `apps/webapp/hardware/tier-*.yaml`
