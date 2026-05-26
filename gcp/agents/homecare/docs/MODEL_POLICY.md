# Homecare agent — model policy

The property agent uses **two Gemini backends**, chosen by call path rather than by user-facing feature name.

## `GLOBAL_GEMINI_MODEL` (`gemini-3.1-flash-lite`)

**Where:** All ADK `Agent` definitions wired through `property_agent/model_config.py`:

- Root `property_agent` (executor + resolve) and checkpoint analysis sub-agents
- Checkpoint agent, coverage / service / shopping ADK agents
- Checkpoint progress workflow (parallel runner is Python-only; **synthesis** uses this model)
- Media search-query refiner and other small ADK tool agents

**Why:** Low latency, streaming-friendly routing and synthesis; most turns are orchestration or structured dual-format output.

**Client:** ADK `Gemini3` wrapper with Vertex `location=global`.

## `LEGACY_API_GEMINI` (`gemini-2.5-flash`)

**Where:** Direct `google.genai` `generate_content` / `embed_content` (not ADK `Agent.run`):

- `cost_agent/ai_cost_estimator.py` — structured cost JSON
- `diy_agent/orchestrator.py` — DIY steps synthesis, grounded web search helper
- `checkpoint_agent/media_search_query_refiner.py` — retrieval search phrase cleanup
- Firestore checkpoint **query embeddings** (`text-embedding-004`, separate from chat models)

**Why:** These paths predate the 3.x ADK default or need `response_json_schema` / orchestrator-specific retry behavior on the standard Vertex client (`vertexai=True`, project region).

## Rules of thumb

| Need | Use |
|------|-----|
| New ADK sub-agent with tools / transfer | `GLOBAL_GEMINI_MODEL` |
| New one-shot JSON from Python (`generate_content`) | `LEGACY_API_GEMINI` unless ADK migration is explicit |
| Embeddings | `text-embedding-004` in `firestore_vector_search.py` (not chat models) |

Changing the default chat model for ADK agents: edit `Gemini3(model=...)` in `model_config.py` and re-run evals (`make test-eval-executor-routing`, checkpoint evalsets).

Changing cost/DIY direct calls: edit `LEGACY_API_GEMINI.model` in the same file.
