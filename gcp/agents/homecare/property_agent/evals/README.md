# Agent evaluation datasets

Golden eval sets are recorded from **ADK Web** and committed here as `*.evalset.json`.
Pytest (`eval/test_eval.py`) and `make test-eval-*` skip until each file exists.

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
4. Export or save so the file appears under this directory with the exact name below.
5. Commit the `.evalset.json` file.

Pass thresholds: `test_config.json` (`tool_trajectory_avg_score`, `response_match_score`).

## Required files (record in this order)

| File | What to record |
|------|----------------|
| `doculink_routing.evalset.json` | General property question → root delegates to `doculink_agent` |
| `doculink_docs.evalset.json` | `primary_agent: "docs"` and/or `context_doc_uris`; user-docs query |
| `checkpoint_optional_agents.evalset.json` | `checkpoint_ids` + `checkpoint_optional_agents: ["coverage","diy","service","cost"]` |
| `cost_agent.evalset.json` | E2E: `checkpoint_optional_agents: ["cost"]` → cost in checkpoint analysis |
| `shopping_agent.evalset.json` | E2E: `checkpoint_optional_agents: ["diy"]` → DIY/products path |
| `service_agent.evalset.json` | E2E: `checkpoint_optional_agents: ["service"]` → local providers path |

All evalsets are recorded against **`property_agent`** (full session). Sub-agent-only evals are not used.

## Run evals locally

```bash
# All eval tests (skips missing files)
make test-eval

# One suite (after recording that file)
make test-eval-routing

# CLI (same engine as pytest)
uv run adk eval property_agent property_agent/evals/doculink_routing.evalset.json \
  --config_file_path=property_agent/evals/test_config.json \
  --print_detailed_results
```

## CI

Use `make test-eval` on a schedule or pre-deploy only after all evalsets exist.
PR pipelines should run `uv run pytest tests/ -v` (unit tests) without evals until goldens are stable.
