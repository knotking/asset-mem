# Runbook: Proxy / API down

## Symptoms

- Alert: **HomeApp proxy 5xx rate** or **proxy latency p95**
- Uptime check failing on `{proxy}/health`
- Web/mapp: network errors, 502/503/504 on agent/checkpoint/document routes
- `/health` returns `503` with `reasoning_engine_not_initialized`

## Immediate checks (5 min)

1. **Cloud Run** → service `homecare-agent-proxy-{ENV}` → Logs (last 1h). Filter `severity>=ERROR`.
2. **Request sample:** `curl -sS -o /dev/null -w "%{http_code}" "https://PROXY_URL/health"`
3. **Recent deploy?** GitHub Actions → `deploy-homecare-agent-proxy` — rollback if bad release.
4. **Correlation ID:** pick `X-Request-ID` from a failed client request and search logs.

## Common causes

| Cause | Fix |
|-------|-----|
| Reasoning Engine not initialized | Redeploy agent (`deploy-homecare-agent.yaml`); confirm `AGENT_ENGINE_ID` on proxy |
| Invalid/missing env on proxy | GitHub env vars: `GCP_PROJECT_ID`, `AGENT_ENGINE_ID`, Firebase secret, CORS origins |
| Auth cutover | Clients must send `Authorization: Bearer`; check 401 rate |
| Token quota storm | Not full outage — see token quota alert; tune `TOKEN_QUOTA_PERIOD_MAX_TOKENS` |
| Cold start / quota | Increase Cloud Run min instances; check GCP quotas |

## Mitigation

1. Roll back proxy to previous revision (Cloud Run → Revisions → route 100% to last good).
2. If Vertex-only: disable heavy features in comms; keep read-only Firestore UX.
3. Page on-call; update status if external users affected.

## Recovery verification

- `/health` returns `200`
- Smoke: signup → property → one `firebase-agent-stream` (see [PRODUCT_HUNT_LAUNCH.md](../PRODUCT_HUNT_LAUNCH.md) §4)
- Error rate normal 30+ minutes

## Escalation

- GCP Cloud Run incident
- Firebase Auth outage (if 401 spike)
