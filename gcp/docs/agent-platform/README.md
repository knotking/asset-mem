# Agent platform extraction

Planning docs for extracting `gcp/agent_framework` into an **ADK-agnostic, open-source agent control plane** with optional runtime adapters.

| Doc | Purpose |
|-----|---------|
| [RFC-001-extraction.md](./RFC-001-extraction.md) | Goals, scope, phases, risks, success criteria |
| [ports.md](./ports.md) | Core protocol surface (`TurnContext`, `TurnOutcome`, …) |
| [migration-matrix.md](./migration-matrix.md) | File-by-file inventory: core vs ADK adapter vs vertical |
| [composite-pipeline.md](./composite-pipeline.md) | Phase 3 composite pipeline runner (agent-platform repo) |

**Current state:** `agent_framework` is the in-monorepo platform package; `property_agent` is the homecare vertical. Boundary rule: `agent_framework` must never import `property_agent` (enforced by `agent_framework/tests/test_boundaries.py`).

**Branch:** `docs/agent-platform-extraction-plan` — planning only; no code moves yet.

**Related:**

- [`gcp/agent_framework/README.md`](../../agent_framework/README.md) — platform API today
- [`gcp/agents/homecare/property_agent/ARCHITECTURE.md`](../../agents/homecare/property_agent/ARCHITECTURE.md) — homecare mapping
