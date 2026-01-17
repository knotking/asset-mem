# Inspection Report Agent

This sub-agent analyzes property inspection reports and extracts structured information including issues, severity levels, cost estimates, and actionable recommendations.

## What it does

- Retrieves information from uploaded inspection reports using Vertex AI RAG
- Extracts and categorizes issues by severity (Critical, High, Medium, Low)
- Organizes findings by property area (Foundation, Roof, Electrical, Plumbing, HVAC, etc.)
- Generates executive summaries of inspection findings
- Provides repair priority recommendations
- Extracts inspector information and report metadata

## Where it lives

- Agent definition: `agent.py`
- System instructions: `prompts.py`
- Package initialization: `__init__.py`

## Configuration

Requires the following environment variables:

- `GCP_PROJECT_ID`: GCP project ID for Vertex AI
- `GCP_LOCATION`: GCP region (default: us-central1)
- `USER_UPLOAD_RAG_CORPUS`: Vertex RAG corpus resource name for user documents
- `GOOGLE_CLOUD_BUCKET`: GCS bucket containing user uploads
- `USER_UPLOAD_FOLDER`: Base folder for user uploads (default: uploads)

Authentication: Uses Application Default Credentials (ADC) for GCS and Vertex AI.

## How it works

1. **User uploads inspection report**: Report is uploaded via web/mobile app as a document
2. **Document classification**: System identifies document type as INSPECTION_REPORT
3. **RAG indexing**: Report is automatically uploaded to RAG corpus via Pub/Sub worker
4. **User queries in chat**: User asks questions about their inspection report
5. **Agent invocation**: Analysis agent detects inspection report in context and calls inspection_report_agent
6. **RAG retrieval**: Agent searches RAG corpus for relevant inspection report content
7. **Structured extraction**: Agent parses findings, categorizes by severity, and organizes by area
8. **Response generation**: Returns formatted response with findings, priorities, and recommendations

## Tool Functions

### `ask_inspection_reports_retrieval`

**Parameters:**

- `user_query` (str): Natural language query about inspection findings
- `context_doc_uris` (Optional[List[str]]): Specific inspection report GCS URIs to search
- `tool_context` (ToolContext): Agent tool context with user_id

**Returns:**

- Formatted text with inspection report findings and relevant context
- Or message indicating no reports found if RAG returns no results

**Example Usage:**

```python
# Query: "What critical issues were found in the inspection?"
result = ask_inspection_reports_retrieval(
    user_query="What critical issues were found in the inspection?",
    context_doc_uris=["gs://bucket/inspection_report_2024.pdf"],
    tool_context=tool_context
)

# Returns formatted text with inspection findings
```

## Integration

The inspection report agent is integrated into the `analysis_agent` as a tool. The analysis agent automatically uses inspection_report_agent when:

- User has uploaded inspection reports
- Inspection reports are selected as context documents in chat
- User queries reference inspection findings or property condition

## Severity Classification

The agent categorizes issues using the following severity levels:

### Critical
- Safety hazards requiring immediate attention
- Structural failures
- Code violations
- Examples: Active electrical hazards, major structural damage, gas leaks, severe water intrusion

### High
- Significant issues that could worsen rapidly
- Issues impacting property value or livability
- Examples: Roof leaks, foundation cracks, plumbing failures, HVAC failures

### Medium
- Issues requiring attention within months
- Components showing significant wear
- Examples: Minor water stains, worn components, aging systems

### Low
- Minor issues and routine maintenance items
- Cosmetic concerns
- Examples: Minor wear and tear, cosmetic damage, preventive maintenance

## Response Format

The agent structures responses with clear sections:

1. **Executive Summary**: 2-3 sentences summarizing overall condition and critical findings
2. **Critical Issues**: Detailed descriptions of issues requiring immediate attention (if any)
3. **Issues by Area**: Organized breakdown by property area/system
4. **Repair Priority List**: Numbered sequence of recommended repairs
5. **Next Steps**: Specific recommendations for follow-up actions

## Example Queries

- "What critical issues were found in my inspection report?"
- "Show me all the electrical problems"
- "What repairs should I prioritize?"
- "Are there any roof issues?"
- "What did the inspector say about the foundation?"
- "Give me an executive summary of the inspection"
- "What are the estimated costs for the major repairs?"

## Handling Multiple Reports

When multiple inspection reports are available:

- Compares findings between reports
- Identifies changes over time (issues worsened, improved, or resolved)
- Highlights new issues in later inspections
- Provides timeline perspective

## Error Handling

If no inspection reports are found:
```
"No relevant information found in your uploaded inspection reports. This could mean:
1. No inspection reports have been uploaded yet
2. The uploaded reports don't contain information about this topic
3. Please try rephrasing your question

To upload an inspection report, go to Property Documents and select 'Inspection Report' 
as the document type."
```

## Notes

- Inspection reports must be uploaded as documents with type INSPECTION_REPORT
- Reports are automatically indexed in RAG corpus (no manual processing needed)
- Agent only reports findings explicitly stated in inspection reports (no speculation)
- Supports PDF, image, and text-based inspection report formats
- Works with reports from any inspection service or inspector
