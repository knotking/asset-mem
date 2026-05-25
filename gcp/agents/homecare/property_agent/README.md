# Property Agent

The **property agent** (`root_agent` in `agent.py`, ADK name `property_agent`) is the Home Care executor. It handles casual turns with **canned** replies (no LLM), runs a **resolve** step for substantive turns, then executes tools in a **single** LLM hop (no `doculink_agent` transfer).

Regression goldens: ADK evalsets under `property_agent/evals/`.

**Gemini models:** ADK agents use `GLOBAL_GEMINI_MODEL` (`gemini-3.1-flash-lite`); direct Python `generate_content` paths use `LEGACY_API_GEMINI`. See [`docs/MODEL_POLICY.md`](../docs/MODEL_POLICY.md).

## Architecture

```
property_agent (root executor)
├── before_model: casual canned OR resolve_turn + [RESOLVED_TURN] inject
├── AgentTool(user_docs_agent)
├── AgentTool(knowledge_base_agent)
├── AgentTool(checkpoint_agent)
│       └── optional parallel analysis via checkpoint_progress_agent sub-agent
└── sub_agents: checkpoint_progress_agent
```

- **Resolve** (`resolve_turn_llm.py`): **LLM-only** flash JSON routing for every turn (intent, route, optional branches).
- **Conversational** (`conversational_intent.py`, `conversational_callbacks.py`): narrow hello/thanks gate; indexical menu (`first`–`sixth` one).
- **DIY / service / cost / coverage**: unchanged under `sub_agents/`.

## Routing

| Turn | Behavior |
|------|----------|
| Greeting / capabilities / thanks | LLM resolve → canned — **0** executor LLM tools |
| Every turn | LLM `resolve_turn` → casual canned **or** inject `[RESOLVED_TURN]` → executor LLM |

`primary_agent`, `checkpoint_ids`, and UI optional toggles are **context**; resolve + `before_tool` enforce retrieval-only vs analysis.

## Inputs

`DiagnosisInput` in `agent_inputs.py` (`user_query`, `context_doc_uris`, `checkpoint_ids`, `property_address`, `property_id`, `primary_agent`, `checkpoint_optional_agents`, `search_location`, …).

## Key files

| Path | Role |
|------|------|
| `agent.py` | `root_agent`, `app` |
| `resolve_turn.py` | Pre-executor resolve + state apply |
| `prompts.py` | Thin `property_agent_executor_instructions()` |
| `conversational_intent.py` | Casual vs substantive, optional branch picks |
| `conversational_callbacks.py` | Canned bypass, tool blocks |
| `sub_agents/checkpoint_agent/` | Retrieval + optional analysis entry |

## Quick start

From `gcp/agents/homecare`:

```bash
make setup
make run          # adk run property_agent
adk web           # pick property_agent
```

Unit tests: `tests/test_resolve_turn.py`, `tests/test_resolve_turn_llm.py`, `tests/test_conversational_*.py`.

**Env:** `RESOLVE_LLM_DISABLED=1` skips the resolver LLM and uses a safe retrieval-only fallback.
