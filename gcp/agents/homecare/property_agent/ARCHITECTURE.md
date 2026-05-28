# property_agent architecture

Three layers inside the `property_agent` Python package. Generic ADK plumbing lives in `agent_framework`; homecare domain logic stays here.

## Layers

| Layer | Responsibility | May import | Must not |
|-------|----------------|------------|----------|
| `runtime/` | ADK shell, app config, deploy entrypoints | `manifest`, `routing` (callback registration only) | Business logic bodies |
| `routing/` | Turn control plane: resolve, guards, session memory | `agent_framework.*`, `shared.*`, `checkpoint.*` public APIs | `agents/*/orchestrator` internals; private `_` symbols from siblings |
| `checkpoint/` | Retrieval, `run_checkpoint_pipeline`, assembler, parallel analysis, progress streaming | `routing/schema`, `shared/inputs`, leaf `agents/*` for branches | Heavy imports from `routing/resolve_turn_llm` (use lazy imports in pipeline helpers) |
| `agents/*` | Leaf specialists (user_docs, kb, coverage, diy, …) | `shared`, `geo`, `routing` public helpers | — |
| `shared/` | Cross-cutting homecare types | stdlib, `agent_framework` | `routing` resolve internals |

## Import matrix (common paths)

| Need | Import from |
|------|-------------|
| Platform resolve pipeline, compaction, memory | `agent_framework.*` |
| `ResolvedTurn`, resolve LLM, conversational copy | `property_agent.routing.*` |
| Checkpoint pipeline, retrieval, assembler, analysis | `property_agent.checkpoint.*` |
| Optional-branch regex / constants | `property_agent.routing.optional_branches` |
| Shared input schema | `property_agent.shared.inputs` |
| Homecare state merge | `property_agent.bindings.state_merge` |
| Log redaction (homecare policy) | `property_agent.observability.log_redaction` |

**Boundary:** `agent_framework` must never import `property_agent`.

## Naming

- **Plugin** — `manifest.PropertyPlugin`, `PropertyRootAgentPlugin`
- **Hooks** — `ResolveTurnHooks` in `routing/homecare_resolve_hooks.py`
- **Callbacks** — ADK `before_model` / `after_model` / `before_tool` only

## State keys

Legacy session keys `checkpoint_progress_*` are retained (no rename). V2 message patches use `contentMarkdown` / `contentJson` on `state_delta` (see `docs/ORCHESTRATOR_V2_PLAN.md`).

### ADK web vs production streaming

| Surface | Branch progress in **chat** | Structured `contentJson` / `contentMarkdown` |
|---------|---------------------------|-----------------------------------------------|
| **Proxy / mapp / webapp** | Reasoning Engine stream events with `author=checkpoint_analysis_progress` (or `state_delta` patches per event) | Firestore message fields from proxy `message_content_persist` |
| **ADK web (`adk web`)** | Same progress events when `HOMEAPP_CHECKPOINT_PROGRESS_RUNNER=1` (default) and `HomecareRunner` multiplexes a queue filled by `run_checkpoint_pipeline` | Session **state** inspector + final tool `functionResponse`; chat shows progress **text** events, not raw `state_delta` JSON |
| **ADK web, runner off** | Only final tool response + state inspector | `state_delta` merged once when the tool returns (ADK tool limitation) |

Pre–Orchestrator V2, `checkpoint_analysis_progress` was a **sub-agent** (`CheckpointOptionalParallelAgent`) whose `run_async` **yielded** events. V2 consolidated into `run_checkpoint_pipeline` **FunctionTool**, which blocks the runner until complete—so `apply_tool_context_state_delta` updates accumulated in `tool_context.actions` but ADK web did not stream them. `HomecareRunner` + `checkpoint/progress_stream.py` restore incremental **model text** events without reintroducing dual-format strings.

**Queue contract:** `emit_checkpoint_progress_event` enqueues on a per-`invocation_id` registry queue. **Agent Engine:** `HomecareAdkApp` subclasses `vertexai.agent_engines.AdkApp` (not `preview`). On unpickle, `__setstate__` clears a stock `Runner` so `set_up` wires `HomecareRunner`. `async_stream_query` multiplexes the queue at the stream boundary (`runtime/stream_query_multiplex.py`)—log `checkpoint progress yielded (stream_query)`. **ADK web:** `HomecareRunner._exec_with_plugin` multiplexes the same queue—log `checkpoint progress yielded`. Debug: `HOMEAPP_ENGINE_ENTRYPOINT` WARNING lines prove `stream_query` / `set_up` ran; `checkpoint progress queued` without `yielded` means runner/stream wiring failed.

Set `HOMEAPP_CHECKPOINT_PROGRESS_RUNNER=0` to use stock ADK `Runner` (smaller session event volume in dev only).

## Extension points

1. **New executor tool** — add `ToolSpec` in `registry.py` (lazy factory); register in `manifest.py` if needed.
2. **New optional checkpoint branch** — update `routing/optional_branches.py`, `checkpoint/constants.py`, analysis `parallel_runner.py`.
3. **New routing intent** — extend `routing/schema.py` and `resolve_turn_llm.py` (homecare-specific).

## Entrypoints

| Consumer | Import |
|----------|--------|
| `adk run property_agent` | `property_agent.agent` → `root_agent`, `app` |
| Agent Engine deploy | `property_agent.runtime.agent.get_root_agent()`, `property_agent.vertex_app` |
