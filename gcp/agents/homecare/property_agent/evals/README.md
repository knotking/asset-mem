# Agent evaluation

ADK web-recorded `*.evalset.json` golden files and the `make test-eval*` pytest runner were **removed**.

## What to use

| Goal | Command |
|------|---------|
| Fast regression (CI) | `make test` from `gcp/agents/homecare` |
| Routing eval (executor-only) | `make routing-eval` (see `evals/routing/executor_only/cases.yaml`) |
| Full-turn A/B from web logs | `make weblog-summarize ARGS="--out property_agent/evals/routing/executor_only/baselines/weblog-ab-$(date +%F).json"` |
| Manual QA | `uv run adk web` → select `property_agent`, exercise flows on staging |
| Replay fixtures | `make conformance-record` / `make conformance-test` (see `property_agent/conformance/`) |
| Draft cases from `adk web` logs | `make weblog-extract ARGS="web-log*"` → `evals/routing/drafts/` (review, merge into `executor_only/cases.yaml`) |

### Web log → test fixtures

After manual QA with `uv run adk web`, save stdout to files like `web-log-session-1` under `gcp/agents/homecare/` (gitignored locally). Extract drafts:

```bash
make weblog-extract ARGS="web-log*"
make weblog-extract ARGS="--conformance property_agent/conformance/drafts web-log-session-3"
```

Review draft YAML under `evals/routing/drafts/`, merge into `executor_only/cases.yaml`, then `make routing-eval ARGS="--filter weblog"`. For multi-turn E2E, move conformance drafts under `property_agent/conformance/`, fill `expected_messages.yaml`, and `make conformance-record`.

## Routing eval (`evals/routing/executor_only/`)

Replays `executor_only/cases.yaml` through deterministic executor-only routing
(matches staging `HOMEAPP_EXECUTOR_ONLY_ROUTING=1`). No resolve LLM. Not run in
CI; schema validated by `tests/test_routing_eval_cases.py`.

```bash
make routing-eval
make routing-eval ARGS="--filter weblog_session_1"
make routing-eval ARGS="--out property_agent/evals/routing/executor_only/baselines/$(date +%F).json"
```

Latest baseline: `executor_only/baselines/2026-06-11.json` (33/33 deterministic routing cases).
Full-turn A/B: `executor_only/baselines/weblog-ab-2026-06-11.json` (33 turns from `web-log*` vs `web-log-legacy*`).
Compare resolve-LLM baseline at `evals/routing/baselines/2026-06-10.json` (39/42; includes LLM latency).
Deterministic harness scores chip / accept-offer / casual / minimal-substantive only; use `make weblog-summarize` for end-to-end latency and tool choice from saved `adk web` stdout.

Conformance YAML under `property_agent/conformance/` is separate from evalsets and remains supported. Per-turn message-field expectations live in `expected_messages.yaml` beside each spec; rubrics for manual scoring in `evals/rubrics/checkpoint_response.json`.
