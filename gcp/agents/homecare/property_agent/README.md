# Property Agent

The **property agent** (`root_agent`) is the Home Care orchestrator: **single-loop routing** (chip / accept-offer / casual regex, then one executor LLM on `gemini-3.5-flash`) calls flat registry tools.

Regression: `make test` (unit tests). ADK evalsets removed; see `property_agent/evals/README.md`.

**Layout:** `property_agent/` (routing, agents, checkpoint pipeline, evals, runtime) plus the shared **`agent_framework`** package (`gcp/agent_framework/`, import `agent_framework.*`).

**Gemini models:** ADK agents use `GLOBAL_GEMINI_MODEL` (`gemini-3.1-flash-lite`); direct Python `generate_content` paths use `LEGACY_API_GEMINI`. See [`docs/MODEL_POLICY.md`](../docs/MODEL_POLICY.md).

## Architecture

```
property_agent (root orchestrator)
├── agent_framework/runtime/build_root_agent.py   # generic Agent shell
├── property_agent/runtime/root_agent_plugin.py  # PropertyRootAgentPlugin adapter
├── property_agent/runtime/homecare_runner.py    # ADK dev progress streaming
├── property_agent/manifest.py               # plugin registration
├── before_model: chip / accept-offer / casual OR slim [SESSION_CONTEXT]
├── run_checkpoint_pipeline (FunctionTool)     # retrieval + optional branches + assembler
│       └── checkpoint/analysis/               # parallel_runner, assembler, synthesis
└── AgentTool(user_docs_agent)
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for layer rules and import matrix.

- **Pre-routing** (`property_agent/routing/single_loop_routing.py`): deterministic chip, accept-offer, casual; slim session context for free text.
- **Schema** (`property_agent/routing/schema.py`): homecare `ResolvedTurn`, routes, intents.
- **Platform** (`agent_framework/routing/resolved_turn.py`): inject format, state keys.
- **Bindings** (`property_agent/routing/constants.py`, `bindings/state_merge.py`, `observability/log_redaction.py`): homecare-specific constants, state dedupe keys, log redaction policy.

## Import rules (platform vs property_agent)

| Need | Import from |
|------|-------------|
| `plain_text_llm_response`, `state_take`, resolve pipeline, compaction, memory ingest | `agent_framework.*` |
| `redact_tool_args_for_log` (homecare policy) | `property_agent.observability.log_redaction` |
| `safe_text_preview` (no policy) | `agent_framework.observability.log_redaction` |
| `ResolvedTurn`, single-loop routing, conversational copy | `property_agent.routing.*` |

Do not re-export platform symbols from `property_agent` (no shim modules).
- **Conversational** (`property_agent/routing/conversational_*`): hello/thanks gate; indexical menu.

## ADK / deploy entrypoints

| Consumer | Import |
|----------|--------|
| `adk run property_agent` / evals | `property_agent.agent` → `root_agent`, `app` |
| Agent Engine deploy | `property_agent.runtime.agent.root_agent`, `property_agent.vertex_app.HomecareAdkApp` |

Set `agent_module="property_agent"` in `AgentEvaluator` tests.

## Quick start

From `gcp/agents/homecare`:

```bash
make setup
make run          # adk run property_agent
adk web           # pick property_agent
make test         # unit tests under tests/
```

**Lifecycle status:** Proxy persists `agentLifecycle` on the assistant Firestore message (`proxy.request_accepted`, `proxy.engine_invoke`, engine phases via `author=homeapp_lifecycle`). Clients read it from the message listener (mapp/webapp). Cloud Logging: `HOMEAPP_LIFECYCLE phase=…`.

**Engine turn timing:** Each turn emits one `HOMEAPP_ENGINE_TURN_TIMING engine_turn_timing: …` line (`HOMEAPP_ENGINE_TURN_TIMING=0` to disable). **Agent Engine** (`entrypoint=async_stream_query`): includes `ensure_runner_ms`, `adk_stream_start_ms`, etc. **`adk web`** (`entrypoint=adk_web`): starts in `HomecareRunner` — look for `reason=adk_web_complete`. Fields are ms from turn start: `runner_exec_start_ms`, `runner_first_event_ms`, `before_model_ms`, `resolve_ms`, `executor_first_model_ms`, `stream_complete_ms`.
