# Agent evaluation (ADK)

Live agent evaluations use **web-recorded** golden files under `property_agent/evals/*.evalset.json`.

## Quick start

```bash
cd gcp/agents/homecare
make setup
uv run adk web    # record golden sessions — see property_agent/evals/README.md
make test-eval    # skips until each evalset file exists
```

## Makefile targets

| Target | Evalset file |
|--------|----------------|
| `make test-eval` | All eval tests |
| `make test-eval-routing` | `doculink_routing.evalset.json` |
| `make test-eval-docs` | `doculink_docs.evalset.json` |
| `make test-eval-checkpoint` | `checkpoint_optional_agents.evalset.json` |
| `make test-eval-cost` | `cost_agent.evalset.json` |
| `make test-eval-shopping` | `shopping_agent.evalset.json` |
| `make test-eval-service` | `service_agent.evalset.json` |

Pass thresholds: `property_agent/evals/test_config.json`.

## Unit tests vs evals

- **`make test`** — `tests/` only (mocked, CI-safe; runs on PR via `test-homecare-agent.yaml`)
- **`make test-all`** — unit tests + evals
- **`make test-eval`** — ADK evals only (Vertex/Gemini; costs tokens)

Recording instructions: **`property_agent/evals/README.md`**.
