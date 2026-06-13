# property_agent architecture

Three layers inside the `property_agent` Python package. Generic ADK plumbing lives in **`agent_platform`** (`agent-platform-core` + `agent-platform-adk`); homecare domain logic stays here.

## Layers

| Layer | Responsibility | May import | Must not |
|-------|----------------|------------|----------|
| `runtime/` | ADK shell, app config, deploy entrypoints | `manifest`, `routing` (callback registration only) | Business logic bodies |
| `routing/` | Turn control plane: resolve, guards, session memory | `agent_platform.*`, `shared.*`, `checkpoint.*` public APIs | `agents/*/orchestrator` internals; private `_` symbols from siblings |
| `checkpoint/` | Retrieval, `run_checkpoint_pipeline`, assembler, parallel analysis, progress streaming | `routing/schema`, `shared/inputs`, leaf `agents/*` for branches | Heavy eager imports from deleted resolve stack |
| `agents/*` | Leaf specialists (user_docs, kb, coverage, diy, …) | `shared`, `geo`, `routing` public helpers | — |
| `shared/` | Cross-cutting homecare types | stdlib, `agent_platform.core` | `routing` resolve internals |

## Import matrix (common paths)

| Need | Import from |
|------|-------------|
| Platform resolve pipeline, compaction, memory | `agent_platform.core.*` / `agent_platform.adk.*` |
| `ResolvedTurn`, single-loop routing, conversational copy | `property_agent.routing.*` |
| Checkpoint pipeline, retrieval, assembler, analysis | `property_agent.checkpoint.*` |
| Optional-branch regex / constants | `property_agent.routing.optional_branches` |
| Shared input schema | `property_agent.shared.inputs` |
| Homecare state merge | `property_agent.bindings.state_merge` |
| Log redaction (homecare policy) | `property_agent.observability.log_redaction` |

**Boundary:** `agent_platform` core must never import `property_agent`.

## Routing control plane (single-loop)

One executor LLM per substantive turn. Deterministic pre-routing for chips, accept-offer, and bare greetings; slim `[SESSION_CONTEXT]` inject for free text (`current_date_utc`, `current_year`, property/routing fields).

| Layer | Owns | Key files |
|-------|------|-----------|
| **1 — Pre-routing** | Chip fast-path, accept-offer, casual regex, minimal `ResolvedTurn` for tool guards | `routing/single_loop_routing.py`, `routing/chip_action.py`, `routing/pending_user_action.py`, `routing/resolve_turn.py` |
| **2 — Executor** | Tool choice (`list_checkpoints`, `analyze_checkpoints(branches)`, docs, report) | `prompts.py`, `registry.py`, `checkpoint/executor_tools.py` |
| **3 — Guards** | Tool-boundary invariants (ids, dedupe, idempotency, pending-offer, report mode) | `checkpoint/tool_guards.py`, `routing/conversational_callbacks.py` |

Pending offers: `pending_user_action` + `pending_offer_extract` (after-agent micro-LLM). When optional-branch `analyze_checkpoints` finishes synthesis, `prepare_single_loop_before_model` short-circuits the redundant post-tool executor hop (`routing/post_structured_analysis.py`); `pending_offer_extract` prefers current-invocation prose, then `contentJson.suggestedActions`, before older turns — both paths drop optional branches already completed in session analysis (`session_optional_branches_completed`: `analysisStatus`, `_checkpoint_pipeline_completed`, snapshot, payloads). Long sessions: ADK compaction primary at **~130k prompt tokens** (~65% of ~200k effective executor context; `event_retention_size=32`); `adk_session_compaction` INFO when events compact. Optional `conversation_summary` when `HOMEAPP_CONVERSATION_SUMMARY=1` (off by default). Client chips: structured `chip_action` → `resolve_source=chip`.

**Tool blocking:** The executor LLM is the sole authority over tool calls on substantive turns. `conversational_turn` is True only for casual turns (greeting, capabilities) and chip-sourced `explain_prior` / `provider_detail` discourse acts — all other turns allow tools. Structural `before_tool` guards in `checkpoint/tool_guards.py` and `routing/conversational_callbacks.py` enforce ids, branch dedupe, idempotency (`maybe_short_circuit_completed_branches`), and report-mode blocking — but never make content-level "answer from context vs. run pipeline" decisions. The executor prompt (`prompts.py`) instructs the model to answer follow-ups from session history; no regex layer vetoes `analyze_checkpoints` after the executor has chosen it. Cleared UI selection is detected via `checkpoint_selection_cleared`. Vertex Memory Bank ingest/preload are **off by default** (`ADK_MEMORY_INGEST_ENABLED`, `ADK_MEMORY_PRELOAD_ENABLED`); set to `1` to opt in.

See [`docs/SINGLE_LOOP_REFACTOR_PLAN.md`](../docs/SINGLE_LOOP_REFACTOR_PLAN.md) for the migration history and eval baselines. Post-cleanup record: [`docs/SINGLE_LOOP_CLEANUP.md`](../docs/SINGLE_LOOP_CLEANUP.md).

## Checkpoint optional branch invocation

Inside `run_checkpoint_pipeline`, optional branches use mixed invocation styles (intentional — do not unify without a perf/reliability review):

| Branch | Invocation | Rationale |
|--------|------------|-----------|
| `diy` | Python `run_diy_pipeline_sync` | Custom parallel prefetch (web, YouTube, shopping, cost library) |
| `cost` | Python `_run_checkpoint_cost_pipeline` | Structured JSON assembly without ADK hop |
| `coverage` | `AgentTool(coverage_agent)` | RAG + LLM dialogue fits ADK agent |
| `service` | `AgentTool(service_agent)` | Same |

Orchestration waves and `depends_on` edges: `agent_platform.core.registry.orchestration` + `checkpoint/branch_registry.py`.

## Naming

- **Plugin** — `manifest.PropertyPlugin`, `PropertyRootAgentPlugin`, `PropertyHookRegistry`
- **Hooks** — removed (`ResolveTurnHooks` / resolve LLM pipeline deleted in Phase 5)
- **Callbacks** — ADK façade delegates to `PropertyHookRegistry` (`HookRegistry`) via platform ADK builders

## State keys

Legacy session keys `checkpoint_progress_*` are retained (no rename). Message patches use `contentMarkdown` / `contentJson` on `state_delta`.

### ADK web vs production streaming

| Surface | Branch progress in **chat** | Structured `contentJson` / `contentMarkdown` |
|---------|---------------------------|-----------------------------------------------|
| **Proxy / mapp / webapp** | Reasoning Engine stream events with `author=checkpoint_analysis_progress` (or `state_delta` patches per event) | Firestore message fields from proxy `message_content_persist` |
| **ADK web (`adk web`)** | Same progress events when `HOMEAPP_CHECKPOINT_PROGRESS_RUNNER=1` (default) and `HomecareRunner` multiplexes a queue filled by `run_checkpoint_pipeline` | Session **state** inspector + final tool `functionResponse`; chat shows progress **text** events, not raw `state_delta` JSON |
| **ADK web, runner off** | Only final tool response + state inspector | `state_delta` merged once when the tool returns (ADK tool limitation) |

The checkpoint pipeline uses `run_checkpoint_pipeline` **FunctionTool**, which blocks the runner until complete—so `apply_tool_context_state_delta` updates accumulated in `tool_context.actions` but ADK web did not stream them incrementally by default. `HomecareRunner` + `checkpoint/progress_stream.py` restore incremental **model text** events (`author=checkpoint_analysis_progress`) without dual-format strings.

**Queue contract:** `emit_checkpoint_progress_event` enqueues on a per-`invocation_id` registry queue. **Agent Engine:** `HomecareAdkApp` subclasses `vertexai.agent_engines.AdkApp` (not `preview`). On unpickle, `__setstate__` clears a stock `Runner` so `set_up` wires `HomecareRunner`. `async_stream_query` multiplexes the queue at the stream boundary (`runtime/stream_query_multiplex.py`)—log `checkpoint progress yielded (stream_query)`. **ADK web:** `HomecareRunner._exec_with_plugin` multiplexes the same queue—log `checkpoint progress yielded`. Debug: `HOMEAPP_ENGINE_ENTRYPOINT` WARNING lines prove `stream_query` / `set_up` ran; `checkpoint progress queued` without `yielded` means runner/stream wiring failed.

Set `HOMEAPP_CHECKPOINT_PROGRESS_RUNNER=0` to use stock ADK `Runner` (smaller session event volume in dev only).

### Legacy stream author labels (keep)

The agent does **not** register `checkpoint_analysis_agent` as a root tool. Proxy and clients still map these historical stream `author` / tool ids for the thinking strip and `agentSteps` UX:

| Label | Where | Purpose |
|-------|-------|---------|
| `checkpoint_analysis_agent` | `gcp/proxy/api/services/vertex_service.py`, `apps/common` + `apps/webapp` `agent-display.ts` | Legacy workflow name; may appear on older stream events |
| `checkpoint_optional_agents_parallel_runner` | proxy lifecycle maps | Parallel branch progress |
| `checkpoint_analysis_synthesis_agent` | proxy lifecycle maps | Synthesis phase |
| `checkpoint_analysis_progress` | progress event author | Incremental `state_delta` patches |

Do not remove these mappings without a client/proxy migration plan. Do not reintroduce matching ADK root tools — checkpoint work stays on `run_checkpoint_pipeline`.

## Extension points

1. **New executor tool** — add `ToolSpec` in `registry.py` (lazy factory); register in `manifest.py` if needed.
2. **New optional checkpoint branch** — update `routing/optional_branches.py`, `checkpoint/constants.py`, analysis `parallel_runner.py`.
3. **New routing intent** — extend `routing/schema.py`, tool descriptions in `prompts.py`, and eval cases.

## Entrypoints

| Consumer | Import |
|----------|--------|
| `adk run property_agent` | `property_agent.agent` → `root_agent`, `app` |
| Agent Engine deploy | `property_agent.runtime.agent.get_root_agent()`, `property_agent.vertex_app` |
