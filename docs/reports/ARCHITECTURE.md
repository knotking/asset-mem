# Reports Feature Architecture

## System Overview

The Inspection Reports feature follows a microservices architecture with async processing, AI analysis, and real-time updates.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│              (Web App / Mobile App)                             │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │ Upload                             │ Chat Query
             ↓                                    ↓
┌─────────────────────────┐         ┌─────────────────────────┐
│   Firebase Storage      │         │     Proxy API           │
│   reports/{user}/{prop} │         │   /chat-with-report     │
└────────────┬────────────┘         └────────────┬────────────┘
             │                                    │
             │ gsURI                              │
             ↓                                    ↓
┌─────────────────────────┐         ┌─────────────────────────┐
│      Firestore          │         │    Report Agent         │
│  users/.../reports/     │◄────────│  (Gemini 2.0 Flash)     │
└────────────┬────────────┘         └─────────────────────────┘
             │
             │ Trigger Analysis
             ↓
┌─────────────────────────┐
│     Proxy API           │
│   /analyze-report       │
└────────────┬────────────┘
             │
             │ Publish
             ↓
┌─────────────────────────┐
│       Pub/Sub           │
│  report-analysis-topic  │
└────────────┬────────────┘
             │
             │ Trigger
             ↓
┌─────────────────────────┐
│   Cloud Function        │
│   Report Analyzer       │
└────────────┬────────────┘
             │
             │ Call Agent
             ↓
┌─────────────────────────┐
│    Report Agent         │
│  - Extraction           │
│  - Issues Analysis      │
│  - Recommendations      │
└────────────┬────────────┘
             │
             │ Generate Embedding
             ↓
┌─────────────────────────┐
│  text-embedding-004     │
│  (Vector Embedding)     │
└────────────┬────────────┘
             │
             │ Update Results
             ↓
┌─────────────────────────┐
│      Firestore          │
│    aiAnalysis{}         │
│    embedding[]          │
└─────────────────────────┘
```

## Component Details

### 1. Frontend Layer

#### Web Application
- **Framework**: Next.js 14 with App Router
- **State Management**: React Context API
- **Real-time Updates**: Firestore `onSnapshot` listeners
- **File Upload**: Firebase Storage SDK with `uploadBytesResumable`

**Key Components**:
- `ReportsContext`: State management and API calls
- `UploadReportsDialog`: File upload UI with drag-and-drop
- `PropertyReportsTab`: List view with cards
- `ReportDetailView`: Full analysis display with tabs

#### Mobile Application
- **Framework**: React Native with Expo
- **State Management**: React Context API (shared with web)
- **File Picker**: Expo Document Picker
- **Real-time Updates**: Firestore listeners

### 2. Storage Layer

#### Firebase Storage
```
Structure:
reports/
  {userId}/
    {propertyId}/
      report_1704067200000_inspection.pdf
      report_1704153600000_annual_check.pdf
```

- **Access**: Private, user-owned only
- **File Types**: PDF, JPEG, PNG
- **Size Limit**: 50MB per file
- **URL Generation**: Both download URL and gs:// URI

#### Firestore
```
Collection Path:
users/{userId}/properties/{propertyId}/reports/{reportId}

Document Structure:
{
  userId: string
  propertyId: string
  name: string
  url: string (https://)
  gsURI: string (gs://)
  contentType: string
  createdAt: Timestamp
  reportType: string
  status: string
  inspectorName?: string
  inspectorCompany?: string
  inspectionDate?: Timestamp
  aiAnalysis?: {
    summary: string
    overallCondition: string
    issues: ReportIssue[]
    recommendations: ReportRecommendation[]
    keyFindings: string[]
    costEstimates: {...}
    analyzedAt: Timestamp
    confidence: number
  }
  embedding?: number[768]
  embeddingModel?: string
  embeddingGeneratedAt?: Timestamp
}
```

**Indexes**:
1. `createdAt DESC` - Recent reports first
2. `status ASC, createdAt DESC` - Filter by status
3. `reportType ASC, createdAt DESC` - Filter by type
4. `createdAt DESC + embedding (vector)` - Semantic search

**Security Rules**:
```javascript
match /users/{userId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### 3. API Layer

#### Proxy API (FastAPI)
**Base Path**: `/{FIREBASE_WEBHOOK_SECRET}/`

**Endpoints**:

1. **POST /analyze-report**
   - **Purpose**: Queue report for async analysis
   - **Input**: `{ reportUri, contentType, reportId, userId, propertyId }`
   - **Output**: `202 Accepted` with message ID
   - **Action**: Publishes to Pub/Sub topic

2. **POST /chat-with-report**
   - **Purpose**: Ask questions about analyzed report
   - **Input**: `{ userQuery, reportId, userId, propertyId, reportContext? }`
   - **Output**: `{ answer, reportId }`
   - **Action**: Calls report agent chat function

3. **GET /report-summary/{report_id}**
   - **Purpose**: Get summary metrics
   - **Input**: Query params `userId`, `propertyId`
   - **Output**: Summary with counts and totals
   - **Action**: Fetches from Firestore

**Authentication**: Firebase webhook secret in URL path

### 4. Message Queue

#### Pub/Sub Topic: `report-analysis-topic`

**Message Schema**:
```json
{
  "reportUri": "gs://bucket/reports/user123/prop456/report.pdf",
  "contentType": "application/pdf",
  "reportId": "abc123",
  "userId": "user123",
  "propertyId": "prop456",
  "source": "report-analysis-api"
}
```

**Purpose**: Decouples API from long-running analysis operations

**Benefits**:
- Async processing (analysis can take 30-60 seconds)
- Automatic retries on failure
- Scalability (multiple workers can process queue)
- API responds immediately (202 Accepted)

### 5. Worker Layer

#### Cloud Function: `pubsub_report_analysis`

**Trigger**: Pub/Sub topic `report-analysis-topic`

**Workflow**:
1. Parse Pub/Sub message
2. Validate required fields
3. Update Firestore status to "analyzing"
4. Call report agent with gsURI
5. Generate embedding from analysis
6. Update Firestore with results (status: "complete")
7. Update property report count
8. Handle errors (status: "failed")

**Runtime**: Python 3.11
**Memory**: 2GB (for AI model inference)
**Timeout**: 540s (9 minutes)

**Dependencies**:
- `firebase-admin`: Firestore access
- `google-cloud-aiplatform`: Vertex AI
- `vertexai`: Gemini and embedding models

### 6. AI Layer

#### Report Agent

**Model**: Gemini 2.0 Flash (multimodal)

**Architecture**:
```
report_agent (Orchestrator)
├── extraction_agent
│   └── Tool: extract_report_metadata()
├── issues_analysis_agent
│   └── Tool: analyze_report_issues()
├── recommendations_agent
│   └── Tool: generate_recommendations()
└── report_chat_agent
    └── Tool: answer_report_question()
```

**Sub-Agents**:

1. **Extraction Agent**
   - Extracts metadata from report
   - Inspector info, dates, property details
   - Output: JSON with structured metadata

2. **Issues Analysis Agent**
   - Identifies all issues/defects
   - Categorizes by type and severity
   - Assigns priority and cost estimates
   - Output: Array of ReportIssue objects

3. **Recommendations Agent**
   - Generates actionable recommendations
   - Assigns timeframes and DIY feasibility
   - Provides cost estimates
   - Output: Array of ReportRecommendation objects

4. **Report Chat Agent**
   - Answers questions about analyzed reports
   - Uses stored analysis as context
   - References page numbers and sections
   - Output: Natural language answer

**Analysis Process**:
```python
# 1. Parse PDF using Gemini multimodal
file_part = Part.from_uri(report_uri, mime_type="application/pdf")
model = GenerativeModel("gemini-2.0-flash-exp")

# 2. Extract with structured prompt
prompt = """
Analyze this inspection report and extract:
1. Metadata (inspector, dates, property)
2. Issues with severity classification
3. Recommendations with timeframes
Return as JSON.
"""

response = model.generate_content([file_part, prompt])
result = json.loads(response.text)

# 3. Generate embedding for semantic search
embedding_model = TextEmbeddingModel.from_pretrained("text-embedding-004")
embedding = embedding_model.get_embeddings([combined_text])
```

**Response Schema Enforcement**:
```python
generation_config = {
    "temperature": 0.1,  # Low for factual extraction
    "max_output_tokens": 8192,
    "response_mime_type": "application/json",
    "response_schema": {
        "type": "object",
        "properties": {
            "metadata": {...},
            "issues": {"type": "array", "items": {...}},
            "recommendations": {"type": "array", "items": {...}}
        }
    }
}
```

#### Embedding Service

**Model**: text-embedding-004
**Dimensions**: 768
**Input**: Report summary + key findings + issue descriptions
**Output**: Vector for semantic search

**Purpose**: Enable future features like:
- "Find reports with similar issues"
- "Show all reports mentioning 'foundation cracks'"
- Cross-property issue analysis

## Data Flow

### Upload Flow
```
User selects file
  → Web/Mobile validates size/type
  → Upload to Firebase Storage
  → Create Firestore document (status: uploading)
  → Call API /analyze-report
  → API publishes to Pub/Sub
  → API returns 202 Accepted
  → Update Firestore (status: analyzing)
  → User sees "Analyzing..." in UI
```

### Analysis Flow
```
Pub/Sub triggers Cloud Function
  → Parse message
  → Call report agent with gsURI
  → Agent analyzes PDF with Gemini
  → Extract metadata
  → Identify issues with severity
  → Generate recommendations
  → Return structured JSON
  → Generate embedding
  → Update Firestore (status: complete, aiAnalysis: {...})
  → Frontend real-time listener updates UI
  → User sees full analysis
```

### Chat Flow
```
User types question
  → Frontend calls /chat-with-report
  → API retrieves report analysis from Firestore
  → Calls report_chat_agent with context
  → Gemini generates answer
  → API returns answer
  → Frontend displays in chat interface
```

## Scalability

### Current Design
- **Concurrent Uploads**: Limited by Firebase Storage quotas
- **Analysis Queue**: Pub/Sub handles message buffering
- **Workers**: Single Cloud Function (can scale to multiple instances)
- **Storage**: Firestore scales automatically

### Future Optimizations
1. **Batch Processing**: Analyze multiple reports in parallel
2. **Caching**: Cache common questions per report
3. **CDN**: Use Firebase CDN for report file delivery
4. **Sharding**: Shard by user or property for extreme scale

## Error Handling

### Upload Errors
- File too large → Client-side validation
- Invalid type → Client-side validation
- Storage failure → Retry with exponential backoff

### Analysis Errors
- PDF parse failure → Log error, set status to "failed"
- Timeout → Cloud Function retries (Pub/Sub redelivery)
- AI model error → Log error, set status to "failed"

### Chat Errors
- Report not found → 404 response
- Analysis not complete → User-friendly message
- AI error → Fallback response

## Monitoring & Observability

### Logs
- Cloud Function logs in Cloud Logging
- API request logs
- Firestore operation logs

### Metrics (Future)
- Average analysis time
- Success/failure rates
- Popular question types
- Cost per analysis

### Alerts (Future)
- High failure rate
- Long analysis times
- Storage quota warnings

## Security Considerations

1. **Authentication**: Firebase Auth required
2. **Authorization**: User can only access own reports
3. **Storage Rules**: Private files, user-specific paths
4. **API Security**: Webhook secret in URL
5. **Data Privacy**: No cross-user access
6. **File Validation**: Size and type checks
7. **Cost Control**: Rate limiting on API (future)

## Cost Considerations

### Per-Report Costs (Estimated)
- **Storage**: $0.026/GB/month
- **Gemini 2.0 Flash**: ~$0.05 per report (based on token usage)
- **Embedding**: ~$0.0001 per report
- **Firestore**: Minimal (reads/writes)
- **Cloud Function**: Minimal (invocation cost)

**Total**: ~$0.05-0.10 per report analyzed

### Optimization Strategies
1. Cache analysis results (avoid re-analysis)
2. Use Gemini Flash instead of Pro (10x cheaper)
3. Batch embedding generation
4. Set document TTL for old reports

