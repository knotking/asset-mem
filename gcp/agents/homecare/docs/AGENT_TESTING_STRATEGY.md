# Agent testing strategy

Audit and phased plan to align homecare agent tests with industry-standard LLM/agent evaluation practice. Written 2026-06-14 after review of `tests/`, `property_agent/evals/`, `property_agent/conformance/`, and CI (`test-homecare-agent.yaml`).

**Related docs:** [`tests/README.md`](../tests/README.md), [`property_agent/evals/README.md`](../property_agent/evals/README.md), [`property_agent/ARCHITECTURE.md`](../property_agent/ARCHITECTURE.md), [`.github/workflows/README-homecare-agent-test.md`](../../../.github/workflows/README-homecare-agent-test.md).

---

## Executive summary

HomeApp’s homecare agent has **strong L0/L1 coverage** (~70 pytest modules, CI-safe, heavily mocked). That matches industry practice for deterministic agent plumbing (guards, state merge, parsers, parallel orchestration).

The main gap versus production-grade agent testing is **L2–L4**: no CI-gated **trajectory eval** (which tools were called, in what order), no automated **output-contract** scoring, and conformance/replay runs only manually. Eval tooling is fragmented across routing YAML, ADK conformance, weblog parsers, and manual `adk web`.

**Highest-leverage next step:** add a **trajectory eval suite** (stubbed executor in CI) because the single-loop architecture delegates substantive free-text turns to the executor LLM — routing eval alone no longer represents full turn behavior.

---

## Current state (audit)

### Test pyramid today

| Layer | What | CI? | Industry fit |
|-------|------|-----|--------------|
| **L0 — Unit** | `tests/` + `gcp/agent_framework/tests/` — routing, guards, assembler, leaf agents, streaming | Yes (`make test` on every PR) | Strong |
| **L1 — Component (mocked LLM)** | Cost/DIY/media refiner with mocked `generate_content`; executor tools with mocked pipeline | Yes | Good |
| **L2 — Offline dataset eval** | `evals/routing/single_loop/cases.yaml` (33 cases), `make routing-eval` | No — schema only via `test_routing_eval_cases.py` | Partial |
| **L3 — Trajectory / E2E replay** | ADK conformance (5 specs), `make conformance-test` | No — manual + needs recordings | Skeleton |
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
make test && make routing-eval  # + baseline diff check
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

| Action | Detail |
|--------|--------|
| Check in recordings | Commit `generated-recordings.yaml` for conformance specs (or mock ADK replay layer). |
| Nightly conformance job | `make conformance-test` on schedule with Vertex credentials (staging). |
| Grow conformance catalog | Target 15–20 cases: greeting, inventory list, single-branch analysis, multi-turn follow-up, user_docs, report mode, accept-offer chain. |
| Negative cases | Invented checkpoint IDs blocked, report route blocks `analyze_checkpoints`, conversational turn blocks tools. |

### Phase 4 — Observability-linked eval (optional, 4+ weeks)

- Export turn traces (tool calls, latency, token usage) to a dataset store.
- Weekly LLM-judge on prose criteria from rubric (`content_markdown_prose`) — sample ~20 turns; human review on failures.
- Dashboard: pass rate by tag, p95 `executor_first_model_ms`, tool accuracy.

LangSmith is already a transitive dependency; adopt for L4 without changing CI semantics if desired.

---

## Recommended CI matrix

| Job | When | Commands | Blocks merge? |
|-----|------|----------|---------------|
| **unit** | Every PR | `make test` | Yes |
| **routing-eval** | Every PR | `make routing-eval` + baseline diff | Yes (after Phase 1) |
| **contract** | Every PR | Schema + rubric scorer on fixtures | Yes (after Phase 1) |
| **conformance-replay** | Nightly | `make conformance-test` (staging creds) | Alert only initially |
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
| **P0** | Run `routing-eval` in CI with baseline gate | Low | High |
| **P0** | JSON Schema + deterministic rubric scorer | Medium | High |
| **P1** | Trajectory eval suite (stubbed executor) | Medium | Very high |
| **P1** | Expand conformance + commit recordings | Medium | High |
| **P2** | Nightly conformance replay job | Low | Medium |
| **P3** | LangSmith / LLM-judge for prose | High | Medium |

---

## Commands reference (today)

| Goal | Command |
|------|---------|
| Fast regression (CI) | `make test` from `gcp/agents/homecare` |
| Routing eval (deterministic) | `make routing-eval` |
| Full-turn A/B from web logs | `make weblog-summarize ARGS="--out ..."` |
| Manual QA | `uv run adk web` → `property_agent` on staging |
| Replay fixtures | `make conformance-record` / `make conformance-test` |
| Draft cases from logs | `make weblog-extract ARGS="web-log*"` |
| Live SerpAPI/YouTube (opt-in) | `RUN_EXTERNAL_DIY_SEARCH_TESTS=1 uv run pytest tests/test_diy_external_integration.py -v` |
