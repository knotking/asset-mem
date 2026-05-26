# User Docs Agent

This sub-agent answers questions using the user’s uploaded documents together with any provided `context_doc_uris`. The root `property_agent` executor invokes it via `ask_user_docs_agent` when resolve sets `route=user_docs` or `primary_agent=docs`.

## What it does
- Finds user-specific file IDs from GCS import results for the current user
- Queries Vertex AI RAG over those file IDs (and corpus) for relevant chunks
- Synthesizes a concise answer from retrieved snippets with citations
- Returns a fixed no-info message if nothing relevant is found

## Where it lives
- Agent and retrieval flow:

```startLine:endLine:gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/agent.py
24:100
```

- System instructions and citation rules:

```startLine:endLine:gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/prompts.py
8:47
```

## Configuration
Set these environment variables in `.env`:
- `GOOGLE_CLOUD_BUCKET`: GCS bucket containing user import results
- `USER_UPLOAD_FOLDER`: Base folder for user uploads (default `uploads`)
- `USER_UPLOAD_RAG_CORPUS`: Vertex RAG corpus resource name to query

Authentication: ADC is required for GCS and Vertex AI (e.g., `gcloud auth application-default login`).

## How it decides which files to search
- Reads `uploads/<user_id>/import-results/*.json|*.ndjson`
- Extracts `FileId` entries whose `Filename` matches provided `context_doc_uris`
- Uses these `FileId`s with `USER_UPLOAD_RAG_CORPUS` to scope RAG retrieval

## Response shape
- On matches: returns an answer synthesized from retrieved text with a trailing “Citations:” section
- On no matches: returns "No relevant information could be found in your uploaded documents or provided context to answer this question."

## Example
Input: "What does E3 error mean for my washer? See my manual."

Possible response:
```
E3 indicates an out-of-balance load. Pause the cycle, redistribute items evenly, and ensure the washer is level. If errors continue, reduce load size and run a spin-only cycle.

Citations:
- Washer Model X1000 User Manual, Error Codes
```

## Notes
- Answers must be derived only from retrieved content; no speculation
- Include model/brand identifiers if present in retrieved chunks
- Do not reveal tool calls or chain-of-thought; return only the final answer
