# Agent testing strategy

Audit and phased plan to align homecare agent tests with industry-standard LLM/agent evaluation practice. Written 2026-06-14 after review of `tests/`, `property_agent/evals/`, `property_agent/conformance/`, and CI (`test-homecare-agent.yaml`).

**Related docs:** [`tests/README.md`](../tests/README.md), [`property_agent/evals/README.md`](../property_agent/evals/README.md), [`property_agent/ARCHITECTURE.md`](../property_agent/ARCHITECTURE.md), [`.github/workflows/README-homecare-agent-test.md`](../../../.github/workflows/README-homecare-agent-test.md).

---

## Executive summary

HomeApp’s homecare agent has **strong L0/L1 coverage** (~70 pytest modules, CI-safe, heavily mocked). That matches industry practice for deterministic agent plumbing (guards, state merge, parsers, parallel orchestration).

The main gap versus production-grade agent testing is now **L4**: qualitative eval and nightly replay with committed recordings are still manual. Phases 1–3 deterministic gates (routing, contract, trajectory, conformance guard) run in CI.

**Next:** enable nightly conformance pass-rate gate; run weekly live prose judge on staging; LangSmith trace export (Phase 4 remainder).

---

## Current state (audit)

### Test pyramid today

| Layer | What | CI? | Industry fit |
|-------|------|-----|--------------|
| **L0 — Unit** | `tests/` + `gcp/agent_framework/tests/` — routing, guards, assembler, leaf agents, streaming | Yes (`make test` on every PR) | Strong |
| **L1 — Component (mocked LLM)** | Cost/DIY/media refiner with mocked `generate_content`; executor tools with mocked pipeline | Yes | Good |
| **L2 — Offline dataset eval** | `evals/routing/single_loop/cases.yaml` (33 cases), `make routing-eval-ci` | Yes — baseline gate | Good |
| **L3 — Trajectory / E2E replay** | ADK conformance (15 specs), guard eval (7 cases), `make conformance-test` | Guard + spec validation in CI; replay nightly (alert-only) | Good skeleton |
| **L4 — Qualitative / live** | Rubric JSON, weblog A/B, opt-in SerpAPI/YouTube | No — manual | Ad hoc |

### Strengths (already industry-aligned)

1. **CI-safe by default** — No Vertex/LLM in PR checks; live tests gated by `integration_external` + `RUN_EXTERNAL_DIY_SEARCH_TESTS=1` (`test-homecare-agent.yaml`).
2. **Deterministic control-plane tests** — Single-loop routing, chip/accept-offer, tool guards, `ResolvedTurn` state application (`test_single_loop_routing.py`, `test_resolve_turn.py`, `test_checkpoint_tool_guards.py`).
3. **Contract thinking started** — `expected_messages.yaml` per conformance case; `evals/rubrics/checkpoint_response.json` for structured output.
4. **Regression artifacts** — Routing baselines (`evals/routing/single_loop/baselines/`), weblog A/B summaries.
5. **Platform/domain split** — `agent_framework` tests separate from homecare domain tests.

### Gaps vs industry standards

| Gap | Risk | Notes |
|-----|------|-------|
| **No executor trajectory eval** | Wrong tool or branches on substantive turns | Post–single-loop refactor, executor LLM is the authority; routing eval only covers deterministic pre-routing |
| **Routing eval not executed in CI** | Routing regressions ship silently | Only YAML schema is validated in `test_routing_eval_cases.py` |
| **Conformance not in CI** | Multi-turn E2E breaks undetected | 5 specs; `generated-recordings.yaml` often missing locally |
| **Rubric not automated** | `contentJson` / dual-format regressions | Rubric exists but no scorer wired to pytest or CI |
| **No JSON Schema for `contentJson`** | Client/UI contract drift | Tests check keys ad hoc, not full schema |
| **Fragmented eval pipeline** | Hard to answer “did we regress?” | Four separate tools + manual QA |
| **No eval versioning / thresholds** | Baselines exist but aren’t gated | Industry norm: pass-rate + latency SLOs per suite |
| **Thin adversarial coverage** | Injection, invented IDs, report-mode bypass | Some guard tests exist; no dedicated adversarial suite |
| **Removed ADK evalsets** | Intentional cost tradeoff | Industry still expects a replacement trajectory layer |

### Architecture note (single-loop)

After single-loop cleanup, **substantive ambiguous turns** fall through to `minimal_substantive_resolved_turn` and **executor LLM tool choice**. Routing eval (`run_routing_eval.py`) mirrors routing **without ADK/LLM** — correct for chip, accept-offer, and casual regex paths, but **does not validate executor tool selection** on free-text substantive queries.

Deterministic harness scores: chip, accept-offer, casual, minimal-substantive `ResolvedTurn` only. Use `make weblog-summarize` for end-to-end latency and tool choice from saved `adk web` stdout.

---

## Industry-standard target model

Use a **4-tier agent test pyramid** (common across Google ADK, LangSmith, Braintrust, and production agent teams):

```
┌─────────────────────────────────────────────────────────────┐
│  CI on every PR                                              │
│  L0 Unit → L1 Mocked LLM → L2a Routing dataset              │
│                          → L2b Output contract / JSON schema │
├─────────────────────────────────────────────────────────────┤
│  Nightly / pre-release                                       │
│  L3 Trajectory replay (tool sequence + fixtures)             │
│  L4a Latency/cost regression from baselines                  │
├─────────────────────────────────────────────────────────────┤
│  Weekly / staging                                            │
│  L4b LLM-judge or human rubric on sample                     │
│  L4c Live integration smoke (SerpAPI, YouTube)               │
└─────────────────────────────────────────────────────────────┘
```

### LLM usage by strategy

Terms like **trajectory** and **LLM-as-judge** are common in agent eval; **conformance** is ADK-specific (Google replay harness). Layer labels (L0–L4) are HomeApp framing, not a single official standard.

| Strategy | Command / artifact | Real Vertex/Gemini? | Mocked LLM? | When | Notes |
|----------|-------------------|---------------------|-------------|------|-------|
| **L0 — Unit** | `make test` (`tests/`, `agent_framework/tests/`) | No | No | Every PR | Guards, parsers, state merge, orchestration — no inference |
| **L1 — Component** | `make test` (cost, DIY, media refiner, executor tools) | No | Yes | Every PR | Exercises `generate_content` / pipeline code paths with fakes |
| **L2a — Routing eval** | `make routing-eval-ci` | No | No | Every PR | Deterministic pre-routing only; no executor tool choice |
| **L2b — Contract / rubric** | `make contract-check` (schema + deterministic rubric) | No | No | Every PR | Structural checks on `contentJson`; no prose judging |
| **L2 — Trajectory eval** | `make trajectory-eval-ci` | No | Yes (stub planner) | Every PR | Asserts `tools_called` / branches without calling Gemini |
| **L3 — Conformance guard** | `make conformance-guard-ci` | No | Yes | Every PR | Tool-boundary negatives (report mode, casual, idempotency) |
| **L3 — Conformance replay** | `make conformance-test` (ADK replay) | Usually no | No | Nightly / manual | Replays `generated-recordings.yaml`; live model only if recordings missing |
| **L3 — Conformance record** | `make conformance-record` + `uv run adk web` | **Yes — full stack** | No | Manual / staging | Records real multi-turn traces for replay |
| **L3 — Manual QA** | `uv run adk web` | **Yes — full stack** | No | Manual / staging | End-to-end executor + pipeline + branch agents |
| **L4a — Weblog A/B** | `make weblog-summarize` | No | No | Release / on demand | Parses saved `adk web` logs; no new inference |
| **L4b — LLM-judge** | Rubric `content_markdown_prose` (Phase 4) | **Yes — evaluator LLM** | No | Weekly / sample | Second model (or human) scores prose quality |
| **L4c — Live external** | `RUN_EXTERNAL_DIY_SEARCH_TESTS=1` pytest | No Gemini | No | Weekly / opt-in | SerpAPI / YouTube only |

**PR CI target (Phases 1–2):** zero real Vertex calls — stub or mock only.

#### Production LLM touchpoints (live eval paths only)

When conformance record, `adk web`, or incomplete replay runs against a live agent:

| Call site | Trigger |
|-----------|---------|
| Root executor (`SINGLE_LOOP_GEMINI_MODEL`) | Substantive turns — tool choice |
| `pending_offer_extract` | After optional-branch analysis completes |
| `run_checkpoint_pipeline` → synthesis, media refiner | `analyze_checkpoints` with retrieval + branches |
| Branch agents (`coverage`, `service` via `AgentTool`; DIY `steps_llm`; cost `ai_cost_estimator`) | Optional branch runs inside pipeline |
| `user_docs_retrieval` | Docs route |
| `conversation_summary` | Only when `HOMEAPP_CONVERSATION_SUMMARY=1` (off by default) |

#### Rubric criteria vs LLM

| Criterion (`checkpoint_response.json`) | Automated without LLM? |
|----------------------------------------|------------------------|
| `content_json_analysis_shape` | Yes |
| `no_dual_format_fences` | Yes |
| `schema_version` | Yes |
| `follow_up_markdown_only` | Yes |
| `content_markdown_prose` | No — needs LLM-judge or human (Phase 4) |

### Principles

1. **Separate dimensions** — Score routing, trajectory (tools), structure (`contentJson`), and prose independently.
2. **Versioned datasets** — YAML/JSON cases with `id`, `tags`, `version`, baselines checked into git.
3. **Deterministic first, LLM second** — CI stays offline; LLM eval is scheduled, not per-PR (unless stubbed).
4. **Trajectory before prose** — Assert `tools_called`, `branches`, `retrieval_only` before judging markdown quality.
5. **Tolerance for non-determinism** — `any_of`, set equality, schema subsets (already used: `run_optional_agents_any_of`).

### What not to do

1. **Don’t reintroduce full ADK evalsets in CI** — cost and flakiness; removed intentionally.
2. **Don’t LLM-judge in every PR** — keep qualitative eval scheduled.
3. **Don’t merge routing + trajectory + conformance into one YAML** — different dimensions, different runners.
4. **Don’t assert exact markdown prose in CI** — assert structure, tool trajectory, and key fields only.

---

## Phased implementation plan

### Phase 1 — Quick wins (1–2 weeks, no new infra)

**Goal:** Close the biggest CI holes without Vertex cost.

| Action | Detail |
|--------|--------|
| Run `routing-eval` in CI | Add job step after `make test`. Fail on mismatch vs committed baseline. |
| Formalize pytest markers | Extend `pyproject.toml`: `unit`, `integration_external`, `conformance`, `eval_dataset`, `slow`. Document in `tests/README.md`. |
| Automate rubric (deterministic criteria) | Scorer for rubric IDs that need no LLM: `content_json_analysis_shape`, `no_dual_format_fences`, `schema_version`. Wire to conformance `expected_messages.yaml`. |
| `contentJson` JSON Schema | Add `property_agent/schemas/content_json_v2.json`; pytest validates fixtures + conformance expectations. |
| Expand routing dataset tags | Tag cases: `casual`, `chip`, `accept_offer`, `minimal_substantive`, `weblog`. Track pass rate per tag in baseline JSON. |

**CI gate after Phase 1:**

```bash
make test && make routing-eval-ci && make contract-check
```

### Phase 2 — Trajectory eval suite (2–4 weeks)

**Goal:** Offline agent eval for executor behavior.

Create `property_agent/evals/trajectory/`:

```yaml
# cases.yaml (example shape)
cases:
  - id: summarize_selected_checkpoints
    tags: [checkpoint, retrieval_only]
    state:
      checkpoint_ids: ["CKPT..."]
      primary_agent: checkpoint
    user_query: "Summarize issues for selected checkpoints"
    expect:
      tools_called: []          # answer from session context
      retrieval_only: true
      content_json_absent: true

  - id: run_cost_after_diy
    tags: [checkpoint, branch_explicit]
    state:
      <<: *prior_diy_only
      pending_user_action: { kind: run_branch, ... }
    user_query: "yes"
    expect:
      tools_called: ["analyze_checkpoints"]
      branches: ["cost"]
      content_json_present: true
```

**Implementation options:**

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **A. Stub executor LLM** | CI-safe, fast | Must maintain stub responses per case | **CI default** |
| **B. ADK conformance replay** | ADK-native, real traces | Needs recordings; flaky with model updates | **Nightly on staging** |
| **C. Recorded traces from weblog** | Realistic | Brittle, high maintenance | Bootstrap only |

Reuse `extract_weblog_cases.py` and `summarize_weblog_ab.py` to seed trajectory cases from `web-log-session-*`.

### Phase 3 — Conformance & E2E hardening (2–3 weeks)

| Action | Detail | Status |
|--------|--------|--------|
| Grow conformance catalog | 15 cases: greeting, inventory, branches, multi-turn follow-up, user_docs, report, accept-offer | **Done** |
| Guard eval harness | `guard_cases.yaml` + `make conformance-guard-ci` (7 deterministic negatives) | **Done** |
| Spec + rubric CI | All 15 `expected_messages.yaml` in `make contract-check` | **Done** |
| Nightly conformance job | `nightly-homecare-conformance.yaml` → `make conformance-test` (manual dispatch, alert-only) | **Done** (scaffold) |
| Check in recordings | Commit `generated-recordings.yaml` per spec via `make conformance-record` | Pending |

### Phase 4 — Observability-linked eval (optional, 4+ weeks)

| Action | Detail | Status |
|--------|--------|--------|
| Eval dashboard | `make eval-dashboard` aggregates routing/trajectory/guard baselines + weblog p95 latency | **Done** |
| Turn trace export | `make export-turn-traces` normalizes adk web logs to JSON traces | **Done** |
| Prose LLM-judge | `evals/judge/` — dry-run in CI; live via `make prose-judge-live` / weekly workflow | **Done** (skeleton) |
| Weekly workflow | `weekly-homecare-prose-judge.yaml` — live judge + dashboard (manual dispatch) | **Done** (scaffold) |
| LangSmith dataset store | Export traces to LangSmith for L4 dashboards | Pending |
| Human review loop | Sample failures from weekly judge for calibration | Pending |

---

## Recommended CI matrix

| Job | When | Commands | Blocks merge? |
|-----|------|----------|---------------|
| **unit** | Every PR | `make test` | Yes |
| **routing-eval** | Every PR | `make routing-eval-ci` | Yes |
| **contract** | Every PR | `make contract-check` | Yes |
| **trajectory-eval** | Every PR | `make trajectory-eval-ci` | Yes |
| **conformance-guard** | Every PR | `make conformance-guard-ci` | Yes |
| **conformance-replay** | Manual (`workflow_dispatch`) | `make conformance-test` (staging creds) | Alert only initially |
| **live-external** | Weekly | `RUN_EXTERNAL_DIY_SEARCH_TESTS=1` subset | No |
| **weblog-ab** | On demand / release | `make weblog-summarize` vs last baseline | Release gate |

---

## Proposed dataset layout

```
property_agent/evals/
├── routing/single_loop/       # existing — pre-routing ResolvedTurn
├── trajectory/                # NEW — executor tool sequences
│   ├── cases.yaml
│   └── baselines/
├── contracts/                 # NEW — contentJson fixtures + JSON schema
│   ├── content_json_v2.schema.json
│   └── golden_messages/
├── rubrics/                   # existing — wire to automated scorer
├── observability/             # Phase 4 — dashboard + turn trace export
│   └── baselines/dashboard.json
├── judge/                     # Phase 4 — prose LLM-judge dataset + runner
│   ├── prose_cases.yaml
│   └── baselines/prose_baseline.json
└── README.md

property_agent/conformance/    # multi-turn E2E (grow to ~20)
tests/
├── eval/                      # routing schema, trajectory schema (future)
└── integration/               # diy_external, conformance wrappers (future)
```

---

## Metrics & acceptance criteria

| Metric | Initial target |
|--------|----------------|
| Routing eval pass rate | 100% (deterministic) |
| Trajectory tool accuracy | ≥95% on stubbed CI set |
| `contentJson` schema compliance | 100% on golden fixtures |
| Conformance replay (nightly) | ≥90% (allow model drift initially) |
| p95 routing eval latency | <50ms |
| Regression policy | No baseline regression without explicit bump PR |

---

## Priority ranking

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Run `routing-eval` in CI with baseline gate | Low | High — **done** (`make routing-eval-ci`) |
| **P0** | JSON Schema + deterministic rubric scorer | Medium | High — **done** (`make contract-check`) |
| **P1** | Trajectory eval suite (stubbed executor) | Medium | Very high — **done** (`make trajectory-eval-ci`, 11 cases) |
| **P1** | Expand conformance + guard eval | Medium | High — **done** (15 specs, `make conformance-guard-ci`) |
| **P1** | Commit conformance recordings | Medium | High — pending `make conformance-record` |
| **P2** | Nightly conformance replay job | Low | Medium — **done** (scaffold; alert-only) |
| **P3** | LangSmith / LLM-judge for prose | High | Medium — **skeleton done** (`make prose-judge`, weekly workflow) |

---

## Commands reference (today)

| Goal | Command |
|------|---------|
| Fast regression (CI) | `make test` from `gcp/agents/homecare` |
| Routing eval (deterministic) | `make routing-eval` |
| Conformance guard | `make conformance-guard-ci` |
| Full-turn A/B from web logs | `make weblog-summarize ARGS="--out ..."` |
| Manual QA | `uv run adk web` → `property_agent` on staging |
| Replay fixtures | `make conformance-web-record` + `make conformance-record` / `make conformance-web` + `make conformance-test` |
| Eval dashboard (Phase 4) | `make eval-dashboard` |
| Turn trace export | `make export-turn-traces ARGS="web-log* --out ..."` |
| Prose judge (dry / live) | `make prose-judge` / `make prose-judge-live` |
| Draft cases from logs | `make weblog-extract ARGS="web-log*"` |
| Live SerpAPI/YouTube (opt-in) | `RUN_EXTERNAL_DIY_SEARCH_TESTS=1 uv run pytest tests/test_diy_external_integration.py -v` |
