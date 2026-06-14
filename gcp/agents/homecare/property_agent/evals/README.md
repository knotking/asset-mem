# Agent evaluation

**Strategy & roadmap:** [docs/AGENT_TESTING_STRATEGY.md](../../docs/AGENT_TESTING_STRATEGY.md) — audit, test pyramid, phased plan (routing eval in CI, trajectory suite, contract scoring).

ADK web-recorded `*.evalset.json` golden files and the `make test-eval*` pytest runner were **removed**.

## What to use

| Goal | Command |
|------|---------|
| Fast regression (CI) | `make test` from `gcp/agents/homecare` |
| Routing eval (single-loop) | `make routing-eval` (see `evals/routing/single_loop/cases.yaml`) |
| Full-turn A/B from web logs | `make weblog-summarize ARGS="--out property_agent/evals/routing/single_loop/baselines/weblog-ab-$(date +%F).json"` |
| Manual QA | `uv run adk web` → select `property_agent`, exercise flows on staging |
| Replay fixtures | `make conformance-record` / `make conformance-test` (see `property_agent/conformance/`) |
| Draft cases from `adk web` logs | `make weblog-extract ARGS="web-log*"` → `evals/routing/drafts/` (review, merge into `single_loop/cases.yaml`) |

### Web log → test fixtures

After manual QA with `uv run adk web`, save stdout to files like `web-log-session-1` under `gcp/agents/homecare/` (gitignored locally). Extract drafts:

```bash
make weblog-extract ARGS="web-log*"
make weblog-extract ARGS="--conformance property_agent/conformance/drafts web-log-session-3"
```

Review draft YAML under `evals/routing/drafts/`, merge into `single_loop/cases.yaml`, then `make routing-eval ARGS="--filter weblog"`. For multi-turn E2E, move conformance drafts under `property_agent/conformance/`, fill `expected_messages.yaml`, and `make conformance-record`.

## Routing eval (`evals/routing/single_loop/`)

Replays `single_loop/cases.yaml` through deterministic single-loop routing
(no separate routing LLM). **CI-gated** via `make routing-eval-ci` (baseline
`single_loop/baselines/baseline.json`). Schema validated by
`tests/test_routing_eval_cases.py`.

```bash
make routing-eval
make routing-eval-ci   # CI: run all cases + --baseline-check
make routing-eval ARGS="--filter weblog_session_1"
make routing-eval ARGS="--out property_agent/evals/routing/single_loop/baselines/$(date +%F).json"
```

Canonical CI baseline: `single_loop/baselines/baseline.json` (33/33 cases).
Dated snapshot: `single_loop/baselines/2026-06-11.json`.
Weblog cases (19) regenerated from `web-log-session-1` … `web-log-session-7` via `make weblog-extract`.
Full-turn A/B: `single_loop/baselines/weblog-ab-2026-06-11.json` (33 turns from `web-log*` vs `web-log-legacy*`).
Deterministic harness scores chip / accept-offer / casual / minimal-substantive only; use `make weblog-summarize` for end-to-end latency and tool choice from saved `adk web` stdout.

Conformance YAML under `property_agent/conformance/` is separate from evalsets and remains supported. Per-turn message-field expectations live in `expected_messages.yaml` beside each spec; rubrics for manual scoring in `evals/rubrics/checkpoint_response.json`.
