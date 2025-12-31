# Report Agent Documentation

## Overview

The Report Agent is a specialized AI agent designed to analyze property inspection reports and provide conversational access to the analysis. It uses Gemini 2.0 Flash for multimodal PDF analysis and is structured with four specialized sub-agents.

## Location

```
gcp/agents/homecare/report_agent/
├── __init__.py
├── agent.py          # Main orchestrator and sub-agents
├── prompts.py        # System instructions
├── schemas.py        # Pydantic models
├── tools.py          # Analysis tools
└── README.md         # Detailed documentation
```

## Architecture

```
report_agent (Root Orchestrator)
├── extraction_agent         # Extract metadata
├── issues_analysis_agent    # Identify issues
├── recommendations_agent    # Generate recommendations
└── report_chat_agent       # Answer questions
```

## Sub-Agents

### 1. Extraction Agent

**Purpose**: Extract structured metadata from inspection reports

**Model**: Gemini 2.0 Flash

**Tool**: `extract_report_metadata(report_uri, content_type)`

**Extracts**:
- **Inspector Information**
  - Name
  - Company/Organization
  - License number (if present)
  - Inspection date

- **Property Information**
  - Property address
  - Property type (single-family, condo, etc.)
  - Year built
  - Square footage

- **Report Metadata**
  - Report type (HOME_INSPECTION, PRE_PURCHASE, etc.)
  - Report reference number
  - Executive summary

**Output Schema**:
```python
class ReportMetadata(BaseModel):
    inspector_name: Optional[str] = None
    inspector_company: Optional[str] = None
    inspector_license: Optional[str] = None
    inspection_date: Optional[str] = None
    property_address: Optional[str] = None
    property_type: Optional[str] = None
    year_built: Optional[str] = None
    square_footage: Optional[str] = None
    report_type: str = "OTHER"
    report_reference: Optional[str] = None
    executive_summary: Optional[str] = None
```

**Prompt Strategy**:
- Exact text extraction (no paraphrasing)
- Note page numbers where information found
- Flag missing critical information
- Preserve date/number formatting

### 2. Issues Analysis Agent

**Purpose**: Identify and categorize all issues from inspection reports

**Model**: Gemini 2.0 Flash

**Tool**: `analyze_report_issues(report_uri, content_type)`

**Analysis Process**:
1. Scan entire report for issues/defects
2. Categorize by system (Structural, Electrical, Plumbing, HVAC, etc.)
3. Assign severity level
4. Calculate priority ranking
5. Extract cost estimates (if mentioned)
6. Note location and page numbers

**Severity Classification**:
- **Critical**: Immediate safety hazard or major system failure
  - Examples: Gas leak, structural collapse risk, active electrical fire hazard
  - Action: Address within 24-48 hours

- **Major**: Significant defect requiring prompt attention
  - Examples: Non-functioning HVAC, major water leak, code violations
  - Action: Address within weeks

- **Moderate**: Issue that should be addressed soon
  - Examples: Aging components, minor leaks, functional issues
  - Action: Address within 1-3 months

- **Minor**: Maintenance item or cosmetic issue
  - Examples: Minor wear, cosmetic damage, routine maintenance
  - Action: Monitor or address when convenient

**Output Schema**:
```python
class ReportIssue(BaseModel):
    id: str
    category: str  # Structural, Electrical, Plumbing, HVAC, Roofing, etc.
    title: str
    description: str
    severity: str  # critical, major, moderate, minor
    location: str
    priority: int  # 1-10, with 10 being most urgent
    estimated_cost: Optional[float] = None
    page_number: Optional[int] = None
    confidence: float = 0.8
```

**Example Issues**:
```json
[
  {
    "id": "issue_001",
    "category": "Electrical",
    "title": "Outdated electrical panel",
    "description": "60-amp service with signs of overheating on main breaker. Panel dated 1975, below modern code requirements.",
    "severity": "critical",
    "location": "Basement electrical room",
    "priority": 10,
    "estimated_cost": 3000,
    "page_number": 12,
    "confidence": 0.95
  },
  {
    "id": "issue_002",
    "category": "Roofing",
    "title": "Aging asphalt shingles",
    "description": "Roof shingles showing moderate granule loss and curling. Estimated 5-7 years remaining life.",
    "severity": "moderate",
    "location": "Main roof surface",
    "priority": 5,
    "estimated_cost": 8500,
    "page_number": 8,
    "confidence": 0.85
  }
]
```

### 3. Recommendations Agent

**Purpose**: Generate actionable recommendations for addressing issues

**Model**: Gemini 2.0 Flash

**Tool**: `generate_recommendations(report_uri, content_type)`

**Recommendation Process**:
1. Review all identified issues
2. Determine appropriate action for each
3. Assign timeframe based on severity
4. Estimate costs (if not already provided)
5. Assess DIY feasibility
6. Prioritize by urgency and cost-benefit

**Timeframe Definitions**:
- **Immediate**: Within 24-48 hours (safety critical)
- **Short-term**: Within 1-3 months
- **Long-term**: Within 1-2 years
- **Monitoring**: Inspect regularly, no immediate action needed

**DIY Feasibility Assessment**:
- `true`: Homeowner can handle with basic tools/skills
  - Examples: Replace air filter, caulk minor gaps, paint touch-ups
- `false`: Requires licensed professional
  - Examples: Electrical work, structural repairs, HVAC installation

**Output Schema**:
```python
class ReportRecommendation(BaseModel):
    id: str
    issue: str  # Reference to issue or description
    recommendation: str  # Clear, actionable step
    timeframe: str  # immediate, short_term, long_term, monitoring
    estimated_cost: Optional[float] = None
    diy_feasible: bool
```

**Example Recommendations**:
```json
[
  {
    "id": "rec_001",
    "issue": "Outdated electrical panel",
    "recommendation": "Hire licensed electrician to upgrade to 200-amp service panel meeting current NEC code. Obtain building permit before work begins.",
    "timeframe": "immediate",
    "estimated_cost": 3000,
    "diy_feasible": false
  },
  {
    "id": "rec_002",
    "issue": "Aging asphalt shingles",
    "recommendation": "Budget for roof replacement in next 5 years. Get quotes from 3 licensed roofers. Consider impact-resistant shingles for insurance discount.",
    "timeframe": "long_term",
    "estimated_cost": 8500,
    "diy_feasible": false
  },
  {
    "id": "rec_003",
    "issue": "Clogged gutters",
    "recommendation": "Clean all gutters and downspouts. Install gutter guards to reduce maintenance. Inspect twice yearly (spring and fall).",
    "timeframe": "short_term",
    "estimated_cost": 200,
    "diy_feasible": true
  }
]
```

### 4. Report Chat Agent

**Purpose**: Answer questions about previously analyzed reports

**Model**: Gemini 2.0 Flash

**Tool**: `answer_report_question(user_query, report_id, user_id, property_id, report_context)`

**Capabilities**:
- Reference specific issues by severity or category
- Provide cost breakdowns
- Explain technical terms
- Cite page numbers and sections
- Compare costs across timeframes
- Assess DIY feasibility for specific items

**Common Question Types**:

1. **Critical Issues**
   - Q: "What are the critical issues in this report?"
   - A: Lists all critical severity items with locations and costs

2. **Cost Questions**
   - Q: "How much will repairs cost?"
   - A: Breaks down by timeframe (immediate, short-term, long-term)

3. **Priority Questions**
   - Q: "What should I fix first?"
   - A: Orders by severity and timeframe with reasoning

4. **DIY Questions**
   - Q: "Can I do any of these repairs myself?"
   - A: Lists DIY-feasible items with guidance

5. **Specific System Questions**
   - Q: "What did the inspector say about the electrical system?"
   - A: Summarizes all electrical-related findings

6. **Location Questions**
   - Q: "What issues were found in the basement?"
   - A: Lists all issues for that location

**Context Handling**:
```python
# Chat agent receives full report analysis as context
context = {
    "summary": "Overall property condition...",
    "overallCondition": "fair",
    "issues": [...],  # All issues with details
    "recommendations": [...],  # All recommendations
    "keyFindings": [...],
    "costEstimates": {...}
}

# Agent generates response using this context
response = model.generate_content(
    f"Context: {json.dumps(context)}\n\nQuestion: {user_query}"
)
```

## Main Analysis Tool

### analyze_report_pdf()

**Location**: `tools.py`

**Parameters**:
- `report_uri`: GCS URI (gs://bucket/path)
- `content_type`: MIME type (application/pdf or image/*)
- `analysis_type`: "metadata", "issues", "recommendations", or "full"

**Process**:
```python
def analyze_report_pdf(report_uri, content_type, analysis_type):
    # 1. Initialize Vertex AI
    vertexai.init(project=PROJECT_ID, location=LOCATION)
    
    # 2. Create file part from GCS
    file_part = Part.from_uri(report_uri, mime_type=content_type)
    
    # 3. Select prompt based on analysis type
    prompt = get_prompt_for_analysis_type(analysis_type)
    
    # 4. Call Gemini with multimodal input
    model = GenerativeModel("gemini-2.0-flash-exp")
    response = model.generate_content(
        [file_part, prompt],
        generation_config={
            "temperature": 0.1,  # Low for factual extraction
            "max_output_tokens": 8192
        }
    )
    
    # 5. Parse JSON response
    result = json.loads(response.text)
    
    return result
```

**Supported Formats**:
- **PDF**: Multi-page inspection reports
- **Images**: JPEG, PNG, GIF, WebP
- **Combined**: PDF with embedded images

**Analysis Types**:

1. **metadata**: Quick metadata extraction only
2. **issues**: Comprehensive issue identification
3. **recommendations**: Generate recommendations
4. **full**: Complete analysis (all of the above)

## Prompts

### Extraction Prompt
```
Analyze this inspection report and extract the following metadata:

1. Inspector Information:
   - Name, Company, License number, Inspection date

2. Property Information:
   - Address, Property type, Year built, Square footage

3. Report Metadata:
   - Report type, Report reference number, Executive summary

Return as JSON with exact text from report. Use null for missing fields.
```

### Issues Analysis Prompt
```
Analyze this inspection report and identify ALL issues, defects, and concerns.

For each issue:
- id: Unique identifier (issue_001, issue_002, etc.)
- category: System category (Structural, Electrical, etc.)
- title: Brief description (max 100 chars)
- description: Detailed description
- severity: critical | major | moderate | minor
  * critical: Immediate safety hazard
  * major: Significant defect requiring prompt attention
  * moderate: Should be addressed soon
  * minor: Maintenance item or cosmetic
- location: Location within property
- priority: 1-10 (10 = most urgent)
- estimated_cost: Cost in dollars (if mentioned)
- page_number: Page where issue mentioned
- confidence: 0.0-1.0 confidence in assessment

Return as JSON array. Include only issues actually in report.
```

### Recommendations Prompt
```
Based on issues in this report, provide actionable recommendations.

For each recommendation:
- id: Unique identifier (rec_001, rec_002, etc.)
- issue: Description of issue being addressed
- recommendation: Clear, actionable recommendation
- timeframe: immediate | short_term | long_term | monitoring
  * immediate: Within 24-48 hours (safety)
  * short_term: Within 1-3 months
  * long_term: Within 1-2 years
  * monitoring: Regular inspection
- estimated_cost: Cost in dollars
- diy_feasible: true if homeowner can do, false if professional needed

Return as JSON array, ordered by priority (most urgent first).
```

### Chat Prompt
```
You are answering a question about an inspection report.

Report Analysis Data:
{context}

User Question: {query}

Provide a clear answer including:
- Specific details from the report
- Page numbers if available
- Cost estimates if applicable
- Severity levels if discussing issues
- Recommendations if appropriate

If question cannot be answered from report data, say so clearly.
```

## Error Handling

### PDF Parse Errors
```python
try:
    result = analyze_report_pdf(...)
except Exception as e:
    logger.error(f"Failed to parse PDF: {e}")
    return {"error": "Failed to parse report", "details": str(e)}
```

### JSON Parse Errors
```python
try:
    result = json.loads(response.text)
except json.JSONDecodeError as e:
    # Gemini sometimes wraps JSON in markdown
    if "```json" in response.text:
        text = response.text.split("```json")[1].split("```")[0]
        result = json.loads(text)
    else:
        raise
```

### Missing Data
- Use `Optional[...]` types in schemas
- Return null/None for missing fields
- Log warnings for critical missing data
- Continue with partial results

## Performance

### Timing
- **Metadata extraction**: 5-10 seconds
- **Issues analysis**: 15-30 seconds
- **Full analysis**: 30-60 seconds

### Optimization
- Use "full" analysis type (single API call) instead of separate calls
- Cache results in Firestore (don't re-analyze)
- Process large reports in chunks if needed
- Use Flash model instead of Pro (10x faster, cheaper)

### Token Usage
- Average report: ~10,000 input tokens
- Full analysis output: ~2,000 tokens
- Cost per report: ~$0.05

## Testing

### Unit Tests
```python
def test_extract_metadata():
    result = extract_report_metadata(
        report_uri="gs://test-bucket/sample_report.pdf",
        content_type="application/pdf"
    )
    assert result["inspector_name"] is not None
    assert result["report_type"] in VALID_REPORT_TYPES
```

### Integration Tests
```python
def test_full_analysis_flow():
    # Upload test report
    report_uri = upload_test_report()
    
    # Analyze
    result = analyze_report_pdf(report_uri, "application/pdf", "full")
    
    # Validate structure
    assert "metadata" in result
    assert "issues" in result
    assert len(result["issues"]) > 0
    assert all("severity" in issue for issue in result["issues"])
```

### Sample Reports
Create test reports with known content:
- `test_critical_issues.pdf` - Contains safety hazards
- `test_clean_report.pdf` - Minimal issues
- `test_complex_report.pdf` - Many issues across categories

## Monitoring

### Metrics to Track
- Analysis success rate
- Average analysis time
- Token usage per report
- Cost per analysis
- Common failure reasons

### Logging
```python
logger.info(f"Starting analysis: {report_uri}")
logger.info(f"Analysis completed in {duration}ms")
logger.warning(f"Missing metadata: {missing_fields}")
logger.error(f"Analysis failed: {error}")
```

### Alerts
- High failure rate (> 5%)
- Long analysis times (> 120s)
- High token usage (> 20k tokens)

## Future Enhancements

1. **Multi-Report Comparison**
   - Compare current vs. previous inspection
   - Track issue resolution over time
   - Identify deterioration trends

2. **Image Extraction**
   - Extract photos from PDF
   - Annotate issues on images
   - Generate visual summaries

3. **Cost Database Integration**
   - Use historical data for better estimates
   - Regional cost adjustments
   - Material price updates

4. **Specialized Agents**
   - Roofing specialist agent
   - Foundation specialist agent
   - System-specific deep dives

5. **Automated Scheduling**
   - Generate repair timelines
   - Send reminder notifications
   - Track completion status

