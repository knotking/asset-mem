# Agent evaluation

ADK web-recorded `*.evalset.json` golden files and the `make test-eval*` pytest runner were **removed**.

## What to use

| Goal | Command |
|------|---------|
| Fast regression (CI) | `make test` from `gcp/agents/homecare` |
| Routing eval (live resolve LLM) | `make routing-eval` (see `evals/routing/`) |
| Manual QA | `uv run adk web` → select `property_agent`, exercise flows on staging |
| Replay fixtures | `make conformance-record` / `make conformance-test` (see `property_agent/conformance/`) |

## Routing eval (`evals/routing/`)

Phase 0 baseline harness for `docs/SINGLE_LOOP_REFACTOR_PLAN.md`. Replays
`cases.yaml` (synthetic session state + dialogue) through `call_resolve_turn_llm`
and asserts fields on the post-processed `ResolvedTurn`. Requires Vertex creds
(`.env`, like `make run`); not run in CI. Dataset schema is CI-validated by
`tests/test_routing_eval_cases.py`. Baselines live in `routing/baselines/`.

```bash
make routing-eval                          # full set
make routing-eval ARGS="--filter weblog"   # only cases from the audited session
make routing-eval ARGS="--out property_agent/evals/routing/baselines/$(date +%F).json"
```

Conformance YAML under `property_agent/conformance/` is separate from evalsets and remains supported. Per-turn message-field expectations live in `expected_messages.yaml` beside each spec; rubrics for manual scoring in `evals/rubrics/checkpoint_response.json`.
