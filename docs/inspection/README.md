# Inspection Report Analysis

## Overview

The Inspection Report feature lets users select property inspection reports in AI chat and query them via a dedicated **Inspection** primary agent. Reports are uploaded to cloud storage, indexed in the RAG corpus, and analyzed for structured findings, recommendations, and issue summaries.

This is available in both **webapp** and **mapp** (mobile).

---

## What It Does

- **Primary Agent: Inspection** – Choose “Inspection” in chat settings to route queries to the inspection-report agent.
- **Select Reports** – Pick one or more inspection reports (documents with `documentType === 'INSPECTION_REPORT'`) as context.
- **Query** – Ask questions such as:
  - “What are the critical issues?”
  - “Summarize the findings”
  - “What does the inspector recommend?”
- **Structured Answer** – The agent returns analysis with Summary, Critical/Major/Minor Issues, Recommendations, and property/inspection metadata when available.

---

## User Flows

### Webapp

1. Open a property chat session.
2. In chat settings (or compact bar), set **Primary Agent** to **Inspection**.
3. Use **Inspection Report Selector** (button/sheet in the chat input area):
   - Opens a sheet listing inspection reports for the property.
   - Multi-select reports; selected ones appear as badges.
   - Remove via X on a badge or by toggling in the sheet.
4. Optionally type a question, or send with only reports selected (e.g. “Summarize” or “What are the main issues?”).
5. Send; the request includes `inspection_report_ids` and `context_doc_uris` for the selected reports.

**Components**

- `InspectionReportSelector` – sheet and badges.
- `ChatInput` – selector trigger, badges, and send logic when Inspection is primary.
- `ChatSettingsPopover` / `CompactSettingsBar` – “Inspection” as a primary agent option.

### Mapp (Mobile)

1. Open a property and go to the **AI Chat** tab.
2. In chat settings (or compact bar), set **Primary Agent** to **Inspection**.
3. Tap the **FileSearch** (inspection reports) icon in the header to open the **Inspection Reports** drawer.
4. In the drawer, multi-select inspection reports; selected ones appear in the **Selected Context** strip below the header.
5. Remove reports via the strip (X on a chip) or by toggling in the drawer. “Clear All” clears inspection reports too.
6. Type a question or send with only reports (e.g. “Summarize”); send includes `inspection_report_ids` and `context_doc_uris`.

**Components**

- `InspectionReportsDrawerContent` – drawer to select/deselect reports.
- Property-details header – FileSearch button and badge when `primaryAgent === 'inspection'`.
- “Selected Context” strip – inspection report chips when in Inspection mode.
- `ChatSettingsModal` / `CompactSettingsBar` – “Inspection” primary agent option.

---

## API and Request Format

### Agent/SSE Request

When using the Inspection agent, the request must include:

| Field                   | Type       | Description                                                                 |
|-------------------------|------------|-----------------------------------------------------------------------------|
| `inspection_report_ids` | `string[]` | Firestore document IDs of the selected inspection reports.                 |
| `context_doc_uris`      | `string[]` | `gs://` URIs of those same reports (used for RAG retrieval).              |
| `primary_agent`         | `"inspection"` | Optional but recommended so the backend routes to the inspection agent. |

### Example

```json
{
  "user_id": "uid",
  "session_id": "agent_session_id",
  "user_query": "What are the critical issues in my inspection report?",
  "primary_agent": "inspection",
  "inspection_report_ids": ["doc_id_1", "doc_id_2"],
  "context_doc_uris": ["gs://bucket/path/report1.pdf", "gs://bucket/path/report2.pdf"],
  "property_address": "123 Main St"
```

### Frontend Request Build

- **Webapp** (when `primary_agent === 'inspection'` and `selectedInspectionReports.length > 0`):
  - `inspection_report_ids` = `selectedInspectionReports.map(d => d.id)`
  - `context_doc_uris` = `selectedInspectionReports.map(d => d.gsURI).filter(Boolean)`

- **Mapp** (same condition):
  - `inspection_report_ids` = `selectedInspectionReports.map(d => d.id)`
  - `context_doc_uris` = `selectedInspectionReports.map(d => d.gsURI).filter(Boolean)`

---

## Architecture and Data Flow

1. **Upload** – Inspection reports are added via property Details or creation. `extractDocInfo` can classify them as `INSPECTION_REPORT`; they are indexed via `postFileToAgent` (RAG).
2. **Selection** – User sets Primary Agent to **Inspection** and selects reports (webapp: selector sheet; mapp: inspection drawer).
3. **Request** – Frontend sends `inspection_report_ids`, `context_doc_uris`, and `primary_agent: "inspection"`.
4. **Routing** – Root agent sees `inspection_report_ids` and delegates to DocuLink; DocuLink calls `inspection_report_agent`.
5. **Retrieval** – `ask_inspection_reports_retrieval` uses `get_rag_file_ids` and RAG `retrieval_query` over the selected URIs.
6. **Response** – The agent LLM turns retrieved chunks into Summary, Critical/Major/Minor Issues, Recommendations, and metadata.

```
Root Property Agent
└── DocuLink Agent
    ├── Checkpoint Agent
    ├── User Docs Agent
    ├── Knowledge Base Agent
    └── Inspection Report Agent
```

---

## Files

### Backend / Agent

- `gcp/agents/homecare/property_agent/sub_agents/inspection_report_agent/agent.py` – Agent and `ask_inspection_reports_retrieval` tool.
- `gcp/agents/homecare/property_agent/sub_agents/inspection_report_agent/prompts.py` – Agent instructions.
- `gcp/agents/homecare/property_agent/prompts.py` – Routing for `inspection_report_ids` and `inspection_report_agent`.
- `gcp/agents/homecare/property_agent/agent.py` – DocuLink tool: `inspection_report_agent`.
- `gcp/proxy/api/schemas/agent.py` – `AgentRequest`: `inspection_report_ids`, `primary_agent`.
- `gcp/proxy/api/services/vertex_service.py` – Pass-through of `inspection_report_ids` and `primary_agent`.

### Webapp

- `apps/webapp/src/components/chat/inspection-report-selector.tsx` – Inspection report selector (sheet + badges).
- `apps/webapp/src/components/chat/chat-input.tsx` – Selector integration, send with `inspection_report_ids` and `context_doc_uris`.
- `apps/webapp/src/components/chat/chat-settings-popover.tsx` – “Inspection” primary agent.
- `apps/webapp/src/components/chat/compact-settings-bar.tsx` – “Inspection” in compact bar.
- `apps/webapp/src/app/home/properties/[propertyId]/chat/[sessionId]/page.tsx` – State, `inspectionReports`, request body.

### Mapp

- `apps/mapp/components/property-details/InspectionReportsDrawerContent.tsx` – Drawer for selecting inspection reports.
- `apps/mapp/components/ChatSettingsModal.tsx` – “Inspection” primary agent.
- `apps/mapp/components/CompactSettingsBar.tsx` – “Inspection” in compact bar.
- `apps/mapp/app/(tabs)/home/property-details/index.tsx` – `selectedInspectionReports`, drawer, header button, strip, send, `inspectionReports`.
- `apps/mapp/lib/api.ts` – `StreamAgentResponseParams.inspectionReportIds`, request body `inspection_report_ids`.
- `apps/mapp/lib/query-suggestions.ts` – `suggestsInspectionAgent`, `suggestPrimaryAgent` for `'inspection'`.

### Shared Types

- `apps/common/src/types.ts` – `PrimaryAgent` includes `"inspection"`.

---

## Dependencies

- **USER_UPLOAD_RAG_CORPUS** – RAG corpus for user documents.
- **GOOGLE_CLOUD_BUCKET**, **USER_UPLOAD_FOLDER** – GCS paths used by `get_rag_file_ids` (via `user_docs_agent` pattern).

---

## Related Documentation

- [Inspection Report Agent (Analysis/Backend)](../analysis/INSPECTION_REPORT_AGENT.md) – Agent design, tool, and RAG.
- [Checkpoint Chat Integration](../checkpoint/CHECKPOINT_CHAT_INTEGRATION.md) – Similar primary-agent and selection pattern.
- [Document Analysis](../../apps/mapp/docs/DOCUMENT_ANALYSIS.md) – Document upload and `INSPECTION_REPORT` classification.
