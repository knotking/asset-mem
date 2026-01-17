# Inspection Report Agent

## Overview

The Inspection Report Agent is a DocuLink sub-agent that analyzes property inspection reports. When users select inspection reports in AI chat, it retrieves content from the RAG corpus and synthesizes structured analysis: findings, recommendations, and issue summaries.

## Purpose

- **Retrieve:** Semantic search over inspection reports indexed in the user RAG corpus.
- **Analyze:** Structure findings into Critical/Major/Minor issues, recommendations, and metadata.
- **Answer:** Respond to natural language questions about the selected inspection reports.

## Architecture

- **Parent:** DocuLink Agent
- **Input:** `DocsInput` (`user_query`, `context_doc_uris`, `property_address`, `property_id`)
- **Tool:** `ask_inspection_reports_retrieval` — RAG retrieval scoped to `context_doc_uris` (gs:// URIs of selected reports)

## Data Flow

1. User selects inspection reports in chat → frontend sends `inspection_report_ids` and `context_doc_uris` (gsURIs).
2. Root/DocuLink routes to `inspection_report_agent` when `inspection_report_ids` is present.
3. Agent calls `ask_inspection_reports_retrieval(user_query, context_doc_uris)`.
4. `get_rag_file_ids(user_id, context_doc_uris)` resolves RAG file IDs from GCS import-results.
5. `rag.retrieval_query` returns relevant chunks.
6. Agent LLM synthesizes Markdown/structured analysis from chunks.

## Output Format

The agent aims to produce:

- **Summary:** Overview of inspection and property condition.
- **Critical Issues:** Immediate safety/structural concerns.
- **Major Issues:** Significant defects.
- **Minor Issues:** Cosmetic or lower-priority items.
- **Recommendations:** Next steps.
- **Property Details / Metadata:** Address, date, inspector, inspection type when available.

## Dependencies

- `USER_UPLOAD_RAG_CORPUS`: RAG corpus containing user documents.
- `GOOGLE_CLOUD_BUCKET`, `USER_UPLOAD_FOLDER`: GCS paths for import-results (used by `get_rag_file_ids` from `user_docs_agent`).

## Routing

- Invoked by DocuLink when `inspection_report_ids` is non-empty; DocuLink passes `context_doc_uris` as the gsURIs of those reports.
- `primary_agent: "inspection"` also routes to DocuLink with instructions to use the inspection report agent.
