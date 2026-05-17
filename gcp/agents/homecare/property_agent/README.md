# Property Agent

The **property agent** (`root_agent` in `agent.py`, ADK name `property_agent`) is the Home Care orchestrator. It delegates almost all work to **DocuLink** (`doculink_agent`), which performs checkpoint retrieval, user-document RAG, or general knowledge-base lookup. Optional **checkpoint analysis** (coverage, DIY, service, cost) runs inside the checkpoint path when `checkpoint_optional_agents` is set.

The canonical routing text lives in `prompts.py` (`root_agent_instructions`, `doculink_agent_system_instruction`). Regression goldens are ADK evalsets under `property_agent/evals/`.

## Architecture (current)

```
property_agent (root)
└── doculink_agent
    ├── AgentTool(user_docs_agent)
    ├── AgentTool(knowledge_base_agent)
    └── AgentTool(checkpoint_agent)
            ├── ask_checkpoints_retrieval
            └── AgentTool(checkpoint_analysis_agent)   # when optional analysis requested
                    └── SequentialAgent:
                          ParallelAgent (coverage | diy | service | cost parallel branches)
                          → checkpoint_analysis_synthesis_agent
```

- **DIY branch (`diy_agent`)**: Python orchestrator tool `run_diy_pipeline` (parallel fetch + single synthesis); see `sub_agents/diy_agent/orchestrator.py`.
- **Service branch (`service_agent`)**: `serpapi_search` (Langchain) + **`google_search`** tool directly (no nested search sub-agent).
- **Cost / coverage**: unchanged modules under `sub_agents/`.

## Routing (root)

See `prompts.py` → `root_agent_instructions()`:

- **`primary_agent`** (highest priority): `"checkpoint"` or `"docs"` → always delegate to `doculink_agent` with the right downstream behavior.
- **Legacy**: non-empty `checkpoint_ids` → `doculink_agent` (checkpoint path).
- **Otherwise**: property-related queries → `doculink_agent`; casual / non-property → short direct reply, no tools.

## DocuLink tool selection

See `doculink_agent_system_instruction()` in `prompts.py`: priority among `checkpoint_agent`, `ask_user_docs_agent`, and `ask_knowledge_base_agent` based on `primary_agent`, `checkpoint_ids`, query intent, and `context_doc_uris`.

## Inputs

- Root: `DiagnosisInput` in `agent_inputs.py` (`user_query`, optional `context_doc_uris`, `diagnosis_uris`, `checkpoint_ids`, `property_address`, `property_id`, `primary_agent`, `checkpoint_optional_agents`, location fields, …).
- DocuLink / checkpoint tools: `DocsInput` (overlapping fields for delegation).

## Key files

| Path | Role |
|------|------|
| `agent.py` | `doculink_agent`, `root_agent`, `app` (ADK session compaction) |
| `app_config.py` | `property_app` + `EventsCompactionConfig` (env-tunable) |
| `vertex_adk_app.py` | `HomecareAdkApp` for Agent Engine deploy |
| `memory_bank.py` | Memory Bank ingest (`ingest_events`) + env toggles |
| `prompts.py` | Root + DocuLink system instructions |
| `agent_inputs.py` | Pydantic schemas |
| `sub_agents/checkpoint_agent/` | Retrieval + optional `checkpoint_analysis_agent` |
| `sub_agents/checkpoint_analysis_agent/` | Parallel optional agents + synthesis |
| `sub_agents/diy_agent/` | DIY orchestrator + thin `diy_agent` |
| `sub_agents/service_agent/` | Local pros + `google_search` |
| `sub_agents/cost_agent/`, `coverage_agent/`, `shopping_agent/`, … | As named |

## Quick start

From `gcp/agents/homecare`:

```bash
make setup
make run          # adk run property_agent
# or
adk web           # pick property_agent
```

Environment: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `SERP_API_KEY` where tools need them. For DIY YouTube search, set `YOUTUBE_API_KEY` (YouTube Data API v3; required). See `gcp/agents/homecare/README.md` for UV, auth, and deployment.

## Conventions

- Default model: see `model_config.py` (`GLOBAL_GEMINI_MODEL`).
- Prefer returning tool/sub-agent outputs **verbatim** unless DocuLink’s instruction explicitly allows a prefaced best-effort fallback when retrieval is empty.
- Do not ask users to upload URIs from the root; routing uses fields already on the input payload.

## Programmatic sketch

```python
from property_agent.agent import root_agent

# ADK supplies session/context; shape is illustrative
response = root_agent.invoke({
    "user_query": "What changed in my kitchen checkpoints?",
    "property_id": "...",
    "checkpoint_optional_agents": ["diy", "service"],
})
```

Consumers parse JSON/markdown from the delegated path (especially checkpoint analysis dual format: markdown first, then a fenced JSON block whose root has an `analysis` object).
