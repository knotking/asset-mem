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
| `user_docs_routing` | `rubric_based_tool_use_quality_v1` only (`executor_invokes_route_tool`; no strict tool-arg trajectory) |
| `executor_routing` | Tool trajectory + `rubric_based_tool_use_quality_v1` (`executor_invokes_route_tool`) |
| `checkpoint_*` | Tool trajectory + `rubric_based_final_response_quality_v1` (dual-format rubrics) + `final_response_match_v2` |
| `cost` / `shopping` / `service` | Checkpoint rubrics plus branch rubrics in `property_agent/evals/rubrics/branch_*.json` |

## Golden files

| File | What to record |
|------|----------------|
| `executor_routing.evalset.json` | Substantive turn: executor calls `checkpoint_agent`, `ask_user_docs_agent`, or `ask_knowledge_base_agent` |
| `user_docs_routing.evalset.json` | `primary_agent: "docs"` and/or `context_doc_uris`; user-docs query |
| `conversational_bypass.evalset.json` | Casual phrases (hello, thanks, …) with optional-agent flags — plain text, **no** tools |
| `multi_turn_conversational.evalset.json` | Turn 1 analysis; turn 2 thanks / closure — no second analysis |
| `checkpoint_optional_agents.evalset.json` | `checkpoint_ids` + all optional branches |
| `cost_agent.evalset.json` | `checkpoint_optional_agents: ["cost"]` |
| `shopping_agent.evalset.json` | `checkpoint_optional_agents: ["diy"]` |
| `service_agent.evalset.json` | `checkpoint_optional_agents: ["service"]` |

All evalsets are recorded against **`property_agent`**. Missing files cause pytest to **skip** with recording instructions.

## Run evals locally

```bash
make test-eval
make test-eval-executor-routing
make test-eval-user-docs
make test-eval-conversational

uv run adk eval property_agent property_agent/evals/executor_routing.evalset.json \
  --config_file_path=property_agent/evals/test_config.json \
  --print_detailed_results
```

## User simulation

See `simulation.evalset.json` and `conversation_scenarios.json`. Run with `RUN_ADK_SIMULATION_TESTS=1 make test-simulation`.

## Conformance (replay)

```bash
uv run adk web
make conformance-record
make conformance-test
```

Cases under `property_agent/conformance/` include `routing/hello_plain_welcome/` and multi-turn casual follow-ups.
