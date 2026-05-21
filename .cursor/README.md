# Cursor MCP — GCP Cloud Logging

Project MCP config for querying HomeApp logs via [Google Cloud Logging MCP](https://cloud.google.com/logging/docs/use-logging-mcp).

## One-time GCP setup

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

## Local auth (each machine)

Application Default Credentials:

```bash
gcloud auth application-default login
```

Export env vars before starting Cursor (or add to your shell profile). Tokens from ADC expire about every hour — refresh when MCP auth fails:

```bash
export GCP_PROJECT_ID=homegeek-staging
export GCLOUD_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)"
```

Optional: use a Desktop OAuth client instead of bearer tokens — see [Authenticate to MCP servers](https://docs.cloud.google.com/mcp/authenticate-mcp) and Cursor’s `auth` block in [MCP docs](https://cursor.com/docs/mcp#static-oauth-for-remote-servers). Do not commit client secrets.

## Verify in Cursor

1. Restart Cursor after setting env vars.
2. **Settings → Features → Model Context Protocol** — ensure `gcp-cloud-logging` is enabled.
3. In Agent chat, ask to list MCP tools for `gcp-cloud-logging` or query recent proxy errors (see skill `gcp-logs-homeapp`).

**MCP Logs:** Output panel (Cmd+Shift+U) → “MCP Logs”.

## Security

- `mcp.json` uses `${env:...}` only — no tokens in git.
- Never commit `GCLOUD_ACCESS_TOKEN` or OAuth secrets.
- MCP tool calls run as your Google identity with your IAM permissions.

## Related

- Agent skill: `.cursor/skills/gcp-logs-homeapp/SKILL.md` (also `.claude/skills/gcp-logs-homeapp/`)
- Shell fallbacks: `docs/deployment/QUICK_REFERENCE.md` (Monitoring Commands)
