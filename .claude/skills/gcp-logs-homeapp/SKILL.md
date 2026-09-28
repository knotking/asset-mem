---
name: gcp-logs-homeapp
description: >-
  Query AssetMem GCP logs via the Cloud Logging MCP server (list_log_entries) or
  gcloud logging read. Use when debugging staging/prod, Cloud Run proxy errors,
  checkpoint/document workers, Vertex Reasoning Engine, TOKEN_QUOTA_EXCEEDED,
  deployment failures, or when the user asks to pull/fetch/check GCP logs.
---

# AssetMem GCP logs

## Prerequisites

1. **MCP:** Project `.cursor/mcp.json` defines `gcp-cloud-logging` → `https://logging.googleapis.com/mcp`.
2. **Env (local):** `GCP_PROJECT_ID` and `GCLOUD_ACCESS_TOKEN` — see `.cursor/README.md`.
3. **Fallback:** `gcloud logging read` / `gcloud run services logs tail` if MCP is disabled or auth fails.

**Single project per MCP call** — `list_log_entries` fails if multiple resource projects are passed.

## GCP projects and region

Product brand is **AssetMem AI**; GCP project IDs below are legacy `homegeek-*` (unchanged by design).

| Environment | GCP project (typical)                                                                | Region        |
| ----------- | ------------------------------------------------------------------------------------ | ------------- |
| Staging     | `homegeek-staging`                                                                   | `us-central1` |
| Production  | `homegeek-staging` or `homegeek-prod` (confirm in `docs/deployment/ENVIRONMENTS.md`) | `us-central1` |

Set `GCP_PROJECT_ID` to the environment you are debugging.

## Primary MCP tool

Use **`list_log_entries`** on server `gcp-cloud-logging`:

- **filter** — Logging query language (see filters below).
- **orderBy** — e.g. `timestamp desc`.
- **pageSize** — start with `50`; increase only if needed.

Discover logs: **`list_log_names`** when unsure which log streams exist.

## AssetMem log filters

Replace `ENV` with `staging` or `prod` (and adjust project if prod uses a different GCP project).

### FastAPI proxy (Cloud Run)

```
resource.type="cloud_run_revision"
resource.labels.service_name="homecare-agent-proxy-ENV"
severity>=ERROR
```

Tail-style (shell fallback):

```bash
gcloud run services logs tail homecare-agent-proxy-staging --region us-central1 --project homegeek-staging
```

### Web app (Firebase App Hosting → Cloud Run)

```
resource.type="cloud_run_revision"
resource.labels.service_name="staging"
```

Prod web backend name may differ — list services: `gcloud run services list --region us-central1`.

### Cloud Functions (Gen2 workers)

| Worker              | Function name pattern            |
| ------------------- | -------------------------------- |
| Checkpoint analysis | `pubsub-checkpoint-analysis-ENV` |
| Checkpoint metrics  | `pubsub-checkpoint-metrics-ENV`  |
| Document analysis   | `pubsub-document-analysis-ENV`   |
| User docs → RAG     | `pubsub-to-user-docs-ENV`        |

```
resource.type="cloud_function"
resource.labels.function_name="pubsub-checkpoint-analysis-staging"
severity>=ERROR
```

Shell fallback:

```bash
gcloud functions logs read pubsub-checkpoint-analysis-staging --gen2 --region us-central1 --limit 50
```

### Vertex AI Reasoning Engine (homecare agent)

```
resource.type="aiplatform.googleapis.com/ReasoningEngine"
severity>=ERROR
```

Narrow with `resource.labels.reasoning_engine_id` from GitHub env / `AGENT_ENGINE_ID` (see `docs/deployment/AGENT_DEPLOYMENT.md`).

### Token quota / proxy denials

Search text in proxy logs:

```
resource.type="cloud_run_revision"
resource.labels.service_name="homecare-agent-proxy-staging"
("TOKEN_QUOTA_EXCEEDED" OR "token quota")
```

See skill `check-token-quota` for Firestore-side debugging.

### Broad error sweep

```
severity>=ERROR
timestamp>="2026-01-01T00:00:00Z"
```

Add `resource.type=...` to avoid noise.

## Workflow

1. Confirm **environment** (staging vs prod) and set `GCP_PROJECT_ID`.
2. Prefer **MCP `list_log_entries`** with a specific filter from the table above.
3. Summarize: error message, count, first/last timestamp, request ID or trace if present.
4. If MCP unavailable, run equivalent `gcloud logging read 'FILTER' --limit=50 --project=$GCP_PROJECT_ID --format=json`.
5. Link follow-ups: deploy workflow (`.claude/skills/deploy-via-gha`), proxy local run (`run-proxy-local`), agent deploy docs (`docs/deployment/AGENT_DEPLOYMENT.md`).

## Examples

**User:** “Show proxy errors on staging in the last hour.”

→ MCP `list_log_entries` with filter:

```
resource.type="cloud_run_revision"
resource.labels.service_name="homecare-agent-proxy-staging"
severity>=ERROR
timestamp>="YYYY-MM-DDTHH:MM:00Z"
```

**User:** “Checkpoint analysis worker failing.”

→ Filter `function_name="pubsub-checkpoint-analysis-staging"` and `severity>=ERROR`.

**User:** “Pull GCP logs for AssetMem.”

→ Ask staging vs prod if unclear, then use MCP with the matching filter; do not query multiple projects in one MCP call.
