# Agent evaluation

**Strategy & roadmap:** [docs/AGENT_TESTING_STRATEGY.md](../../docs/AGENT_TESTING_STRATEGY.md) — audit, test pyramid, phased plan (routing eval in CI, trajectory suite, contract scoring).

ADK web-recorded `*.evalset.json` golden files and the `make test-eval*` pytest runner were **removed**.

## What to use

| Goal | Command |
|------|---------|
| Fast regression (CI) | `make test` from `gcp/agents/homecare` |
| Routing eval (single-loop) | `make routing-eval` / `make routing-eval-ci` |
| Contract scoring (schema + rubric) | `make contract-check` |
| Trajectory eval (stub planner) | `make trajectory-eval` / `make trajectory-eval-ci` |
| Conformance guard (tool boundaries) | `make conformance-guard` / `make conformance-guard-ci` |
| Full-turn A/B from web logs | `make weblog-summarize ARGS="--out property_agent/evals/routing/single_loop/baselines/weblog-ab-$(date +%F).json"` |
| Manual QA | `uv run adk web` → select `property_agent`, exercise flows on staging |
| Replay fixtures | `make conformance-web-record` + `make conformance-record` / `make conformance-web` + `make conformance-test` |
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

## Trajectory eval (`property_agent/evals/trajectory/`)

Routing + **deterministic executor planner** (`predict_trajectory.py`) — scores
`tools_called`, `branches`, and content-json flags without Vertex LLM.
**CI-gated** via `make trajectory-eval-ci` (baseline `trajectory/baselines/baseline.json`).

```bash
make trajectory-eval
make trajectory-eval-ci
make trajectory-eval ARGS="--filter chip"
make trajectory-eval ARGS="--out property_agent/evals/trajectory/baselines/baseline.json"
```

Canonical CI baseline: `trajectory/baselines/baseline.json` (11 cases).
Seed more cases from `make weblog-extract` / `make weblog-summarize` tool-call columns.

## Conformance guard eval (`property_agent/evals/conformance/`)

Deterministic tool-boundary scenarios (no Vertex): casual-turn blocks, report-mode
blocks, invented checkpoint IDs dropped, chip branch forcing, idempotent skip.
**CI-gated** via `make conformance-guard-ci` (baseline `conformance/baselines/guard_baseline.json`).

```bash
make conformance-guard
make conformance-guard-ci
make conformance-guard ARGS="--filter report"
```

ADK multi-turn specs: `property_agent/conformance/` (15 cases). Per-turn expectations in `expected_messages.yaml`; rubrics in `evals/rubrics/checkpoint_response.json`.

**Web + replay:** `make conformance-web` then `make conformance-test` (uses `replay_validators.py` to ignore lifecycle UUID/timing noise). **Record:** `make conformance-web-record` then `make conformance-record`.
