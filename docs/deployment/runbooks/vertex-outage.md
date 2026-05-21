# Runbook: Vertex AI / Reasoning Engine outage

## Symptoms

- Proxy `/health` → `503`, `reasoning_engine_not_initialized`
- Chat streams fail immediately or hang; logs: Vertex API errors, quota, permission denied
- Agent deploy workflow failed

## Immediate checks

1. [Google Cloud Status](https://status.cloud.google.com/) — Vertex AI / Generative AI
2. **Proxy logs:** `reasoning_engine`, `vertex`, `stream_query`, `403`, `429`, `UNAVAILABLE`
3. **Agent Engine:** Console → Vertex AI → Agent Engine → instance for `AGENT_ENGINE_ID`
4. **IAM:** Reasoning Engine service account still has required roles (see agent `make grant-permissions`)

## Common causes

| Cause | Fix |
|-------|-----|
| Agent not deployed / wrong ID | Run `deploy-homecare-agent.yaml`; update `AGENT_ENGINE_ID` on proxy env |
| API disabled | Enable `aiplatform.googleapis.com` on project |
| Quota / billing | Billing account active; request quota increase |
| Regional outage | Wait for Google; no multi-region failover in current architecture |
| RAG corpus missing | User-docs/knowledge paths fail subset of tools — redeploy corpus via create-environment / RAG steps |

## Mitigation

1. Communicate: AI chat/checkpoint analysis degraded; uploads may still queue in Pub/Sub.
2. Do **not** disable workers unless backlog threatens project — they use Gemini separately; checkpoint worker may still fail if quota is project-wide.
3. Temporary quota relief: per-user override in Firestore `users/{uid}/preferences/user.monthlyTokenLimit` (does not fix Vertex platform outage).

## Recovery

1. Redeploy agent if instance corrupted: `deploy-homecare-agent.yaml` → environment
2. Redeploy proxy after `AGENT_ENGINE_ID` stable
3. Verify: `make run` locally with same project (optional) or staging smoke chat

## Post-incident

- Capture incident window in Cloud Logging
- Review whether readiness `/health` should stay 503 until engine warm (current behavior)
