# Agent evaluation (removed)

ADK web-recorded `*.evalset.json` golden files and the `make test-eval*` pytest runner were **removed**.

## What to use instead

| Goal | Command |
|------|---------|
| Fast regression (CI) | `make test` from `gcp/agents/homecare` |
| Manual QA | `uv run adk web` → select `property_agent`, exercise flows on staging |
| Replay fixtures | `make conformance-record` / `make conformance-test` (see `property_agent/conformance/`) |

Conformance YAML under `property_agent/conformance/` is separate from evalsets and remains supported. Per-turn message-field expectations live in `expected_messages.yaml` beside each spec; rubrics for manual scoring in `evals/rubrics/checkpoint_response.json`.
