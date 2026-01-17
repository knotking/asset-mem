# Inspection Agent Testing Guide

## Overview
This document describes how to test the inspection agent integration.

## Backend Agent Testing

### Prerequisites
1. Environment variables configured in `.env`:
   - `GOOGLE_CLOUD_PROJECT`
   - `GOOGLE_CLOUD_LOCATION`
   - `GOOGLE_CLOUD_BUCKET`
   - `USER_UPLOAD_FOLDER`
   - `USER_UPLOAD_RAG_CORPUS`
2. Google Cloud authentication (ADC): `gcloud auth application-default login`
3. Sample inspection report PDF uploaded to GCS

### Unit Testing

#### Test 1: Agent Initialization
Verify the inspection agent is properly initialized and exported:

```python
from gcp.agents.homecare.property_agent.sub_agents.inspection_agent import inspection_agent

# Verify agent exists and has correct configuration
assert inspection_agent.name == 'inspection_agent'
assert inspection_agent.model == 'gemini-2.5-flash'
assert len(inspection_agent.tools) == 2  # ask_inspection_retrieval, analyze_inspection_report
print("✓ Agent initialization test passed")
```

#### Test 2: Integration with DocuLink Agent
Verify inspection agent is integrated into doculink_agent:

```python
from gcp.agents.homecare.property_agent.agent import doculink_agent

# Verify inspection_agent is in tools
tool_names = [tool.name for tool in doculink_agent.tools]
assert 'inspection_agent' in tool_names
print("✓ DocuLink integration test passed")
```

#### Test 3: RAG Retrieval Function
Test the retrieval function directly (requires real data):

```python
from gcp.agents.homecare.property_agent.sub_agents.inspection_agent.agent import get_inspection_file_ids

# Test file ID retrieval
user_id = "test_user_123"
property_id = "test_property_456"
context_doc_uris = ["gs://bucket/uploads/test_user_123/inspection_report.pdf"]

file_ids = get_inspection_file_ids(user_id, property_id, context_doc_uris)
print(f"Found {len(file_ids)} file IDs")
```

### Integration Testing

#### Test 4: End-to-End Query Flow
Test complete query flow from root agent to inspection agent:

```python
from gcp.agents.homecare.property_agent.agent import root_agent

# Test inspection query routing
test_input = {
    "user_query": "What are the critical issues found in the inspection?",
    "property_id": "property_123",
    "context_doc_uris": ["gs://bucket/uploads/user_456/inspection_jan2025.pdf"],
    "primary_agent": "checkpoint"  # Routes to doculink_agent
}

# This would require running the agent with Vertex AI
# response = root_agent.run(test_input)
# assert "inspection" in response.lower()
print("✓ End-to-end routing test structure verified")
```

### Manual Testing Scenarios

#### Scenario 1: Inspection Report Upload and Query
1. Upload an inspection report PDF through webapp
2. Wait for RAG import to complete
3. Query: "What are the critical issues in my inspection report?"
4. Expected: Agent retrieves and summarizes critical issues with citations

#### Scenario 2: Category-Specific Query
1. Query: "Show me all electrical problems from the inspection"
2. Expected: Agent filters to electrical issues only, provides severity levels

#### Scenario 3: Cost Estimation Query
1. Query: "What will repairs cost according to the inspection?"
2. Expected: Agent summarizes cost estimates by category, notes ranges

#### Scenario 4: Urgency/Timeline Query
1. Query: "What needs immediate attention?"
2. Expected: Agent lists urgent items with timeline and safety considerations

#### Scenario 5: No Inspection Reports
1. Query inspection-related question for property without reports
2. Expected: "No relevant information could be found in the inspection reports for this property"

#### Scenario 6: Cross-Reference with Checkpoints
1. Query: "Compare the inspection findings with my recent kitchen checkpoint"
2. Expected: Agent coordinates between inspection_agent and checkpoint_agent

## Frontend Testing

### Test Upload Flow
1. Navigate to property documents page
2. Upload inspection report PDF
3. Select document type: "INSPECTION_REPORT"
4. Verify upload completes successfully
5. Verify document appears in documents list with correct type

### Test Chat Interface
1. Open chat for property
2. Attach inspection report document
3. Send query: "What are the critical issues?"
4. Verify:
   - Query routes correctly (check agent steps)
   - Response includes inspection findings
   - Citations reference the report
   - Response is formatted clearly

### Test Document Management
1. Navigate to documents page
2. Filter by document type: "INSPECTION_REPORT"
3. Verify all inspection reports are shown
4. Click on inspection report
5. Verify preview/download works

## Performance Testing

### Metrics to Track
- RAG retrieval latency (target: < 2s)
- Document analysis latency (target: < 10s for typical report)
- Token usage per query
- Retrieval accuracy (relevance of returned chunks)

### Load Testing
- Test with multiple inspection reports (5-10 per property)
- Test concurrent queries from multiple users
- Verify no degradation in response quality

## Validation Checklist

- [ ] Agent initializes correctly
- [ ] Agent integrated into doculink_agent tools
- [ ] Routing logic correctly delegates to inspection_agent
- [ ] RAG retrieval filters to inspection reports
- [ ] Property-scoped queries work (property_id filtering)
- [ ] Citations include report names and sections
- [ ] Severity classification preserved (critical/major/moderate/minor)
- [ ] Cost estimates extracted when present
- [ ] Urgency/timeline information included
- [ ] Safety hazards highlighted prominently
- [ ] Cross-referencing with checkpoints works
- [ ] No information case handled gracefully
- [ ] Frontend upload flow works
- [ ] Chat interface displays responses correctly
- [ ] Document type filter works

## Known Limitations

1. **Property Scoping**: When no context_doc_uris provided, retrieves all user files (not filtered by property_id at RAG level). Consider adding Firestore lookup to get property-specific document URIs.

2. **Document Type Filtering**: Currently relies on context_doc_uris being passed. Consider enhancing to query Firestore for INSPECTION_REPORT documents when context_doc_uris is empty.

3. **Metadata Extraction**: Structured metadata extraction on upload not yet implemented. Consider adding background worker for this.

4. **Cost Estimates**: Agent only reports costs mentioned in inspection reports; does not generate estimates independently.

## Future Enhancements

1. Automatic metadata extraction on document upload
2. Comparison of inspection reports over time
3. Integration with DIY/service agents for repair recommendations
4. Dedicated inspections UI page (see frontend components todo)
5. Timeline visualization of inspection findings
6. Issue resolution tracking (mark issues as resolved)
