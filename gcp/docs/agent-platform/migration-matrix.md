# Migration matrix

File-by-file inventory for agent platform extraction.  
**Legend:** `core` = `agent-platform-core`, `adk` = `agent-platform-adk`, `gateway` = `agent-platform-gateway`, `vertical` = stays in `property_agent`, `shim` = temporary re-export.

---

## `gcp/agent_framework/` → target packages

| File | ADK import? | Target | Notes |
|------|-------------|--------|-------|
| `__init__.py` | No | core | |
| `contracts/__init__.py` | No | core | |
| `contracts/v1.py` | No | core | `ContextHydratorV1`, protocols |
| `contracts/message_patch_types.py` | No | core | **Stable API** |
| `contracts/message_patch_v1.py` | No | core | **Stable API** |
| `context/__init__.py` | No | core | |
| `context/hydrator_render.py` | No | core | |
| `context/memory_merge.py` | No | core | |
| `context/prompt/__init__.py` | No | core | |
| `context/prompt/assembler.py` | No | core | |
| `context/prompt/session_memory.py` | No | core | |
| `execution/__init__.py` | No | core | |
| `execution/parallel_runner.py` | No | core | |
| `execution/thread_context.py` | No | core | |
| `memory/__init__.py` | No | core | |
| `memory/ingest.py` | **Yes** (`Event`) | core | Refactor: generic event mapping |
| `observability/__init__.py` | No | core | |
| `observability/logging_context.py` | No | core | Mirror in `gcp/common` for proxy |
| `observability/log_redaction.py` | No | core | |
| `observability/redaction_policy.py` | No | core | |
| `registry/__init__.py` | No | core | |
| `registry/tool_spec.py` | No | core | `ToolSpec` lazy factories (no ADK in core) |
| `registry/orchestration.py` | No | core | **Stable API** |
| `routing/__init__.py` | No | core | |
| `routing/resolved_turn.py` | No* | core | Uses `google.genai.types` for inject — OK in core or thin genai dep |
| `routing/resolve_pipeline.py` | No* | core | Returns `LlmResponse` today → `TurnOutcome` |
| `routing/tool_guards.py` | No | core | |
| `runtime/__init__.py` | — | split | |
| `runtime/build_root_agent.py` | **Yes** | **adk** | `RootAgentPlugin` → `ExecutorPlugin` bridge |
| `runtime/llm_short_circuit.py` | **Yes** | **adk** | Wraps `TurnOutcome.skip_executor` |
| `runtime/compaction_config.py` | **Yes** | **adk** | `EventsCompactionConfig` |
| `runtime/logging_plugin.py` | No | core | ADK-agnostic bind/unbind; used by ADK plugin |
| `state/__init__.py` | No | core | |
| `state/context_ids.py` | No | core | |
| `state/session_state.py` | No | core | |
| `state/state_delta_merge.py` | **Yes** | core | Vend `deep_merge_dicts` — remove ADK import |
| `README.md` | — | core + adk | Split docs; link to `gcp/docs/agent-platform/` |
| `pyproject.toml` | — | split | Two packages |
| `tests/*` | Mixed | core / adk | `test_boundaries.py` → add no-ADK-in-core test |

\*No direct `google.adk` import; behavioral coupling to ADK callback flow.

### `agent_framework` ADK import summary

| Module | ADK symbol |
|--------|------------|
| `runtime/build_root_agent.py` | `google.adk.agents.Agent` |
| `runtime/llm_short_circuit.py` | `LlmResponse` |
| `runtime/compaction_config.py` | `EventsCompactionConfig` |
| `memory/ingest.py` | `Event` |
| `state/state_delta_merge.py` | `deep_merge_dicts` |

**Count:** 5 production files with ADK imports (of ~35 non-test modules).

---

## `property_agent/` — vertical vs lift to platform

### Stay in vertical (homecare domain)

| Area | Files | Reason |
|------|-------|--------|
| Leaf agents | `agents/*/` | Coverage, DIY, service, cost, shopping, user_docs prompts + tools |
| Checkpoint retrieval | `checkpoint/retrieval/*` | Firestore vector search, property scope |
| Checkpoint pipeline body | `checkpoint/pipeline.py`, `analysis/*` | Domain assembler, synthesis |
| Geo | `geo/*` | SerpAPI, Maps, property locations |
| Reports | `reports/*` | Property reports |
| Routing schema | `routing/schema.py`, `constants.py` | Homecare `ResolvedTurn` |
| Single-loop routing | `routing/single_loop_routing.py` | Could generalize later; homecare-specific fields today |
| Bindings | `bindings/*` | Homecare state merge keys |
| Prompts | `prompts.py` | Executor instructions |
| Evals cases | `evals/routing/*` | Homecare routing fixtures |

### Lift to `adk` adapter (runtime plumbing)

| File | Target | Notes |
|------|--------|-------|
| `runtime/homecare_runner.py` | adk | `Runner` subclass, progress multiplex |
| `runtime/stream_query_multiplex.py` | adk | Engine stream + progress queue |
| `vertex_app.py` | adk | `AdkApp` subclass |
| `runtime/app_config.py` | adk | ADK `App` + compaction |
| `runtime/root_agent_plugin.py` | adk + vertical | Split: ADK façade vs homecare hooks |
| `checkpoint/progress_stream.py` | core + adk | Core: queue registry; adk: `Event` mapping |
| `checkpoint/progress_events.py` | adk | `Event` / `EventActions` builders |
| `observability/lifecycle_events.py` | adk | ADK `Event` for lifecycle |
| `registry.py` | adk | `FunctionTool`, `AgentTool` factories |

### Lift to `core` (generalize)

| File | Target | Notes |
|------|--------|-------|
| `routing/pending_offer_extract.py` | core pattern | Parameterize branch enum / schema |
| `routing/chip_action.py` | core pattern | Chip fast-path protocol |
| `routing/post_structured_analysis.py` | core | Short-circuit post-tool executor hop |
| `checkpoint/tool_guards.py` | core | Structural guards (parameterize tool names) |
| `evals/routing/run_routing_eval.py` | core | Generic YAML routing eval harness |
| `checkpoint/branch_registry.py` | vertical | Uses core `BranchToolSpec`; stays as data |

### ADK-touched `property_agent` files (24 files)

| File | ADK imports |
|------|-------------|
| `runtime/root_agent_plugin.py` | CallbackContext, Context, LlmRequest, LlmResponse, BaseTool, ToolContext |
| `runtime/homecare_runner.py` | Runner, Event, RunConfig, InvocationContext, Session |
| `runtime/stream_query_multiplex.py` | Event |
| `runtime/app_config.py` | App, EventsCompactionConfig |
| `runtime/agent.py` | adk_web_server |
| `registry.py` | FunctionTool, AgentTool, preload_memory_tool |
| `checkpoint/pipeline.py` | ToolContext |
| `checkpoint/executor_tools.py` | ToolContext |
| `checkpoint/progress_stream.py` | Event |
| `checkpoint/progress_events.py` | Event, EventActions |
| `checkpoint/retrieval/agent.py` | ToolContext |
| `checkpoint/analysis/parallel_runner.py` | Agent, ToolContext, AgentTool |
| `checkpoint/analysis/search_query.py` | ToolContext |
| `checkpoint/analysis/analysis_validate.py` | LlmResponse |
| `agents/*/agent.py` | Agent, ToolContext (varies) |
| `reports/retrieval.py` | ToolContext |
| `routing/conversational_callbacks.py` | CallbackContext, Context, LlmResponse, BaseTool, ToolContext |
| `observability/lifecycle_events.py` | Event, EventActions |
| `memory_bank.py` | CallbackContext, Event |
| `model_config.py` | Gemini |

---

## `gcp/proxy/api/` — gateway extraction

| File | Target | Notes |
|------|--------|-------|
| `utils/message_content_persist.py` | shim → `agent_platform.gateway.persist` | Done |
| `utils/message_patch_state.py` | shim → `agent_platform.gateway.patch_state` | Done |
| `services/vertex_service.py` | proxy | Stays; imports utils shims |
| `scripts/stage-agent-platform-for-proxy.sh` | deploy | Stages contracts + gateway |
| `scripts/stage-agent-framework-contracts.sh` | deprecated | Delegates to stage-agent-platform |

---

## Test migration

| Current | Target |
|---------|--------|
| `agent_framework/tests/test_boundaries.py` | core: no `property_agent` imports |
| (new) `test_core_no_adk_imports.py` | core: no `google.adk` imports |
| `agent_framework/tests/*` | Split core vs adk |
| `gcp/agents/homecare/tests/*` | Stay; integration tests for vertical + adapters |

---

## HomeApp strangler status

| Area | Status |
|------|--------|
| `property_agent` imports | `agent_platform.core.*` / `agent_platform.adk.*` (no `agent_framework`) |
| `gcp/agent_framework/` | Deprecated shim only — do not add new imports |
| Agent Engine bundle | Stages `property_agent` + `agent_platform/{core,adk}` |
| `pyproject.toml` | Direct path deps on `agent-platform-core` + `agent-platform-adk` |


Smallest useful slice after this planning branch:

1. Create `gcp/agent_platform/core/` and `gcp/agent_platform/adk/` package skeletons
2. Add `core/ports.py` per [ports.md](./ports.md)
3. Move `build_root_agent`, `llm_short_circuit`, `compaction_config` → `adk/`
4. Vend deep merge in `core/state/state_delta_merge.py`
5. `agent_framework` re-exports with deprecation warnings
6. `test_core_no_adk_imports.py` + existing boundaries green
7. Homecare `make test` unchanged

---

## Import path migration (consumers)

| Today | After Phase 1 |
|-------|----------------|
| `from agent_framework.runtime.build_root_agent import ...` | `from agent_platform.adk.build_root_agent import ...` |
| `from agent_framework.contracts.message_patch_v1 import ...` | `from agent_platform.core.contracts.message_patch_v1 import ...` |
| `from agent_framework.registry.orchestration import ...` | `from agent_platform.core.registry.orchestration import ...` |

Shim period (~2 releases):

```python
# agent_framework/runtime/build_root_agent.py
import warnings
warnings.warn("Import from agent_platform.adk", DeprecationWarning, stacklevel=2)
from agent_platform.adk.build_root_agent import *  # noqa: F403
```
