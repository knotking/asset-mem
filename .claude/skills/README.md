# HomeApp Claude skills

Project-level skills for common dev tasks. Each subdirectory has a `SKILL.md` with YAML frontmatter (`name`, `description`) that Claude Code auto-discovers.

| Skill | Use when |
|---|---|
| [run-proxy-local](run-proxy-local/SKILL.md) | Starting / debugging the FastAPI proxy on your machine |
| [add-proxy-endpoint](add-proxy-endpoint/SKILL.md) | Adding a new route to `gcp/proxy/api` (router/service/schema, secret prefix, quota wiring) |
| [add-shared-context](add-shared-context/SKILL.md) | Adding a context, hook, or module to `@homeapp/common` for both mapp and webapp |
| [run-homecare-agent](run-homecare-agent/SKILL.md) | Running, evaluating, or deploying the Vertex AI ADK agent under `gcp/agents/homecare` |
| [run-frontends](run-frontends/SKILL.md) | Dev / build / lint / typecheck for `apps/mapp` and `apps/webapp` |
| [check-token-quota](check-token-quota/SKILL.md) | Inspecting or smoke-testing the LLM token-quota system end-to-end |
| [deploy-via-gha](deploy-via-gha/SKILL.md) | Deploying any surface — which workflow ships what, in what order |
