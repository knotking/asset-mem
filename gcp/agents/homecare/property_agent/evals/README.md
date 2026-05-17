# Agent evaluation datasets

Golden eval sets are recorded from **ADK Web** and committed here as `*.evalset.json`.
Pytest (`eval/test_eval.py`) runs them via `make test-eval` / `make test-eval-*`.

## Setup

```bash
cd gcp/agents/homecare
make setup
gcloud auth application-default login
uv run adk web
```

Select **`property_agent`** in the UI.

## Recording workflow

1. Run a **complete** session (agent finishes; tools and final answer visible).
2. Open the **Eval** tab → create or select an eval set.
3. **Add current session** → edit reference text / trim turns if needed.
4. Save under this directory with the exact filename below.
5. Commit the `.evalset.json` file.

Pass thresholds depend on the eval (see `eval/rubric_criteria.py`):

| Eval | Criteria |
|------|----------|
| `doculink_docs` | `test_config.json`: tool trajectory (IN_ORDER) ≥ 0.8, ROUGE ≥ 0.6 |
| `doculink_routing` | Tool trajectory + `rubric_based_tool_use_quality_v1` (transfer to doculink) |
| `checkpoint_*` | Tool trajectory + `rubric_based_final_response_quality_v1` (dual-format rubrics) + `final_response_match_v2` |
| `cost` / `shopping` / `service` | Checkpoint rubrics plus branch rubrics in `property_agent/evals/rubrics/branch_*.json` |

`evaluate_full_response` is set on rubric criteria for forward compatibility when ADK merges [PR #5316](https://github.com/google/adk-python/pull/5316).

## Golden files

| File | What to record |
|------|----------------|
| `doculink_routing.evalset.json` | Root → `doculink_agent` (e.g. `primary_agent: "checkpoint"`, simple greeting; expect `transfer_to_agent` then `checkpoint_agent`) |
| `doculink_docs.evalset.json` | `primary_agent: "docs"` and/or `context_doc_uris`; user-docs query |
| `checkpoint_optional_agents.evalset.json` | `checkpoint_ids` + `checkpoint_optional_agents: ["coverage","diy","service","cost"]` |
| `cost_agent.evalset.json` | E2E: `checkpoint_optional_agents: ["cost"]` → cost in checkpoint analysis |
| `shopping_agent.evalset.json` | E2E: `checkpoint_optional_agents: ["diy"]` → DIY/products path |
| `service_agent.evalset.json` | E2E: `checkpoint_optional_agents: ["service"]` → local providers path |

All evalsets are recorded against **`property_agent`** (full session). Cost/shopping/service files are end-to-end checkpoint flows, not isolated sub-agent modules.

**Unit tests** for cost logic (library slice, mocks): `tests/test_diy_agent.py` (`test_cost_estimation_diy_from_library`, etc.).

## Run evals locally

```bash
make test-eval              # all six eval tests (~3 min, live Vertex)
make test-eval-routing      # one file

uv run adk eval property_agent property_agent/evals/doculink_routing.evalset.json \
  --config_file_path=property_agent/evals/test_config.json \
  --print_detailed_results
```

Missing evalset files cause pytest to **skip** that test with recording instructions.

## User simulation (ADK 1.25+)

**`simulation.evalset.json`** uses `conversation_scenario` (LLM user simulator) instead of a fixed golden `final_response`. Scenario definitions are also listed in **`conversation_scenarios.json`**.

```bash
export RUN_ADK_SIMULATION_TESTS=1
make test-simulation
```

Criteria: `test_config_simulation.json` / `eval/rubric_criteria.config_simulation()` — `multi_turn_task_success_v1`, routing tool rubrics, `safety_v1`, `hallucinations_v1`, and `user_simulator_config`.

```bash
uv run adk eval property_agent property_agent/evals/simulation.evalset.json \
  --config_file_path=property_agent/evals/test_config_simulation.json \
  --print_detailed_results
```

## Conformance (replay)

Deterministic replay tests live under **`property_agent/conformance/`** (`spec.yaml` per case). Record fixtures with ADK web running, then replay:

```bash
uv run adk web          # terminal 1 (default http://127.0.0.1:8000)
make conformance-record # terminal 2 — writes generated-recordings.yaml
make conformance-test   # replay; skips cases without recordings
```

## CI

- **Pull requests:** `.github/workflows/test-homecare-agent.yaml` runs `make test` (unit tests only).
- **Evals:** `make test-eval` locally; optional nightly/pre-deploy workflow (not on every PR).
