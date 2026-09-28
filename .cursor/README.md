# Cursor MCP — AssetMem (AssetMem AI)

Project MCP config for **GCP Cloud Logging** and **Firebase / Firestore** (token usage, billing, user data). Firebase/GCP project IDs use legacy `homegeek-*` names; see [docs/deployment/ENVIRONMENTS.md](../docs/deployment/ENVIRONMENTS.md#brand-vs-infrastructure-naming).

| Server | Purpose |
| ------ | ------- |
| `gcp-cloud-logging` | Query Cloud Run / worker / Vertex logs |
| `firebase` | Read/write Firestore via [Firebase MCP](https://firebase.google.com/docs/cli/mcp-server) (`--only firestore`) |

Config file: [`.cursor/mcp.json`](mcp.json).

---

## Firebase / Firestore MCP

Uses `firebase-tools mcp` with project directory [`apps/webapp`](../apps/webapp) (`.firebaserc` default: `homegeek-staging`, alias `prod`: `homegeek-prod`).

### One-time setup

1. **Node.js + npm** installed.
2. Sign in (same Google account that can read the Firebase project):
   ```bash
   npx firebase-tools@latest login
   ```
3. Optional — pin CLI project alias before opening Cursor:
   ```bash
   cd apps/webapp
   firebase use default    # homegeek-staging
   # firebase use prod     # homegeek-prod
   ```

IAM: your user needs Firestore read (e.g. `roles/datastore.viewer` or `roles/datastore.user`). Writes require broader roles — use read-only IAM on prod if possible.

### Verify in Cursor

1. Restart Cursor after changing `mcp.json`.
2. **Settings → MCP** — `firebase` should show connected.
3. In Agent chat, ask to use **`firestore_get_document`** for a test path, e.g. `llm_token_usage/{uid}`.

**MCP Logs:** Output panel (Cmd+Shift+U) → “MCP Logs”.

### Common Firestore paths (AssetMem)

| Path | Notes |
| ---- | ----- |
| `llm_token_usage/{userId}` | Monthly quota + usage (`periodTotalTokens`, `quotaPeriodKey`, …) — server writes only |
| `llm_token_usage/{userId}/periods/{YYYY-MM}` | Archived month snapshots |
| `users/{userId}/billing/summary` | B2C Stripe mirror (server writes; client read) |
| `users/{userId}/preferences/user` | Includes optional `monthlyTokenLimit` override |

Schema: [`gcp/common/token/README.md`](../gcp/common/token/README.md).

### Useful MCP tools

- `firestore_get_document` — one doc by path
- `firestore_list_documents` — list under a collection
- `firestore_query_collection` — filtered query
- `firebase_get_environment` — active project / auth status

Agent skill: [`.cursor/skills/firestore-homeapp/SKILL.md`](skills/firestore-homeapp/SKILL.md).

---

## GCP Cloud Logging MCP

Query AssetMem logs via [Google Cloud Logging MCP](https://cloud.google.com/logging/docs/use-logging-mcp).

### One-time GCP setup

In the target GCP project (usually `homegeek-staging` for staging; confirm prod in `docs/deployment/ENVIRONMENTS.md`):

```bash
gcloud config set project homegeek-staging

# Enable APIs (if not already)
gcloud services enable logging.googleapis.com

# Enable MCP for the project (required for remote MCP servers)
# See: https://docs.cloud.google.com/mcp/enable-disable-mcp-servers
```

IAM (ask a project admin if calls fail with permission denied):

- `roles/mcp.toolUser` — call MCP tools
- `roles/logging.viewer` (or broader logging read role) — read log entries

### Local auth (each machine)

Application Default Credentials (optional if you use OAuth):

```bash
gcloud auth application-default login
```

If you switch to OAuth for `gcp-cloud-logging`, you won't need `GCLOUD_ACCESS_TOKEN` anymore. Export the OAuth env vars for `gcp-cloud-logging` (or add to your shell profile):

```bash
export GCP_PROJECT_ID=homegeek-staging
export GCP_CLOUD_LOGGING_MCP_CLIENT_ID="..."
export GCP_CLOUD_LOGGING_MCP_CLIENT_SECRET="..."
```

If you prefer the old bearer-token style setup, refresh when MCP auth fails (ADC tokens expire about every hour):

```bash
export GCP_PROJECT_ID=homegeek-staging
export GCLOUD_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)"
```

Optional: use a Desktop OAuth client instead of static OAuth client credentials — see [Authenticate to MCP servers](https://docs.cloud.google.com/mcp/authenticate-mcp). Do not commit client secrets.

### Verify in Cursor

1. Restart Cursor after setting env vars.
2. **Settings → MCP** — ensure `gcp-cloud-logging` is enabled.
3. In Agent chat, ask to list MCP tools for `gcp-cloud-logging` or query recent proxy errors (see skill `gcp-logs-homeapp`).

### Workspace note (June 2026)

If `gcp-cloud-logging` MCP repeatedly returns permission errors despite correct IAM
(`roles/mcp.toolUser`, `roles/serviceusage.serviceUsageConsumer`, logging read role),
default to direct `gcloud` commands for this workspace.

```bash
gcloud logging read 'severity>=ERROR' --project=homegeek-staging --limit=50 --order=desc
```

### Security (all MCP servers)

- `mcp.json` uses `${env:...}` and `${workspaceFolder}` only — no tokens or service account JSON in git.
- Never commit `GCLOUD_ACCESS_TOKEN`, OAuth secrets, or Firebase service account keys.
- MCP runs as **your** Google identity with your IAM permissions.

## Related

- Firestore skill: `.cursor/skills/firestore-homeapp/SKILL.md` (also `.claude/skills/firestore-homeapp/`)
- Logging skill: `.cursor/skills/gcp-logs-homeapp/SKILL.md` (also `.claude/skills/gcp-logs-homeapp/`)
- Shell fallbacks: `docs/deployment/QUICK_REFERENCE.md` (Monitoring Commands)
