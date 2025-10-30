# Knowledge Base Agent

This sub-agent retrieves authoritative information from a configured Vertex AI RAG corpus and returns a concise, cited answer. It is invoked by the DocuLink Agent when no user context documents are provided.

## What it does
- Uses `VertexAiRagRetrieval` to query a RAG corpus
- Synthesizes an answer strictly from retrieved chunks
- Emits citations at the end of the answer
- If nothing relevant is found, returns a fixed no-info message

## Where it lives
- Agent wiring:

```startLine:endLine:gcp/agents/homecare/property_agent/sub_agents/knowledge_base_agent/agent.py
12:38
```

- System instructions and citation rules:

```startLine:endLine:gcp/agents/homecare/property_agent/sub_agents/knowledge_base_agent/prompts.py
10:44
```

## Configuration
- Environment variable: `KNOWLEDGE_BASE_RAG_CORPUS`
  - Example format: `projects/<PROJECT_NUMBER>/locations/us-central1/ragCorpora/<CORPUS_ID>`
  - Set this in your `.env` before running
- Optional tuning via `agent.py`:
  - `similarity_top_k` (default 10)
  - `vector_distance_threshold` (default 0.6)

## Invocation context
The DocuLink Agent decides whether to call this agent vs. the user-docs agent. If `context_doc_uris` are not provided or empty, the DocuLink Agent uses this knowledge base agent.

## Response shape
- Primary output is a concise textual answer with a trailing "Citations:" section
- If no results: "No relevant information could be found in the knowledge base to answer this question."

## Example
Input: "What does washer error E3 typically mean?"

Possible response:

```
E3 usually indicates an out-of-balance load condition. Pause the cycle, redistribute the laundry evenly, and ensure the machine is on a level surface. If the error persists, reduce the load size and re-run the spin cycle.

Citations:
- Washing Machine User Guide, Error Codes
- Troubleshooting Guide, Balance and Leveling
```

## Notes
- Answers must be derived only from retrieved content; no speculation
- Include model/brand identifiers if explicitly present in retrieved chunks
- Do not reveal tool calls or chain-of-thought; return only the final answer
