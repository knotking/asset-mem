# Agent evaluation (ADK)

Live agent evaluations use **web-recorded** golden files under `property_agent/evals/*.evalset.json`.

## Quick start

```bash
cd gcp/agents/homecare
make setup
uv run adk web    # record sessions — see property_agent/evals/README.md
make test-eval    # run all eval tests (live Vertex/Gemini)
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

| Command | What runs |
|---------|-----------|
| `make test` | `tests/` only — mocked, CI on every PR |
| `make test-all` | unit tests + ADK evals |
| `make test-eval` | ADK evals only (Vertex/Gemini; costs tokens) |

Recording and updating goldens: **`property_agent/evals/README.md`**.
