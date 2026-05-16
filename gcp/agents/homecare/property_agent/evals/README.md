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

Pass thresholds: `test_config.json` (`tool_trajectory_avg_score` ≥ 0.8, `response_match_score` ≥ 0.6).

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

## CI

- **Pull requests:** `.github/workflows/test-homecare-agent.yaml` runs `make test` (unit tests only).
- **Evals:** `make test-eval` locally; optional nightly/pre-deploy workflow (not on every PR).
