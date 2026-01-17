# Inspection Report Agent - Testing Guide

## Overview

This document provides testing procedures for the Inspection Report Analysis Agent.

## Test Environment Setup

### Prerequisites

1. GCP credentials configured (Application Default Credentials)
2. Access to Vertex AI RAG corpus
3. Sample inspection reports uploaded to test user account
4. Environment variables configured:
   - `GCP_PROJECT_ID`
   - `GCP_LOCATION`
   - `USER_UPLOAD_RAG_CORPUS`
   - `GOOGLE_CLOUD_BUCKET`
   - `USER_UPLOAD_FOLDER`

## Test Cases

### 1. Unit Tests - Inspection Report Agent Tool

**Test: RAG Retrieval Tool**
```python
# Test ask_inspection_reports_retrieval with valid query
def test_inspection_report_retrieval():
    """Test that inspection report retrieval returns relevant findings."""
    user_query = "What critical issues were found in the inspection?"
    context_doc_uris = ["gs://bucket/sample_inspection_report.pdf"]
    
    # Mock tool_context with user_id
    # Call ask_inspection_reports_retrieval
    # Assert: Returns formatted text with findings
    # Assert: No errors thrown
```

**Test: No Reports Found**
```python
def test_no_inspection_reports():
    """Test graceful handling when no reports are found."""
    user_query = "Show me inspection findings"
    context_doc_uris = []
    
    # Call with empty context
    # Assert: Returns helpful message about uploading reports
```

### 2. Integration Tests - Analysis Agent Orchestration

**Test: Inspection Agent Called When Reports in Context**
```python
def test_analysis_agent_calls_inspection_agent():
    """Test that analysis_agent invokes inspection_report_agent when reports present."""
    
    # Setup: Upload sample inspection report to RAG
    # Create DiagnosisInput with:
    #   - user_query: "What issues were found?"
    #   - context_doc_uris: [inspection_report_uri]
    
    # Call analysis_agent
    # Assert: inspection_report_agent was invoked
    # Assert: Response includes inspectionReportResult section
```

**Test: Inspection Agent Skipped When No Reports**
```python
def test_analysis_agent_skips_inspection_when_no_reports():
    """Test that inspection_report_agent is not called without reports."""
    
    # Create DiagnosisInput with:
    #   - user_query: "My faucet is leaking"
    #   - context_doc_uris: [] (empty)
    
    # Call analysis_agent
    # Assert: inspection_report_agent was NOT invoked
    # Assert: Response follows normal analysis flow
```

### 3. End-to-End Tests

**Test: Web App - Upload and Query Inspection Report**
```
1. Login to web app
2. Navigate to property details
3. Upload inspection report (PDF or image)
   - Select "Inspection Report" as document type
   - Verify upload completes successfully
4. Wait for RAG indexing (check document status = "complete")
5. Navigate to property chat
6. Select uploaded inspection report as context
7. Send query: "What are the critical issues in my inspection report?"
8. Verify:
   - Analysis agent responds
   - Response includes inspectionReportResult section
   - Issues are categorized by severity
   - Executive summary is present
```

**Test: Mobile App - Upload and Query Inspection Report**
```
1. Login to mobile app
2. Navigate to property details
3. Upload inspection report from device
   - System auto-classifies as INSPECTION_REPORT
   - Verify upload progress
4. Wait for analysis completion
5. Navigate to property chat
6. Select inspection report as context document
7. Send query: "Show me roof issues from my inspection"
8. Verify:
   - Response includes inspection findings
   - Roof-specific issues are highlighted
   - Severity levels are displayed
```

**Test: Multiple Inspection Reports**
```
1. Upload two inspection reports (different dates)
2. Select both reports as context in chat
3. Query: "Compare the two inspection reports"
4. Verify:
   - Agent retrieves findings from both reports
   - Comparison highlights changes over time
   - New issues are identified
   - Resolved issues are noted
```

### 4. Query Variety Tests

Test the agent with various query types:

**Severity Queries:**
- "What critical issues were found?"
- "Show me all high severity problems"
- "List minor issues from the inspection"

**Area-Specific Queries:**
- "What did the inspector say about the roof?"
- "Show me electrical issues"
- "Are there any foundation problems?"

**Summary Queries:**
- "Give me an executive summary of the inspection"
- "What's the overall condition of the property?"
- "What repairs should I prioritize?"

**Cost and Recommendation Queries:**
- "How much will it cost to fix the critical issues?"
- "What contractors do I need for these repairs?"
- "Can I DIY any of these repairs?"

### 5. Error Handling Tests

**Test: Invalid Document Type**
```
- Upload non-inspection document with INSPECTION_REPORT type
- Query for inspection findings
- Verify: Graceful message about no relevant information
```

**Test: Corrupted File**
```
- Upload corrupted inspection report
- Verify: RAG import fails gracefully
- Verify: User sees appropriate error message
```

**Test: Large Report (Edge Case)**
```
- Upload very large inspection report (>100 pages)
- Verify: RAG import succeeds
- Verify: Query performance is acceptable
- Verify: Results are accurate despite large file size
```

## Manual Testing Checklist

- [ ] Agent successfully retrieves inspection report content from RAG
- [ ] Issues are correctly categorized by severity
- [ ] Executive summary is accurate and concise
- [ ] Area-based organization works correctly
- [ ] Multiple reports can be queried simultaneously
- [ ] Cost estimation integrates with inspection findings
- [ ] Service recommendations align with inspection issues
- [ ] Coverage agent checks warranty for inspection issues
- [ ] DIY suggestions appropriate for severity levels
- [ ] Markdown and JSON responses are both well-formatted
- [ ] No sensitive user data is leaked in responses
- [ ] Performance is acceptable (< 10 seconds for typical query)

## Sample Inspection Report for Testing

Create a sample inspection report with the following structure:

```
PROPERTY INSPECTION REPORT

Inspector: John Smith, Certified Inspector #12345
Inspection Date: January 15, 2024
Property: 123 Main Street, Anytown, USA

EXECUTIVE SUMMARY:
The property is generally in good condition with some areas requiring attention.
Critical issues were found in the electrical system and minor issues in plumbing.

FINDINGS BY AREA:

ROOF:
- Condition: Good
- Age: Approximately 8 years
- Material: Asphalt shingles
- Minor wear observed, but no immediate repairs needed

ELECTRICAL SYSTEM:
- CRITICAL: GFCI outlets in kitchen not functioning properly - Safety hazard
- High: Aluminum wiring in bedrooms - Should be evaluated by electrician
- Panel appears dated but functional

PLUMBING:
- Medium: Slow drain in master bathroom
- Low: Minor water stains under kitchen sink - monitor for leaks

FOUNDATION:
- Condition: Excellent
- No cracks or settling observed

HVAC:
- Age: 12 years (approaching end of typical lifespan)
- Medium: Consider replacement within 2-3 years

RECOMMENDATIONS:
1. Immediately repair/replace GFCI outlets (CRITICAL)
2. Have electrician evaluate aluminum wiring within 30 days (HIGH)
3. Schedule plumbing inspection for drains (MEDIUM)
4. Budget for HVAC replacement in next 2-3 years (MEDIUM)
```

## Success Criteria

The implementation is successful if:

1. ✅ Inspection report agent is successfully created and integrated
2. ✅ RAG retrieval works for uploaded inspection reports
3. ✅ Analysis agent correctly invokes inspection agent when reports present
4. ✅ Issues are extracted and categorized by severity
5. ✅ Executive summary is generated
6. ✅ Response format matches specification (Markdown + JSON)
7. ✅ Integration with existing agents (cost, service, DIY) works
8. ✅ No regression in existing analysis agent functionality
9. ✅ Frontend (web/mobile) can utilize inspection findings without changes
10. ✅ Performance meets requirements (< 10 seconds per query)

## Known Limitations

1. Agent relies on text extraction from inspection reports - heavily formatted PDFs may not parse perfectly
2. Image-only inspection reports require OCR capability (provided by RAG parser)
3. Custom inspection report formats may require additional prompt tuning
4. Very long reports (>200 pages) may hit RAG context limits

## Next Steps After Testing

1. Deploy to staging environment
2. Conduct user acceptance testing with real inspection reports
3. Collect feedback on accuracy and usefulness
4. Fine-tune prompts based on real-world usage
5. Monitor performance metrics and error rates
6. Deploy to production
