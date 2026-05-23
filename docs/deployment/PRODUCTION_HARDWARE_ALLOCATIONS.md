# Production hardware allocations

Tiered CPU, memory, scaling, and timeouts for App Hosting, Cloud Run proxy, Cloud Functions workers, and Vertex AI Agent Engine. **Hardware only** — not product env vars, Stripe, or secrets.

**Source of truth:** [hardware-expectations.yaml](./hardware-expectations.yaml)

**Apply / audit:** GitHub Actions → [Apply production hardware](../../.github/workflows/apply-production-hardware.yaml) (see [README](../../.github/workflows/README-apply-production-hardware.md))

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

## Prod hardware summary

### App Hosting, proxy, agent

| Surface | idle | ph | scale_10x | scale_100x |
|---------|------|-----|-----------|------------|
| App Hosting cpu / MiB | default / 512 | 1 / 1024 | 2 / 2048 | 4 / 4096 |
| App Hosting min / max | 0 / 1 | 1 / 10 | 2 / 20 | 5 / 100 |
| Proxy cpu / memory | 1 / 1Gi | 2 / 2Gi | 4 / 4Gi | 8 / 8Gi |
| Proxy min / max | 0 / 2 | 1 / 10 | 2 / 30 | 5 / 100 |
| Proxy concurrency | 80 | 40 | 30 | 20 |
| Agent min / max | 0 / 2 | 1 / 5 | 2 / 15 | 5 / 50 |
| Agent CPU / memory | default | 4 / 8Gi | 4 / 8Gi | 8 / 16Gi |

### Workers (max instances)

| Worker | idle | ph | scale_10x | scale_100x |
|--------|------|-----|-----------|------------|
| checkpoint-analysis | 3 | 15 | 50 | 200 |
| document-analysis | 3 | 10 | 40 | 150 |
| checkpoint-metrics | 3 | 5 | 20 | 50 |
| user_docs | 1 | 3 | 10 | 30 |

Timeouts: checkpoint-analysis & document-analysis **300s**; user_docs **540s**; metrics **60s**.

## Runbook

### Default (idle)

Prod stays on **idle** until a spike is planned. Push-to-`main` deploys use `traffic_tier: idle` when not specified.

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
