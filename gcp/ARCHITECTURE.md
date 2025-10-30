# GCP Architecture

This document defines the complete architecture of agents and supporting services under `gcp/`.

## 1. Agents (`gcp/agents/homecare`)

The Homecare agents implement a multi-agent system centered on the root Property Agent, with specialized sub-agents for retrieval and diagnostics.

### 1.1 Root Property Agent (`property_agent`)
- Location: `gcp/agents/homecare/property_agent/agent.py`
- Role: Orchestrator that routes requests based on input.
- Routing rules and instructions:

```startLine:endLine:gcp/agents/homecare/property_agent/prompts.py
8:36
```

- DocuLink sub-agent behavior and tool selection:

```startLine:endLine:gcp/agents/homecare/property_agent/prompts.py
52:65
```

- Input schema used by the root agent and DocuLink:

```startLine:endLine:gcp/agents/homecare/property_agent/agent_inputs.py
4:14
```

The root agent constructs:
- `doculink_agent` for retrieval
- `analysis_agent` for multimodal diagnostics

```startLine:endLine:gcp/agents/homecare/property_agent/agent.py
21:45
```

### 1.2 DocuLink Agent (`doculink_agent`)
- Location: constructed in `property_agent/agent.py`
- Purpose: Answer using either user-uploaded documents or a general knowledge base.
- Tools:
  - `user_docs_agent` (preferred when `context_doc_uris` provided)
  - `knowledge_base_agent` (fallback when no context is provided)

### 1.3 Diagnostics/Analysis Agent (`analysis_agent`)
- Location: `gcp/agents/homecare/property_agent/sub_agents/analysis_agent/`
- Purpose: Multimodal triage and end-to-end diagnostic workflow (DIY, providers, products, costs).
- See detailed doc:

```startLine:endLine:gcp/agents/homecare/property_agent/sub_agents/analysis_agent/README.md
1:32
```

### 1.4 Knowledge Base Agent
- Location: `gcp/agents/homecare/property_agent/sub_agents/knowledge_base_agent/`
- Purpose: Retrieve answers from a configured Vertex AI RAG corpus.
- Wiring and tool config:

```startLine:endLine:gcp/agents/homecare/property_agent/sub_agents/knowledge_base_agent/agent.py
12:38
```

- Instruction and citation requirements:

```startLine:endLine:gcp/agents/homecare/property_agent/sub_agents/knowledge_base_agent/prompts.py
10:44
```

### 1.5 User Docs Agent
- Location: `gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/`
- Purpose: Retrieve answers from a user’s uploaded documents filtered by matching `context_doc_uris`.
- Retrieval flow and agent wiring:

```startLine:endLine:gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/agent.py
24:100
```

- Instruction and citation requirements:

```startLine:endLine:gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/prompts.py
8:47
```

## 2. End-to-end Flow

1. Input arrives with `user_query`, optional `context_doc_uris`, optional `diagnosis_uris`, and optional `property_address`.
2. Root Property Agent routing:
   - If `diagnosis_uris` present → delegate to `analysis_agent`.
   - Else → delegate to `doculink_agent`.
3. DocuLink tool selection:
   - If `context_doc_uris` provided → use `user_docs_agent` over user corpus files matching those URIs.
   - Else → use `knowledge_base_agent` over general RAG corpus.
4. Response:
   - Root returns the sub-agent’s response verbatim (or a simple greeting for casual queries).

## 3. Response Schemas

The OpenAPI schema for the Property Agent response lives at:
- `gcp/agents/homecare/property_agent/openapi.yaml`

It describes a `PropertyAgentResponse` that can be a structured object (diagnostics aggregate), a retrieval payload, or a plain string for small talk.

## 4. Proxy/API and Workers (`gcp/proxy`)

The proxy exposes REST endpoints and manages file ingestion and RAG imports via Pub/Sub workers.

### 4.1 API Service (`proxy/api/`)
- Entrypoint: `proxy/api/main.py`
- Responsibilities: webhooks, session creation, agent invocation, file upload orchestration.
- Integrations: Firebase, Telegram, Vertex AI client.

### 4.2 Workers (`proxy/workers/function`)
- Pub/Sub-triggered function to import uploaded files into Vertex AI RAG corpus.
- Publishes import results back to a results topic which the API consumes.

## 5. Data and Control Flows

1. User sends message/uploads → API receives via webhook.
2. API invokes root agent or enqueues upload work.
3. Workers import content to RAG corpus and emit `FileId` results.
4. For queries, root agent routes to DocuLink or Analysis per rules; DocuLink picks tool by context presence.
5. Sub-agents call external tools/APIs as needed; results are returned verbatim by the root.

## 6. Environments and Configuration
- Core environment variables (see sub-agent READMEs for details):
  - `KNOWLEDGE_BASE_RAG_CORPUS`
  - `USER_UPLOAD_RAG_CORPUS`
  - `GOOGLE_CLOUD_BUCKET`, `USER_UPLOAD_FOLDER`
  - Project/location and Reasoning Engine IDs for deployment

## 7. Deployment
- See `gcp/agents/homecare/README.md` for Make targets and deployment steps.
- After deploy, update `.env` with the Agent Engine resource and RAG corpus identifiers.

## 8. Error Handling and Guarantees
- Root returns sub-agent output verbatim; no post-processing.
- DocuLink agents must return a fixed no‑info message when retrieval yields nothing.
- Analysis agent uses guard clauses: if triage fails, return triage-only result.
