# Core ports (runtime-agnostic)

Defines the **minimum protocol surface** for `agent-platform-core`. ADK types map to these in `agent-platform-adk`; verticals implement hooks against them.

**Status:** Draft — implement in Phase 1.

---

## Design principles

1. **Core never imports `google.adk`** — adapters translate at the boundary.
2. **Duck typing OK in v0.1** — `Protocol` classes; concrete dataclasses where helpful.
3. **Session state is a `dict[str, Any]`** — same as ADK session state today.
4. **Turn short-circuit is explicit** — replaces returning `LlmResponse` from hooks.

---

## `TurnContext`

Per-turn read context for routing and hooks.

```python
from typing import Any, Protocol

class TurnContext(Protocol):
  @property
  def state(self) -> dict[str, Any]: ...

  @property
  def invocation_id(self) -> str | None: ...

  @property
  def user_message(self) -> str: ...

  @property
  def events(self) -> list[Any]: ...
```

**ADK mapping (`agent-platform-adk`):**

| Port | ADK source |
|------|------------|
| `state` | `callback_context.state` or `tool_context.state` |
| `invocation_id` | `callback_context._invocation_context.invocation_id` |
| `user_message` | Resolved from state / latest user event (vertical helper) |
| `events` | `callback_context._invocation_context.session.events` |

Today: `agent_framework.routing.resolved_turn.session_events` / `invocation_id` — move to adapter helpers that build `TurnContext`.

---

## `TurnOutcome`

Result of pre-routing / `before_turn` hooks. Replaces `LlmResponse` in core.

```python
from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True)
class TurnOutcome:
  kind: str  # "continue" | "skip_executor"
  prose: str | None = None
  state_patches: dict[str, Any] | None = None
  inject_system_blocks: list[str] | None = None

  @classmethod
  def continue_(cls, *, inject_system_blocks: list[str] | None = None) -> TurnOutcome: ...

  @classmethod
  def skip_executor(cls, prose: str, *, state_patches: dict[str, Any] | None = None) -> TurnOutcome: ...
```

**ADK mapping:**

| `TurnOutcome` | ADK behavior |
|---------------|--------------|
| `continue_` + `inject_system_blocks` | Mutate `LlmRequest.config.system_instruction`; return `None` from `before_model` |
| `skip_executor` + `prose` | Return `LlmResponse(content=model text)` via `plain_text_llm_response` |

Migrate `run_resolve_before_model` to return `TurnOutcome | None` (`None` ≡ continue with no extra inject).

---

## `ToolCallContext`

Per tool invocation — state mutations and progress.

```python
class ToolCallContext(Protocol):
  @property
  def state(self) -> dict[str, Any]: ...

  @property
  def invocation_id(self) -> str | None: ...

  def apply_state_delta(self, delta: dict[str, Any]) -> None: ...

  def emit_progress(self, event: ProgressEvent) -> None: ...
```

**ADK mapping:**

| Port | ADK source |
|------|------------|
| `apply_state_delta` | `tool_context.actions.state_delta.update(delta)` |
| `emit_progress` | Enqueue on progress queue → multiplex as `Event` |

---

## `ProgressEvent`

Framework-neutral progress payload (Phase 2).

```python
@dataclass(frozen=True)
class ProgressEvent:
  author: str
  text: str | None = None
  state_delta: dict[str, Any] | None = None
  seq: int | None = None
```

ADK adapter builds `google.adk.events.event.Event` + `EventActions`. Homecare uses `author=checkpoint_analysis_progress` today — vertical chooses author string.

---

## `ModelClient`

Direct LLM calls outside the runtime executor (micro-LLMs, JSON extraction, grounded search helpers).

```python
@dataclass(frozen=True)
class GenerateRequest:
  contents: str | list[Any]
  model: str | None = None
  temperature: float | None = None
  max_output_tokens: int | None = None
  response_mime_type: str | None = None
  response_json_schema: dict[str, Any] | None = None
  extra_config: dict[str, Any] | None = None  # adapter-specific (tools, thinking_level, …)

@dataclass(frozen=True)
class GenerateResponse:
  text: str
  parsed: Any | None = None
  raw: Any | None = None

class ModelClient(Protocol):
  default_model: str
  def generate(self, request: GenerateRequest) -> GenerateResponse: ...
  async def generate_async(self, request: GenerateRequest) -> GenerateResponse: ...
```

**ADK / Gemini adapter (`agent-platform-adk`):**

| Port | Implementation |
|------|----------------|
| `ModelClient` | `GeminiModelClient` — wraps `google.genai.Client` |
| Factory | `create_gemini_model_client(model=GeminiModel \| str, backend=GeminiBackend)` |
| Model ids | `GeminiModel` enum (`GEMINI_3_1_FLASH_LITE`, `GEMINI_3_5_FLASH`, `GEMINI_2_5_FLASH`) + raw strings for future ids |
| Env helper | `gemini_model_from_env("SINGLE_LOOP_GEMINI_MODEL", default=GeminiModel.…)` |
| Response helpers | `agent_platform.core.model.response_text` |

Homecare keeps semantic names in `model_config.py` (`flash_lite_model_client()`, etc.) built on the factory.

---

## `HookRegistry`

Vertical + platform callbacks. Registered on the runtime adapter, not in core.

```python
class HookRegistry(Protocol):
  def before_turn(self, ctx: TurnContext, *, llm_request: Any | None = None) -> TurnOutcome | None: ...
  def before_tool(self, ctx: ToolCallContext, tool_name: str, args: dict[str, Any]) -> dict[str, Any] | None: ...
  def after_tool(self, ctx: ToolCallContext, tool_name: str, result: Any) -> None: ...
  def after_turn(self, ctx: TurnContext) -> None: ...
```

**Maps from ADK today:**

| Hook | ADK callback |
|------|--------------|
| `before_turn` | `before_model_callback` |
| `before_tool` | `before_tool_callback` |
| `after_tool` | `after_tool_callback` |
| `after_turn` | `after_agent_callback` / `after_model_callback` (split as needed) |

`PropertyRootAgentPlugin` (`property_agent/runtime/root_agent_plugin.py`) becomes a thin ADK façade over `HookRegistry` + vertical hooks.

---

## `ResolveTurnHooks` (existing — retarget to ports)

`agent_framework.routing.resolve_pipeline.ResolveTurnHooks` stays; change signatures:

- `early_short_circuit(ctx)` → returns `TurnOutcome | None` (not `LlmResponse`)
- `run_resolve_before_model` → `TurnOutcome | None`

`is_casual`, `format_inject_block`, `apply_to_state` unchanged in spirit.

---

## `MessagePatchInputV1` (existing — stable)

Already in `agent_framework.contracts`. **No port rename for v0.1.**

| `state_delta` key | Firestore field |
|-------------------|-----------------|
| `contentMarkdown` | `contentMarkdown` |
| `contentJson` | `contentJson` |
| `analysisRunId` | `analysisRunId` |

Proxy merge: `merge_state_delta_message_keys`, `message_patch_input_from_accumulator`.

---

## `RuntimeAdapter` (ADK implementation)

```python
class RuntimeAdapter(Protocol):
  def build_executor(self, plugin: ExecutorPlugin) -> Any: ...
  async def stream_query(self, session, message) -> AsyncIterator[StreamEvent]: ...
```

`ExecutorPlugin` replaces `RootAgentPlugin` in core naming:

```python
class ExecutorPlugin(Protocol):
  name: str
  description: str
  instructions: Callable[[], str]
  input_schema: type
  build_tools: Callable[[], list[Any]]  # opaque tool handles
  hooks: HookRegistry
```

`agent-platform-adk`:

```python
def build_root_agent(plugin: ExecutorPlugin) -> Agent:
  ...
```

---

## `CompositePipeline` (Phase 3 — sketch)

Optional ports for retrieve → branch → assemble workflows.

```python
class RetrievalPort(Protocol):
  async def retrieve(self, ctx: ToolCallContext, query: str) -> Any: ...

class BranchWorker(Protocol):
  async def run_branch(self, ctx: ToolCallContext, branch_id: str) -> dict[str, Any]: ...

class AssemblerPort(Protocol):
  def assemble(self, retrieval: Any, branch_results: dict[str, Any]) -> MessagePatchInputV1: ...
```

Homecare `run_checkpoint_pipeline` implements these; minimal example implements a toy version.

---

## Migration checklist (Phase 1)

- [ ] Add `agent_platform/core/ports.py` with types above
- [ ] `resolve_pipeline.py` returns `TurnOutcome`
- [ ] `agent_platform/adk/bridge.py` — `turn_outcome_to_llm_response`, `turn_context_from_callback`
- [ ] `state_delta_merge.py` — remove `google.adk.flows` import
- [ ] `memory/ingest.py` — accept `Sequence[Mapping]` instead of `Event`
- [ ] Move `build_root_agent`, `llm_short_circuit`, `compaction_config` to `adk/`
- [ ] Extend boundary tests
