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
make test              # pytest unit tests
make routing-eval-ci   # deterministic routing eval + baseline gate
make contract-check    # contentJson schema + deterministic rubric
make trajectory-eval-ci   # executor tool trajectory + baseline gate
make conformance-guard-ci # tool-boundary guard eval + baseline gate
make prose-judge-ci       # Phase 4 prose judge dry-run baseline gate
```

Live integration tests (`integration_external`, `RUN_EXTERNAL_DIY_SEARCH_TESTS=1`) are **not** run.

CI runs **`make test`**, **`make routing-eval-ci`**, **`make contract-check`**, **`make trajectory-eval-ci`**, **`make conformance-guard-ci`**, and **`make prose-judge-ci`** (no live Vertex / LLM).

Manual ADK replay: [nightly-homecare-conformance.yaml](nightly-homecare-conformance.yaml) (`make conformance-test`, workflow_dispatch only).

Manual live prose judge (staging Vertex): [weekly-homecare-prose-judge.yaml](weekly-homecare-prose-judge.yaml) (workflow_dispatch only).

## Local equivalent

```bash
cd gcp/agents/homecare
uv sync --extra dev
make test
make routing-eval-ci
```
