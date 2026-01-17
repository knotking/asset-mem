# Inspection Agent

This sub-agent analyzes and retrieves information from property inspection reports. It is selected by the DocuLink Agent when users query about inspection findings, issues, or recommendations.

## What it does
- Retrieves relevant sections from inspection reports using Vertex AI RAG
- Filters to property-specific inspection reports using property_id
- Analyzes uploaded inspection reports to extract structured findings
- Provides intelligent answers about inspection issues, costs, urgency, and recommendations
- Cites specific report sections and page numbers

## Where it lives
- Agent and retrieval flow: `gcp/agents/homecare/property_agent/sub_agents/inspection_agent/agent.py`
- System instructions: `gcp/agents/homecare/property_agent/sub_agents/inspection_agent/prompts.py`

## Key Functions

### `ask_inspection_retrieval(user_query, property_id, context_doc_uris, tool_context)`
Retrieves relevant sections from inspection reports using Vertex AI RAG.

**Parameters:**
- `user_query`: Natural language query about inspection findings
- `property_id`: Required - scopes to property-specific reports
- `context_doc_uris`: Optional list of specific inspection report URIs to query
- `tool_context`: Provides user_id and session context

**Returns:**
- List of text chunks from inspection reports
- "No matching result found" if no relevant content

**How it works:**
1. Gets user_id from tool_context
2. Fetches RAG file IDs for inspection reports from GCS import-results
3. Filters to reports matching context_doc_uris if provided
4. Queries Vertex AI RAG corpus with top_k=10, threshold=0.6
5. Returns retrieved text chunks for agent to synthesize

### `analyze_inspection_report(user_query, gcs_url, tool_context)`
Analyzes uploaded inspection report documents to extract structured findings.

**Parameters:**
- `user_query`: Analysis instructions or specific questions
- `gcs_url`: GCS URI of the inspection report document (gs://bucket/path)
- `tool_context`: Provides user_id and session context

**Returns:**
- JSON string with structured inspection findings
- Error message if analysis fails

**Extracts:**
- Summary and metadata (date, inspector, property)
- Issues by category (structural, electrical, plumbing, HVAC, etc.)
- Severity levels (critical, major, moderate, minor)
- Cost estimates and urgency timelines
- Inspector recommendations

## Configuration

Set these environment variables in `.env`:
- `GOOGLE_CLOUD_BUCKET`: GCS bucket containing user uploads
- `USER_UPLOAD_FOLDER`: Base folder for user uploads (default: "uploads")
- `USER_UPLOAD_RAG_CORPUS`: Vertex RAG corpus resource name
- `GOOGLE_CLOUD_PROJECT`: GCP project ID
- `GOOGLE_CLOUD_LOCATION`: GCP region (e.g., us-central1)

Authentication: ADC is required for GCS and Vertex AI.

## Integration

The inspection agent is integrated into the doculink_agent as a tool:

```python
doculink_agent = Agent(
    ...
    tools=[
        AgentTool(user_docs_agent),
        AgentTool(knowledge_base_agent),
        AgentTool(checkpoint_agent),
        AgentTool(inspection_agent)  # NEW
    ]
)
```

The doculink_agent routes to inspection_agent when:
- User queries mention inspections, inspection reports, or inspector findings
- context_doc_uris contain documents with type "INSPECTION_REPORT"
- Queries ask about specific issues, costs, or recommendations

## Response Format

**On matches:**
Returns a comprehensive answer organized by:
- Issue category (structural, electrical, plumbing, etc.)
- Severity level (critical → major → moderate → minor)
- Location within property
- Cost estimates when available
- Urgency and recommended timeline

**Includes citations:**
```
[Comprehensive answer organized by category and severity]

Citations:
- Home Inspection Report - January 2025, Section: Electrical System, Page 12
- Pre-Purchase Inspection - December 2024, Section: Structural Assessment
```

**On no matches:**
"No relevant information could be found in the inspection reports for this property to answer this question."

## Example Queries

**"What are the critical issues?"**
Lists all critical-severity issues with location, description, cost estimate, and recommended actions.

**"Show me electrical problems"**
Filters to electrical system findings with severity levels and specific locations.

**"What will repairs cost?"**
Summarizes cost estimates by category or priority, noting ranges when available.

**"What needs immediate attention?"**
Lists urgent items with timeline reasoning from the inspection report.

**"Compare this inspection with my recent kitchen checkpoint"**
Cross-references inspection findings with checkpoint photos (requires coordination with checkpoint_agent).

## Data Flow

```
User Query → doculink_agent → inspection_agent
    ↓
ask_inspection_retrieval
    ↓
Fetch file IDs from GCS import-results (filter by property_id)
    ↓
Query Vertex AI RAG corpus
    ↓
Retrieve relevant text chunks
    ↓
Agent synthesizes answer with citations
    ↓
Return to user
```

## Document Type Filter

Inspection reports are stored in Firestore with `documentType: "INSPECTION_REPORT"`:

```
users/{userId}/properties/{propertyId}/documents/{docId}
  - documentType: "INSPECTION_REPORT"
  - name: "Home Inspection Report - Jan 2025"
  - gsURI: "gs://bucket/uploads/..."
  - summary: AI-extracted summary
  - keyEntities: [{name: "Inspector", value: "John Doe"}, ...]
  - inspectionMetadata: {
      inspectionDate: Timestamp,
      inspector: string,
      majorIssues: number,
      criticalIssues: number,
      estimatedRepairCost: number
    }
```

The agent filters RAG queries to only these document types when context_doc_uris are provided.

## Future Enhancements

- Automatic metadata extraction on document upload
- Cross-referencing with checkpoint photos for visual verification
- Cost estimate aggregation across multiple reports
- Timeline tracking of issue resolution
- Integration with DIY/service agents for actionable recommendations
