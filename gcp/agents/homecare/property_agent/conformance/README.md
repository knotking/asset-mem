# ADK conformance catalog (`property_agent/conformance/`)

Multi-turn E2E specs for `uv run adk conformance test` (replay mode). Each case folder contains:

| File | Purpose |
|------|---------|
| `spec.yaml` | Human-authored test spec (`agent`, `user_messages`, `initial_state`) |
| `expected_messages.yaml` | Per-turn `contentJson` / `contentMarkdown` contract expectations |
| `generated-recordings.yaml` | Recorded LLM responses (replay); create via `make conformance-record` |
| `generated-session.yaml` | Recorded session snapshot for replay validation |

## Recording (local / staging)

**Terminal 1** — web with record plugin:

```bash
cd gcp/agents/homecare
make conformance-web-record
```

**Terminal 2** — record all specs (requires Vertex ADC + staging `.env`):

```bash
make conformance-record
# Real Firebase user + Firestore data:
CONFORMANCE_USER_ID=NHnSq8V6BsWpREpm56tpCheADsr1 make conformance-record
```

`make conformance-record` sets the ADK **session** user (not the adk web UI picker). Record and test must use the **same** `CONFORMANCE_USER_ID`.

Plugins are registered via `HOMEAPP_ADK_CONFORMANCE_PLUGINS` in `runtime/app_config.py` (see `property_agent/plugins.yaml`).

## Replay (local)

**Terminal 1:**

```bash
make conformance-web
```

**Terminal 2:**

```bash
make conformance-test
# Must match the user_id used when recording:
CONFORMANCE_USER_ID=NHnSq8V6BsWpREpm56tpCheADsr1 make conformance-test
```

`make conformance-test` uses HomeApp-aware compare (`evals/conformance/replay_validators.py`) that ignores volatile `homeappLifecycle`, timing, and UUID fields.

For manual record + replay in one server: `make conformance-web-both`.

Replay skips cases without `generated-recordings.yaml`. CI runs **guard eval** and **spec/contract validation** without recordings.

## Catalog

| Case | Category | Turns | Tags | Recording |
|------|----------|-------|------|-----------|
| `hello_plain_welcome` | routing | 1 | casual, greeting | optional |
| `capabilities_what_can_you_do` | routing | 1 | casual, capabilities | optional |
| `inventory_list_checkpoints` | routing | 1 | checkpoint, inventory | optional |
| `docs_policy_water_damage` | routing | 1 | user_docs | optional |
| `report_summarize` | routing | 1 | report | optional |
| `chip_run_diy` | routing | 1 | chip, diy | optional |
| `accept_offer_cost_yes` | multi_turn | 1 | accept_offer, cost | optional |
| `inventory_then_summarize` | multi_turn | 2 | inventory, context | optional |
| `summarize_then_which_areas` | multi_turn | 2 | context, follow_up | optional |
| `docs_then_lease_follow_up` | multi_turn | 2 | user_docs, follow_up | optional |
| `thanks_after_service_analysis` | multi_turn | 2 | casual, service | optional |
| `got_it_after_analysis` | multi_turn | 2 | casual, analysis | optional |
| `casual_after_service_analysis` | multi_turn | 2 | casual, service | optional |
| `explain_prior_after_cost_diy` | multi_turn | 2 | context, cost, diy | optional |
| `chip_cost_then_thanks` | multi_turn | 2 | chip, cost, casual | optional |

**Guard scenarios (deterministic, CI):** `property_agent/evals/conformance/guard_cases.yaml` — `make conformance-guard-ci`.
