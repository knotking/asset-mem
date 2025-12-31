# Report Agent

## Overview

The Report Agent is a specialized AI agent designed to analyze property inspection reports and answer questions about them. It uses Gemini 2.0 Flash multimodal capabilities to extract structured information from PDF inspection reports and provides conversational access to the analysis.

## Architecture

```
report_agent (Root Orchestrator)
├── extraction_agent        # Extract metadata and inspector info
├── issues_analysis_agent   # Identify and categorize issues
├── recommendations_agent   # Generate actionable recommendations
└── report_chat_agent       # Answer questions about reports
```

## Features

### Report Analysis

When analyzing an inspection report, the agent:

1. **Extracts Metadata** (extraction_agent):
   - Inspector information (name, company, license, date)
   - Property details (address, type, year built, square footage)
   - Report metadata (type, reference number, executive summary)

2. **Identifies Issues** (issues_analysis_agent):
   - Categorizes issues by type (Structural, Electrical, Plumbing, etc.)
   - Assigns severity levels (critical, major, moderate, minor)
   - Provides priority rankings (1-10)
   - Estimates repair costs (if mentioned in report)
   - Notes page numbers for reference

3. **Generates Recommendations** (recommendations_agent):
   - Actionable steps for each issue
   - Timeframes (immediate, short_term, long_term, monitoring)
   - Cost estimates
   - DIY feasibility assessment

### Report Chat

The report_chat_agent provides conversational access to analyzed reports:

- Answers specific questions about issues
- Summarizes findings by severity or category
- Provides cost breakdowns
- Explains technical terms
- References specific page numbers and sections

## Usage

### Analyzing a Report

```python
from report_agent import report_agent

# Analyze a new report
result = report_agent.run({
    "report_uri": "gs://bucket/reports/inspection_2025.pdf",
    "user_id": "user123",
    "property_id": "prop456",
    "content_type": "application/pdf"
})
```

### Chatting with a Report

```python
# Ask questions about an analyzed report
response = report_agent.run({
    "user_query": "What are the critical issues in this report?",
    "report_id": "report789",
    "user_id": "user123",
    "property_id": "prop456"
})
```

## Sub-Agents

### Extraction Agent

Specializes in extracting structured metadata from reports using multimodal PDF analysis.

**Tools:**
- `extract_report_metadata`: Parses PDF to extract inspector info, property details, and report metadata

### Issues Analysis Agent

Identifies all issues, defects, and concerns mentioned in the report.

**Tools:**
- `analyze_report_issues`: Comprehensive issue identification with severity classification

**Severity Levels:**
- **Critical**: Immediate safety hazard or major system failure
- **Major**: Significant defect requiring prompt attention
- **Moderate**: Issue that should be addressed soon
- **Minor**: Maintenance item or cosmetic issue

### Recommendations Agent

Generates actionable recommendations for addressing identified issues.

**Tools:**
- `generate_recommendations`: Creates prioritized, actionable recommendations

**Timeframes:**
- **Immediate**: Within 24-48 hours (safety critical)
- **Short-term**: Within 1-3 months
- **Long-term**: Within 1-2 years
- **Monitoring**: Regular inspection, no immediate action

### Report Chat Agent

Provides conversational interface for querying report analysis.

**Tools:**
- `answer_report_question`: Answers questions using stored analysis data
- `retrieve_report_context`: Fetches analysis from Firestore

## Output Schema

The complete analysis follows this structure:

```json
{
  "metadata": {
    "inspector_name": "John Smith",
    "inspector_company": "ABC Inspections",
    "inspection_date": "2025-01-15",
    "property_address": "123 Main St",
    "report_type": "PRE_PURCHASE"
  },
  "summary": "Overall summary of property condition...",
  "overall_condition": "fair",
  "issues": [
    {
      "id": "issue_001",
      "category": "Electrical",
      "title": "Outdated electrical panel",
      "description": "60-amp service with signs of overheating",
      "severity": "critical",
      "location": "Basement",
      "priority": 10,
      "estimated_cost": 3000,
      "page_number": 12,
      "confidence": 0.95
    }
  ],
  "recommendations": [
    {
      "id": "rec_001",
      "issue": "Outdated electrical panel",
      "recommendation": "Hire licensed electrician to upgrade to 200-amp service",
      "timeframe": "immediate",
      "estimated_cost": 3000,
      "diy_feasible": false
    }
  ],
  "key_findings": [
    "Electrical system requires immediate attention",
    "Roof has 5-7 years remaining life",
    "Foundation in good condition"
  ],
  "cost_estimates": {
    "immediate": 5000,
    "short_term": 8000,
    "long_term": 15000
  },
  "confidence": 0.88
}
```

## Integration

The report agent is integrated into the property management system:

1. **Upload Flow**: Reports uploaded to Firebase Storage
2. **Analysis Trigger**: Cloud Function worker calls report agent
3. **Storage**: Results stored in Firestore under `users/{uid}/properties/{propertyId}/reports/{reportId}`
4. **Chat Interface**: Frontend uses report_chat_agent for Q&A

## Dependencies

- Google ADK (Agent Development Kit)
- Vertex AI (Gemini 2.0 Flash)
- Google Cloud Storage
- Firestore
- text-embedding-004 (for semantic search)

## Error Handling

The agent gracefully handles:
- Missing or incomplete report data
- Malformed PDFs
- Analysis failures (returns partial results)
- Missing Firestore documents (clear error messages)

## Best Practices

1. **Always analyze before chat**: Reports must be analyzed before questions can be answered
2. **Provide full context**: Pass complete report_context when available to avoid redundant Firestore queries
3. **Monitor costs**: Multimodal PDF analysis with Gemini can be expensive for large reports
4. **Validate outputs**: Check confidence scores and verify critical findings
5. **Handle timeouts**: Large reports may take 30+ seconds to analyze

## Future Enhancements

- [ ] Compare multiple reports for the same property
- [ ] Track issue resolution status
- [ ] Generate repair prioritization matrix
- [ ] Integration with service provider recommendations
- [ ] Cost estimation improvements using market data
- [ ] Support for video walkthrough analysis

