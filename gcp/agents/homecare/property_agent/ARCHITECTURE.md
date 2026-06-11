# property_agent architecture

Three layers inside the `property_agent` Python package. Generic ADK plumbing lives in `agent_framework`; homecare domain logic stays here.

## Layers

| Layer | Responsibility | May import | Must not |
|-------|----------------|------------|----------|
| `runtime/` | ADK shell, app config, deploy entrypoints | `manifest`, `routing` (callback registration only) | Business logic bodies |
| `routing/` | Turn control plane: resolve, guards, session memory | `agent_framework.*`, `shared.*`, `checkpoint.*` public APIs | `agents/*/orchestrator` internals; private `_` symbols from siblings |
| `checkpoint/` | Retrieval, `run_checkpoint_pipeline`, assembler, parallel analysis, progress streaming | `routing/schema`, `shared/inputs`, leaf `agents/*` for branches | Heavy eager imports from deleted resolve stack |
| `agents/*` | Leaf specialists (user_docs, kb, coverage, diy, …) | `shared`, `geo`, `routing` public helpers | — |
| `shared/` | Cross-cutting homecare types | stdlib, `agent_framework` | `routing` resolve internals |

## Import matrix (common paths)

| Need | Import from |
|------|-------------|
| Platform resolve pipeline, compaction, memory | `agent_framework.*` |
| `ResolvedTurn`, single-loop routing, conversational copy | `property_agent.routing.*` |
| Checkpoint pipeline, retrieval, assembler, analysis | `property_agent.checkpoint.*` |
| Optional-branch regex / constants | `property_agent.routing.optional_branches` |
| Shared input schema | `property_agent.shared.inputs` |
| Homecare state merge | `property_agent.bindings.state_merge` |
| Log redaction (homecare policy) | `property_agent.observability.log_redaction` |

**Boundary:** `agent_framework` must never import `property_agent`.

## Routing control plane (single-loop, Orchestrator V3)

One executor LLM per substantive turn. Deterministic pre-routing for chips, accept-offer, and bare greetings; slim `[SESSION_CONTEXT]` inject for free text.

| Layer | Owns | Key files |
|-------|------|-----------|
| **1 — Pre-routing** | Chip fast-path, accept-offer, casual regex, minimal `ResolvedTurn` for tool guards | `routing/executor_only_routing.py`, `routing/chip_action.py`, `routing/pending_user_action.py`, `routing/resolve_turn.py` |
| **2 — Executor** | Tool choice (`list_checkpoints`, `analyze_checkpoints(branches)`, docs, report) | `prompts.py`, `registry.py`, `checkpoint/executor_tools.py` |
| **3 — Guards** | Tool-boundary invariants (ids, dedupe, idempotency, pending-offer, report mode) | `checkpoint/tool_guards.py`, `routing/conversational_callbacks.py` |

Pending offers: `pending_user_action` + `pending_offer_extract` (after-agent micro-LLM). Long sessions: ADK compaction primary; optional `conversation_summary` refresh. Client chips: structured `chip_action` → `resolve_source=chip`.

**Tool blocking:** `conversational_turn` follows `is_executor_conversational_turn` (casual or context-only substantive turns) — not `route=none`. Context-only checkpoint turns (`answer_from_context`) require grounded session memory (`session_has_checkpoint_answer_context`); `property_id` alone keeps tools enabled. Cold sessions and checkpoint inventory/status queries resolve to `user_goal=new_analysis` so retrieval can run. Cleared UI selection is detected via `checkpoint_selection_cleared`. Vertex Memory Bank ingest/preload are **off by default** (`ADK_MEMORY_INGEST_ENABLED`, `ADK_MEMORY_PRELOAD_ENABLED`); set to `1` to opt in. `accept_offer` with `run_optional_agents` keeps tools enabled; `normalize_substantive_route` promotes `route=checkpoint` when branch work is requested.

See [`docs/ORCHESTRATOR_V2_PLAN.md`](../docs/ORCHESTRATOR_V2_PLAN.md) for the end-to-end flow.

## Checkpoint optional branch invocation

Inside `run_checkpoint_pipeline`, optional branches use mixed invocation styles (intentional — do not unify without a perf/reliability review):

| Branch | Invocation | Rationale |
|--------|------------|-----------|
| `diy` | Python `run_diy_pipeline_sync` | Custom parallel prefetch (web, YouTube, shopping, cost library) |
| `cost` | Python `_run_checkpoint_cost_pipeline` | Structured JSON assembly without ADK hop |
| `coverage` | `AgentTool(coverage_agent)` | RAG + LLM dialogue fits ADK agent |
| `service` | `AgentTool(service_agent)` | Same |

Orchestration waves and `depends_on` edges: `agent_framework/registry/orchestration.py` + `checkpoint/branch_registry.py`.

## Naming

- **Plugin** — `manifest.PropertyPlugin`, `PropertyRootAgentPlugin`
- **Hooks** — removed (`ResolveTurnHooks` / resolve LLM pipeline deleted in Phase 5)
- **Callbacks** — ADK `before_model` / `after_model` / `before_tool` only

## State keys

Legacy session keys `checkpoint_progress_*` are retained (no rename). V2 message patches use `contentMarkdown` / `contentJson` on `state_delta` (see `docs/ORCHESTRATOR_V2_PLAN.md`).

### ADK web vs production streaming

| Surface | Branch progress in **chat** | Structured `contentJson` / `contentMarkdown` |
|---------|---------------------------|-----------------------------------------------|
| **Proxy / mapp / webapp** | Reasoning Engine stream events with `author=checkpoint_analysis_progress` (or `state_delta` patches per event) | Firestore message fields from proxy `message_content_persist` |
| **ADK web (`adk web`)** | Same progress events when `HOMEAPP_CHECKPOINT_PROGRESS_RUNNER=1` (default) and `HomecareRunner` multiplexes a queue filled by `run_checkpoint_pipeline` | Session **state** inspector + final tool `functionResponse`; chat shows progress **text** events, not raw `state_delta` JSON |
| **ADK web, runner off** | Only final tool response + state inspector | `state_delta` merged once when the tool returns (ADK tool limitation) |

V2 uses `run_checkpoint_pipeline` **FunctionTool**, which blocks the runner until complete—so `apply_tool_context_state_delta` updates accumulated in `tool_context.actions` but ADK web did not stream them incrementally by default. `HomecareRunner` + `checkpoint/progress_stream.py` restore incremental **model text** events (`author=checkpoint_analysis_progress`) without dual-format strings.

**Queue contract:** `emit_checkpoint_progress_event` enqueues on a per-`invocation_id` registry queue. **Agent Engine:** `HomecareAdkApp` subclasses `vertexai.agent_engines.AdkApp` (not `preview`). On unpickle, `__setstate__` clears a stock `Runner` so `set_up` wires `HomecareRunner`. `async_stream_query` multiplexes the queue at the stream boundary (`runtime/stream_query_multiplex.py`)—log `checkpoint progress yielded (stream_query)`. **ADK web:** `HomecareRunner._exec_with_plugin` multiplexes the same queue—log `checkpoint progress yielded`. Debug: `HOMEAPP_ENGINE_ENTRYPOINT` WARNING lines prove `stream_query` / `set_up` ran; `checkpoint progress queued` without `yielded` means runner/stream wiring failed.

Set `HOMEAPP_CHECKPOINT_PROGRESS_RUNNER=0` to use stock ADK `Runner` (smaller session event volume in dev only).

### Legacy stream author labels (keep)

V2 does **not** register `checkpoint_analysis_agent` as a root tool. Proxy and clients still map these historical stream `author` / tool ids for the thinking strip and `agentSteps` UX:

| Label | Where | Purpose |
|-------|-------|---------|
| `checkpoint_analysis_agent` | `gcp/proxy/api/services/vertex_service.py`, `apps/common` + `apps/webapp` `agent-display.ts` | Pre-V2 workflow name; may appear on older stream events |
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
