# Property Agent Architecture cutover — go/no-go, rollback, and UX parity

Use this runbook when shipping coordinated **proxy + agent** deploys after Property Agent Architecture message SSOT cutover.

**Canonical architecture:** [`gcp/agents/homecare/property_agent/ARCHITECTURE.md`](../../gcp/agents/homecare/property_agent/ARCHITECTURE.md)

---

## Pre-deploy go/no-go checklist

| # | Gate | How to verify | Owner |
|---|------|---------------|-------|
| 1 | Schema validation | `cd gcp/proxy/api && bash run_tests.sh` — `test_message_schema_validation`, `test_message_patch_contract` green | Eng |
| 2 | Legacy import guard | `cd gcp/agents/homecare && make test` — `test_no_legacy_checkpoint_imports` green | Eng |
| 3 | Reliability matrix | `test_orchestrator_v2_reliability`, `test_patch_ordering_integration` green | Eng |
| 4 | Staging smoke — full optional branches | `uv run adk web` → `property_agent`: checkpoint + `["coverage","diy","service","cost"]`; Firestore message has `contentSchemaVersion: 2`, `contentJson.analysis`, `contentMarkdown` | QA |
| 5 | Staging smoke — follow-up | Second turn “explain DIY steps”; new message markdown-only; prior message retains accordions | QA |
| 6 | Client parity | mapp + webapp render via `resolveMessageContentParts`; no fence parse hot path | QA |
| 7 | Observability baseline | Logs/metrics: `orchestrator_v2_routing`, `orchestrator_v2_ttf_structured_patch_ms`, `orchestrator.v2.message.*` visible on staging | Ops |

**No-go if:** fenced JSON reappears in `contentMarkdown`, `contentSchemaVersion != 2` on new assistant messages, or stale-patch storms (`orchestrator.v2.message.stale_revision_rejects` spike without explanation).

---

## Deploy order

1. Deploy **agent** (Vertex Reasoning Engine) — [`AGENT_DEPLOYMENT.md`](../AGENT_DEPLOYMENT.md)
2. Deploy **proxy** (Cloud Run) — [`PROXY_DEPLOYMENT.md`](../PROXY_DEPLOYMENT.md)
3. Smoke one staging chat (checklist rows 4–5)
4. Monitor 30 minutes: proxy 5xx, stream failures, token quota

Agent and proxy must ship **together** (same release window). Do not leave a mixed generation (old agent + new proxy or vice versa) in prod.

---

## Rollback

1. **Revert both** proxy and agent to last known-good revision (GitHub Actions re-run previous workflow SHA or `gcloud run services update-traffic` + Agent Engine `update` from prior artifact).
2. **Verify message schema integrity** on recent chats:
   - Existing V2 messages remain readable (`contentJson` + `contentMarkdown`).
   - New messages after rollback may omit V2 fields if rolling back to pre-V2 proxy — clients must still handle legacy prose-only messages.
3. **Do not** bulk-delete or rewrite Firestore messages during rollback.
4. If partial stream failures left `agent_stream: failed` steps, users can retry the turn; no DB migration required.

Escalation: [proxy-down.md](./proxy-down.md), [vertex-outage.md](./vertex-outage.md).

---

## Progress UX parity sign-off

Complete before marking Property Agent Architecture closed in prod (see also §12 in canonical doc):

| UX element | Expected | Sign-off |
|------------|----------|----------|
| Thinking strip | `agentSteps` during retrieval / branches / synthesis | ☐ |
| Branch badges | `contentJson.analysis.analysisStatus` pending → running → completed | ☐ |
| Progressive accordions | Partial `contentJson` before all branches finish | ☐ |
| Prose | `contentMarkdown` only; no ```json in Firestore fields | ☐ |
| Follow-up | Current turn markdown-only; prior accordions preserved | ☐ |
| Stream failure | Partial state retained; no empty rollback | ☐ |

---

## Metrics reference

| Signal | Log / metric | Target (staging baseline) |
|--------|--------------|---------------------------|
| Resolve calls / turn | `orchestrator.v2.routing.resolve_calls` | ~1 per turn |
| Follow-up prompt size | `orchestrator.v2.routing.resolve_prompt_tokens` | Context-only turns &lt; 4k estimated tokens |
| Time to first structured patch | `orchestrator.v2.message.ttf_structured_patch_ms` | Establish P95 after deploy |
| Stale writes | `orchestrator.v2.message.stale_revision_rejects` | Low; spikes only under retry storms |
| Patch rate | `orchestrator.v2.message.patch_applies` | Matches throttled persist cadence |
| Fence strips | `orchestrator.v2.message.fence_strips` | Trend → 0 (synthesis markdown-only) |

Disable metrics locally: `ORCHESTRATOR_V2_METRICS=0`.

---

## Related

- [OPERATIONS.md](../OPERATIONS.md)
- [PRODUCTION_LAUNCH_CHECKLIST.md](../PRODUCTION_LAUNCH_CHECKLIST.md)
- [runbooks/README.md](./README.md)
