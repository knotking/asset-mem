# Homecare agent — model policy

The property agent uses **two Gemini backends**, chosen by call path rather than by user-facing feature name.

## `GLOBAL_GEMINI_MODEL` (`gemini-3.1-flash-lite`)

**Where:** ADK sub-agents wired through `property_agent/model_config.py`:

- Checkpoint analysis sub-agents, coverage / service / shopping ADK agents
- Pending-offer extract and conversation summary helpers on the root agent

**Why:** Low latency, streaming-friendly orchestration; most turns are tool routing or separate `contentJson` / `contentMarkdown` fields via `state_delta`.

**Client:** ADK `Gemini3` wrapper with Vertex `location=global`.

## `SINGLE_LOOP_GEMINI_MODEL` (`gemini-3.5-flash`)

**Where:**

- Root `property_agent` executor (`global_agent_gemini_model()`)
- Direct `generate_content` via `global_direct_generate_client_and_model()`:
  - DIY web grounding + steps synthesis
  - Cost market web grounding + AI cost JSON
  - Checkpoint media search query refiner
  - Checkpoint executive-summary markdown synthesis

**Thinking levels:** Use `direct_gemini_thinking_config(env_var, default=...)` — see `.env.example` (`DIY_WEB_THINKING`, `COST_MARKET_THINKING`, etc.). Do not set `thinking_level` and `thinking_budget` in the same request.

**Client:** `Gemini3` / `location=global`. The root executor must receive the **`SINGLE_LOOP_GEMINI_MODEL` object** (not the model name string) so ADK does not fall back to `GOOGLE_CLOUD_LOCATION` (e.g. `us-central1`), where newer Flash models may be unavailable.

## `LEGACY_API_GEMINI` (`gemini-2.5-flash`)

**Where:** Regional `google.genai` client only where global 3.x is not required:

- Firestore checkpoint **query embeddings** (`text-embedding-004`, separate from chat models)

**Why:** Regional Vertex client (`vertexai=True`, project region) for legacy paths not yet migrated to global 3.5.

## Rules of thumb

| Need | Use |
|------|-----|
| New ADK sub-agent with tools / transfer | `GLOBAL_GEMINI_MODEL` |
| Root orchestrator tool selection | `SINGLE_LOOP_GEMINI_MODEL` via `global_agent_gemini_model()` |
| One-shot `generate_content` (JSON, web grounding, synthesis) | `global_direct_generate_client_and_model()` + `direct_gemini_thinking_config()` |
| Embeddings | `text-embedding-004` in `firestore_vector_search.py` (not chat models) |

Changing the default chat model for ADK agents: edit `Gemini3(model=...)` in `model_config.py`, run `make test`, and exercise key flows via `adk web` on staging.

Changing global direct-call model: edit `SINGLE_LOOP_GEMINI_MODEL` in the same file.
