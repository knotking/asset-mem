# Inspection Report Analysis Agent

## Overview

The Inspection Report Agent is a specialized DocuLink sub-agent that analyzes property inspection reports when selected in AI chat. Reports are uploaded to cloud storage, indexed in the RAG corpus, and can be queried via the agent for structured findings, recommendations, and issue summaries.

## Architecture

```
Root Property Agent
└── DocuLink Agent
    ├── Checkpoint Agent
    ├── User Docs Agent
    ├── Knowledge Base Agent
    └── Inspection Report Agent  ← NEW
```

**Location**: `gcp/agents/homecare/property_agent/sub_agents/inspection_report_agent/`

## Data Flow

1. **Upload**: User uploads inspection reports (Details tab or property creation). Documents are classified as `INSPECTION_REPORT` by `extractDocInfo` and indexed via `postFileToAgent` (RAG).
2. **Selection**: In chat, user sets Primary Agent to **Inspection** and selects inspection reports via the Inspection Report Selector drawer.
3. **Request**: Frontend sends `inspection_report_ids` (Firestore doc IDs) and `context_doc_uris` (gs:// URIs of selected reports) with `primary_agent: "inspection"`.
4. **Routing**: Root agent delegates to DocuLink when `inspection_report_ids` is present. DocuLink routes to `inspection_report_agent`.
5. **Retrieval**: Agent tool `ask_inspection_reports_retrieval` uses `get_rag_file_ids` and RAG `retrieval_query` over the selected reports.
6. **Analysis**: Agent LLM synthesizes the retrieved chunks into structured analysis (Summary, Critical/Major/Minor Issues, Recommendations, Property Details).

## Inputs

- **user_query**: Natural language question about the inspection reports.
- **context_doc_uris**: **Required** for inspection mode. gs:// URIs of the selected inspection reports.
- **property_address**, **property_id**: Optional context.

`inspection_report_ids` (Firestore doc IDs) are used for routing; `context_doc_uris` are used for RAG.

## Output

The agent returns Markdown-oriented analysis, including:

- **Summary**: Overview of findings and property condition.
- **Critical Issues**: Safety or structural concerns.
- **Major Issues**: Significant defects.
- **Minor Issues**: Cosmetic or lower-priority items.
- **Recommendations**: Next steps.
- **Property Details / Inspection Metadata**: Address, date, inspector, inspection type when available.

## API

### Request (Agent/SSE)

When using the Inspection Report Agent, the request must include:

- `inspection_report_ids`: `string[]` – Firestore document IDs of selected inspection reports.
- `context_doc_uris`: `string[]` – gs:// URIs of those same reports (used for RAG).
- `primary_agent`: `"inspection"` (optional but recommended for inspection-only flows).

### Example

```json
{
  "user_id": "uid",
  "session_id": "...",
  "user_query": "What are the critical issues in my inspection report?",
  "primary_agent": "inspection",
  "inspection_report_ids": ["doc_firestore_id_1"],
  "context_doc_uris": ["gs://bucket/path/to/report1.pdf"],
  "property_address": "123 Main St",
  "property_id": "prop_123"
}
```

## Frontend

### Chat

- **Primary Agent**: Add **Inspection** in Chat Settings (with Analysis and Checkpoint).
- **Inspection Report Selector**: Sheet/drawer to multi-select inspection reports (filtered by `documentType === 'INSPECTION_REPORT'`).
- **Chat Input**: When Primary Agent is Inspection, show “Select inspection reports to analyze” and badges for selected reports.

### Request Build (Chat Page)

- If `primary_agent === 'inspection'` and `selectedInspectionReports.length > 0`:
  - `inspection_report_ids` = `selectedInspectionReports.map(d => d.id)`
  - `context_doc_uris` = `selectedInspectionReports.map(d => d.gsURI).filter(Boolean)`

## Dependencies

- **USER_UPLOAD_RAG_CORPUS**: RAG corpus for user documents.
- **GOOGLE_CLOUD_BUCKET**, **USER_UPLOAD_FOLDER**: GCS paths for RAG import-results (used by `get_rag_file_ids` from `user_docs_agent`).

## Files

- `gcp/agents/homecare/property_agent/sub_agents/inspection_report_agent/agent.py` – Agent and `ask_inspection_reports_retrieval` tool.
- `gcp/agents/homecare/property_agent/sub_agents/inspection_report_agent/prompts.py` – Agent instructions.
- `gcp/agents/homecare/property_agent/sub_agents/inspection_report_agent/README.md` – Module README.
- `apps/webapp/src/components/chat/inspection-report-selector.tsx` – Inspection report selector UI.
- `gcp/proxy/api/schemas/agent.py` – `inspection_report_ids` and `primary_agent` on `AgentRequest`.
- `gcp/proxy/api/services/vertex_service.py` – Pass-through of `inspection_report_ids` and `primary_agent` into the agent payload.

## Related

- [Inspection Report (User Flows, Webapp & Mapp)](../inspection/README.md)
- [Analysis Agent Overview](./ANALYSIS_AGENT_OVERVIEW.md)
- [Analysis Agent Workflow](./ANALYSIS_AGENT_WORKFLOW.md)
- [Checkpoint Feature](../checkpoint/CHECKPOINT_FEATURE_PLAN.md)
- Document analysis: `apps/mapp/docs/DOCUMENT_ANALYSIS.md`
