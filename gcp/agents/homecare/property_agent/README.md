# Property Agent

The Property Agent is the orchestrator for comprehensive property care support within the Homecare AI system. It routes user requests to the right specialized capability: either retrieving answers from documents/knowledge bases or performing multimodal diagnostics when users provide media for analysis.

## Scope

The Property Agent handles a wide range of property-related queries:
- **Repairs and Maintenance**: Plumbing, electrical, HVAC, appliances, vehicle issues, structural problems
- **Pest Control**: Insect infestations, rodent problems, wildlife issues, pest prevention and treatment
- **Service Recommendations**: Finding and recommending local service providers, contractors, professionals
- **Product Requests**: Product recommendations, shopping queries, purchase advice for property-related items
- **General Property Care**: Home improvement, maintenance tips, property management, preventive care

## What it does
- Routes queries based on inputs using strict rules
  - If `diagnosis_uris` are present → delegate to the Analysis Agent
  - Otherwise → delegate to the DocuLink Agent for retrieval from user docs or the general knowledge base
- Returns the sub‑agent's response verbatim without modification
- Handles simple, non-property-care small‑talk directly

## Architecture
- Root agent defined in `agent.py` constructs two agents:
  - `doculink_agent` with tools: `user_docs_agent`, `knowledge_base_agent`
  - `root_agent` named `property_agent` with sub‑agents: `analysis_agent`, `doculink_agent`

Key files:
- `agent.py` – builds `property_agent` and sub‑agents
- `agent_inputs.py` – input schemas
- `prompts.py` – system instructions and routing logic
- `sub_agents/` – implementations for analysis, user docs, and knowledge base

## Inputs
Schemas (from `agent_inputs.py`):

```startLine:endLine:gcp/agents/homecare/property_agent/agent_inputs.py
1:14
```

Routing logic (from `prompts.py`):

```startLine:endLine:gcp/agents/homecare/property_agent/prompts.py
10:36
```

DocuLink tool selection (from `prompts.py`):

```startLine:endLine:gcp/agents/homecare/property_agent/prompts.py
52:65
```

## Quick start
From `gcp/agents/homecare` (inherits the same toolchain and Makefile):

```bash
# Setup once
make setup

# Run locally via ADK
make run
# or
adk run property_agent

# Web UI (choose property_agent)
adk web

# Run evals
make test-eval
```

Requirements: Python 3.9+, UV, Google Cloud auth if using Vertex RAG/Search or deployed evaluations. See the parent `gcp/agents/homecare/README.md` for environment setup, RAG corpus config, and deployment.

## How delegation works (at a glance)
- If `diagnosis_uris` provided: `analysis_agent` performs multimodal analysis (images/videos/docs)
- If `diagnosis_uris` absent: `analysis_agent` performs text‑only triage from `user_query` (and `property_address` if present), then continues with coverage, DIY, and service
- The root returns the sub‑agent response as‑is

## Programmatic use
Import and invoke with the ADK runtime:

```python
from gcp.agents.homecare.property_agent.agent import root_agent

# The ADK typically handles session/user context; this shows the input shape
response = root_agent.invoke({
    "user_query": "My washing machine shows error E3, what does it mean?",
    "context_doc_uris": ["gs://my-bucket/manuals/washer.pdf"],
    "property_address": "123 Main St, Springfield, USA"
})
print(response)
```

Note: Tool calls may require environment variables and GCP auth (ADC). See parent README for `.env` and permission setup.

## Sub‑agents
- `sub_agents/analysis_agent/` – multimodal or text‑only diagnostics followed by coverage, DIY, and service
- `sub_agents/user_docs_agent/` – retrieval over user‑uploaded docs (used by coverage and other flows)
- `sub_agents/knowledge_base_agent/` – retrieval over general knowledge base (used when needed)

## Conventions
- Gemini 2.5 Flash as the default model
- Responses from retrieval/analysis must not be altered by the root agent
- Never ask users to upload or provide URIs; route strictly based on presence of `diagnosis_uris`

# Property Agent

## Overview

`property_agent` is the main orchestrator for the Home Care AI system. It routes user requests to the correct capability based on available inputs, coordinating multimodal analysis, document retrieval, DIY guidance, and professional services.

- Handles home care and vehicle-related diagnostics and information needs
- Delegates to specialized sub-agents based on input presence (notably `diagnosis_uris`)
- Returns a single structured JSON response from the delegated sub-agent

## Architecture

```
property_agent (root orchestrator)
├── analysis_agent           # Multimodal diagnostics workflow orchestrator
│   ├── triage_agent         # analyse_multimodal_data (in analysis_agent module)
│   ├── coverage_agent       # ask_user_docs_retreival (separate module)
│   ├── diy_agent            # google_search_agent, youtube_search, shopping_agent (separate modules)
│   ├── service_agent        # serpapi_search, yelpapi_search, cost_estimation (separate module)
│   ├── shopping_agent      # product_recommendations (separate reusable module)
│   └── cost_agent           # cost_estimation, cost_estimation_diy (separate module)
└── doculink_agent           # Context and knowledge retrieval workflow
    ├── user_docs_agent      # user-specific docs and stores
    └── knowledge_base_agent # general knowledge base
```

Key files:
- `agent.py`: defines `property_agent` and its sub-agents
- `prompts.py`: system instructions for routing and doculink behavior
- `agent_inputs.py`: Pydantic input models for root and sub-agents
- `sub_agents/analysis_agent`: complete analysis workflow and README
- `sub_agents/user_docs_agent`: user document retrieval logic
- `sub_agents/knowledge_base_agent`: general knowledge retrieval logic

## Routing Logic (root)

The root agent inspects inputs and chooses the correct sub-agent:

- If `diagnosis_uris` exist and are non-empty: delegate to `analysis_agent`
- If `diagnosis_uris` are absent/empty: delegate to `analysis_agent` for text‑only triage, then coverage, DIY, service
- If the query is casual/non-property-care, respond directly without delegation

See `root_agent_instructions()` in `prompts.py` for the precise decision tree.

## Input Schemas

Root input (`DiagnosisInput` from `agent_inputs.py`):

```json
{
  "user_query": "string",
  "context_doc_uris": ["string"],
  "diagnosis_uris": ["string"],
  "property_address": "string"
}
```

DocuLink input (`DocsInput`):

```json
{
  "user_query": "string",
  "context_doc_uris": ["string"],
  "property_address": "string"
}
```

## Output Shapes

- From `analysis_agent`: nested `analysis` object that includes triage (from media or text), coverage, DIY, and service sections (see `sub_agents/analysis_agent/README.md`).
- From `doculink_agent` (if invoked in custom flows): the direct output of either `user_docs_agent` or `knowledge_base_agent` (unmodified), or a best‑effort answer clearly prefaced when retrieval yields nothing.

## Sub-Agent Summaries

- **analysis_agent**: Orchestrator that runs multimodal triage first; if valid diagnosis, proceeds with coverage retrieval, DIY (steps, videos, products), and service (costs, local pros). Has a built-in triage guard to short-circuit on invalid inputs. Coordinates the following sub-agents:
  - **triage_agent**: Analyzes multimodal data or performs text-only triage
  - **coverage_agent**: Retrieves warranty/insurance from user documents
  - **diy_agent**: Provides DIY repair steps, YouTube tutorials, and product recommendations via shopping_agent
  - **service_agent**: Finds local service providers and provides cost estimates
  - **shopping_agent**: Reusable agent for product recommendations (used by DIY agent)
  - **cost_agent**: Provides DIY vs Service cost estimates
- **doculink_agent**: If `context_doc_uris` are provided, uses `user_docs_agent`; otherwise uses `knowledge_base_agent`. Returns results as-is without rewriting.

## Usage

Programmatic use (pseudo):

```python
from gcp.agents.homecare.property_agent.agent import root_agent
from gcp.agents.homecare.property_agent.agent_inputs import DiagnosisInput

inputs = DiagnosisInput(
    user_query="Washer making grinding noise",
    diagnosis_uris=["gs://bucket/washer_video.mp4"],
    context_doc_uris=["gs://bucket/warranty.pdf"],
    property_address="123 Main St, Springfield, IL"
)

# Invoke within your agent runtime/session
result = root_agent.run(inputs)
```

Notes:
- Ensure environment variables for external tools are set where applicable: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `SERP_API_KEY`, `YELP_API_KEY`, `YELP_URL`.
- The orchestrator does not modify sub-agent outputs; consumers should parse the returned JSON per the delegated path.
