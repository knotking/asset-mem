# User Docs Agent Testing Guide

## Overview

This document provides testing instructions for the new "Docs" primary agent feature that allows users to directly query their uploaded documents through the AI chat interface.

## Feature Summary

The Docs agent enables users to:
- Explicitly select "Docs" mode via the primary agent selector
- Query specific documents (selected docs mode)
- Query all uploaded documents (all-docs mode)
- Get answers with proper citations from their document library

## Testing Prerequisites

1. **Backend Setup**:
   - Agent deployed to Vertex AI with updated code
   - Vertex AI RAG corpus configured (`USER_UPLOAD_RAG_CORPUS` env var)
   - GCS bucket with user documents and import results

2. **User Setup**:
   - Test user account with uploaded documents
   - Documents indexed in RAG corpus
   - Property with associated documents

## Test Cases

### Test 1: Selected Documents Mode

**Setup**:
1. Log in to web app or mobile app
2. Navigate to property chat
3. Select 2-3 specific documents from the documents panel
4. Open chat settings and select "Docs" as primary agent

**Test Steps**:
1. Ask a question related to the selected documents (e.g., "What warranty coverage do I have?")
2. Verify the agent searches only the selected documents
3. Check that the response includes citations from those documents
4. Verify no information from unselected documents appears

**Expected Results**:
- Response contains information from selected documents only
- Citations reference the selected documents
- Response format: "Answer text\n\nCitations:\n- Document Title, Section"

### Test 2: All Documents Mode

**Setup**:
1. Log in to web app or mobile app
2. Navigate to property chat
3. Clear all document selections (no documents selected)
4. Open chat settings and select "Docs" as primary agent

**Test Steps**:
1. Ask a general question that could be answered by any document (e.g., "Do I have any appliance manuals?")
2. Verify the agent searches all user documents
3. Check that the response includes information from multiple documents if relevant
4. Verify citations reference various documents

**Expected Results**:
- Response searches entire document library
- Citations may reference multiple documents
- Comprehensive answer from all available documents

### Test 3: No Documents Found

**Setup**:
1. Select "Docs" as primary agent
2. Ask a question unrelated to any uploaded documents

**Test Steps**:
1. Ask: "What is the capital of France?"
2. Verify appropriate "no information found" message

**Expected Results**:
- Response: "No relevant information could be found in your uploaded documents or provided context to answer this question."
- No fabricated information or hallucinations

### Test 4: Mode Switching

**Setup**:
1. Start with "Analysis" mode
2. Send a diagnostic query
3. Switch to "Docs" mode
4. Send a document query

**Test Steps**:
1. In Analysis mode, ask: "How do I fix a leaky faucet?"
2. Verify analysis response with DIY/service recommendations
3. Switch to Docs mode
4. Ask: "What does my plumbing warranty cover?"
5. Verify document retrieval response

**Expected Results**:
- Analysis mode provides diagnostic workflow
- Docs mode provides document-based answers
- Mode switching works seamlessly
- Context maintained appropriately

### Test 5: API Payload Verification

**Setup**:
1. Enable API logging
2. Select "Docs" as primary agent

**Test Steps**:
1. Send a query
2. Check API logs for the request payload

**Expected Results**:
- Payload includes: `"primary_agent": "docs"`
- Payload includes: `"context_doc_uris": [...]` (selected docs) or `[]` (all docs)
- Payload includes: `"user_query": "..."`
- Agent routes to `doculink_agent` → `user_docs_agent`

### Test 6: Cross-Property Isolation

**Setup**:
1. User has documents for Property A and Property B
2. Navigate to Property A chat
3. Select "Docs" mode

**Test Steps**:
1. Ask a question about Property A documents
2. Verify response only includes Property A documents
3. Switch to Property B
4. Ask same question
5. Verify response only includes Property B documents

**Expected Results**:
- Documents are properly scoped to the current property
- No cross-property information leakage
- Citations reference correct property documents

## UI Testing

### Web App

**Primary Agent Selector**:
- Open chat settings popover
- Verify three buttons: Analysis, Checkpoint, Docs
- Click "Docs" button
- Verify it highlights/activates
- Check compact settings bar shows "Docs" with FileText icon

**Document Selection**:
- With Docs mode active, select/deselect documents
- Verify document count updates
- Verify selected documents are passed in API request

### Mobile App

**Primary Agent Selector**:
- Open chat settings modal
- Verify three buttons: Analysis, Checkpoint, Docs
- Tap "Docs" button
- Verify it highlights/activates
- Check compact settings bar shows "Docs" with FileText icon

**Document Selection**:
- With Docs mode active, select/deselect documents
- Verify document selection UI works correctly
- Verify selected documents are passed in API request

## Backend Testing

### Agent Routing

**Test Root Agent**:
```python
# Test input with primary_agent="docs"
input_data = {
    "user_query": "What is in my manual?",
    "primary_agent": "docs",
    "context_doc_uris": ["gs://bucket/user123/manual.pdf"],
    "property_id": "prop123"
}
# Expected: Routes to doculink_agent
```

**Test DocuLink Agent**:
```python
# Verify doculink_agent detects docs mode
# Expected: Calls user_docs_agent tool
# Expected: Passes context_doc_uris to user_docs_agent
```

**Test User Docs Agent**:
```python
# Test selected docs mode
get_rag_file_ids("user123", ["gs://bucket/user123/manual.pdf"])
# Expected: Returns file IDs matching manual.pdf only

# Test all docs mode
get_rag_file_ids("user123", None)
# Expected: Returns all file IDs for user123
```

### RAG Retrieval

**Test RAG Query**:
1. Verify RAG corpus is queried with correct file IDs
2. Check similarity_top_k=10 and vector_distance_threshold=0.6
3. Verify retrieved contexts are returned
4. Check citation format in response

## Performance Testing

### Response Time

**Metrics to Monitor**:
- Selected docs mode: 2-5 seconds (typical)
- All docs mode: 3-7 seconds (depends on document count)
- No results: 1-2 seconds

**Load Testing**:
- 10 concurrent users querying documents
- Verify response times remain acceptable
- Check for any timeouts or errors

## Troubleshooting

### Common Issues

**Issue**: "No matching result found" for valid questions
- **Check**: Document indexing in RAG corpus
- **Check**: File IDs in import-results/*.json
- **Check**: context_doc_uris match Filename in import results

**Issue**: Wrong documents returned
- **Check**: Property ID scoping
- **Check**: User ID in session
- **Check**: File ID mapping in GCS

**Issue**: No citations in response
- **Check**: user_docs_agent prompt includes citation instructions
- **Check**: Retrieved contexts have metadata (title, section)

**Issue**: Primary agent not routing to docs
- **Check**: primary_agent field in API payload
- **Check**: Root agent routing logic
- **Check**: Agent deployment version

## Success Criteria

✅ All test cases pass
✅ UI shows "Docs" option in both web and mobile apps
✅ Selected docs mode searches only selected documents
✅ All docs mode searches entire user library
✅ Responses include proper citations
✅ No cross-property information leakage
✅ Performance meets targets
✅ No linter or type errors

## Deployment Checklist

Before deploying to production:

- [ ] All backend changes deployed to Vertex AI
- [ ] API schema updated and deployed
- [ ] Web app deployed with UI changes
- [ ] Mobile app built and deployed
- [ ] Type definitions updated in common package
- [ ] Documentation updated
- [ ] Test cases executed and passing
- [ ] Performance benchmarks met
- [ ] User acceptance testing completed

## Related Documentation

- [Analysis Agent Overview](analysis/ANALYSIS_AGENT_OVERVIEW.md)
- [Checkpoint AI Chat Analysis](checkpoint/CHECKPOINT_AI_CHAT_ANALYSIS.md)
- [User Docs Agent README](../gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/README.md)
- [Session Management](../apps/common/docs/SESSION_MANAGEMENT.md)

## Support

For issues or questions:
1. Check agent logs in Cloud Logging
2. Review API request/response payloads
3. Verify RAG corpus configuration
4. Check document indexing status
