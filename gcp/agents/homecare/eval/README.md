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
| `make test-eval-executor-routing` | `executor_routing.evalset.json` |
| `make test-eval-user-docs` | `user_docs_routing.evalset.json` |
| `make test-eval-checkpoint` | `checkpoint_optional_agents.evalset.json` |
| `make test-eval-cost` | `cost_agent.evalset.json` |
| `make test-eval-shopping` | `shopping_agent.evalset.json` |
| `make test-eval-service` | `service_agent.evalset.json` |

Pass thresholds: per-eval configs in `eval/rubric_criteria.py` (see `property_agent/evals/README.md`).

## Unit tests vs evals

| Command | What runs |
|---------|-----------|
| `make test` | `tests/` only — mocked, CI on every PR |
| `make test-all` | unit tests + ADK evals |
| `make test-eval` | ADK evals only (Vertex/Gemini; costs tokens) |

Recording and updating goldens: **`property_agent/evals/README.md`**.

## Simulation & conformance

| Command | Purpose |
|---------|---------|
| `RUN_ADK_SIMULATION_TESTS=1 make test-simulation` | Live user-simulator evals (`eval/test_simulation.py`) |
| `make conformance-record` | Record `generated-*.yaml` (needs `uv run adk web` on :8000) |
| `make conformance-test` | Replay `property_agent/conformance/` |

See **`property_agent/evals/README.md`** for scenario details.

## Legacy `eval/data/`

Removed. Older hand-authored `*.test.json` fixtures under `eval/data/` are replaced by ADK web-recorded `property_agent/evals/*.evalset.json`. Cost-agent logic is covered by unit tests in `tests/test_cost_agent.py` and `tests/test_diy_agent.py`.
