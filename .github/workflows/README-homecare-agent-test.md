# Test Homecare Agent (CI)

Workflow: [test-homecare-agent.yaml](test-homecare-agent.yaml)

**Strategy & roadmap:** [gcp/agents/homecare/docs/AGENT_TESTING_STRATEGY.md](../../gcp/agents/homecare/docs/AGENT_TESTING_STRATEGY.md) — audit, test pyramid, phased plan to add routing-eval and contract gates to CI.

## Triggers

- **Pull requests** that touch `gcp/agents/homecare/**`
- **Push to `main`** with the same path filter

## What it runs

From `gcp/agents/homecare`:

```bash
uv sync --frozen --extra dev
make test   # pytest tests/ only — no live ADK evals, no Vertex calls
```

Live integration tests (`integration_external`, `RUN_EXTERNAL_DIY_SEARCH_TESTS=1`) are **not** run.

ADK evalsets were removed; this workflow runs **`make test`** only (unit tests).

## Local equivalent

```bash
cd gcp/agents/homecare
uv sync --extra dev
make test
```
