# Inspection Report API Documentation

## Overview

This document describes the API endpoints, data structures, and workflows for the Inspection Report feature in the HomeApp checkpoint system.

## Table of Contents

1. [Data Models](#data-models)
2. [API Endpoints](#api-endpoints)
3. [Analysis Pipeline](#analysis-pipeline)
4. [Integration Points](#integration-points)
5. [Error Handling](#error-handling)
6. [Examples](#examples)

---

## Data Models

### Checkpoint (Extended)

```typescript
type Checkpoint = {
  id: string;
  userId: string;
  propertyId: string;
  name: string;
  description?: string;
  createdAt: Timestamp;
  capturedAt?: Timestamp;
  
  // NEW: Source type discriminator
  sourceType?: "media" | "inspection_report";
  
  // Existing media field (empty array for reports)
  media: CheckpointMedia[];
  
  // NEW: Inspection report metadata
  inspectionReport?: {
    documentType: "home_inspection" | "vehicle_inspection" | "appliance_maintenance" | "contractor_assessment" | "other";
    inspectorName?: string;
    inspectionDate?: Timestamp;
    reportUrl: string;
    reportGsURI: string;
    fileName: string;
    fileSize?: number;
    contentType: string;
  };
  
  assetType?: "real_estate" | "vehicle" | "appliance" | "other";
  location?: string;
  tags?: string[];
  analysisStatus?: "pending" | "processing" | "completed" | "failed";
  aiAnalysis?: CheckpointAnalysis;
  
  // Vector embedding for semantic search
  embedding?: number[];
  embeddingModel?: string;
  embeddingGeneratedAt?: Timestamp;
};
```

### CheckpointAnalysis (Extended)

```typescript
type CheckpointAnalysis = {
  summary: string;
  detectedItems: string[];
  conditions: string[];
  issues?: Array<
    | string
    | {
        description?: string;
        severity?: "minor" | "moderate" | "major" | "critical";
        confidence?: number;
        category?: string;
      }
  >;
  issues_by_severity?: {
    critical?: number;
    major?: number;
    moderate?: number;
    minor?: number;
  };
  
  // NEW: Report-specific findings
  reportFindings?: {
    majorIssues: Array<{
      description: string;
      severity: string;
      estimatedCost?: number;
    }>;
    minorIssues: Array<{
      description: string;
      severity: string;
    }>;
    recommendations: string[];
    overallCondition?: string;
    inspectorNotes?: string;
  };
  
  condition_scores?: {
    overall?: number;
    structural?: number;
    mechanical?: number;
    cosmetic?: number;
  };
  damage_scores?: {
    structural?: number;
    surface?: number;
    functional?: number;
  };
  cost_estimates?: {
    repairs_immediate?: number;
    maintenance_annual?: number;
  };
  
  aiConfidence?: number;
  analyzedAt: Timestamp;
};
```

---

## API Endpoints

### 1. Analyze Checkpoint (Existing - Extended)

**Endpoint:** `POST /api/checkpoint/analyze`

**Description:** Triggers AI analysis for both media and inspection report checkpoints. The backend automatically routes to the appropriate analyzer based on content type.

**Request Body:**

```json
{
  "imageUrl": "gs://bucket/path/to/document.pdf",
  "contentType": "application/pdf",
  "assetType": "real_estate",
  "location": "Whole Property",
  "checkpointId": "abc123",
  "userId": "user123",
  "propertyId": "prop456"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| imageUrl | string | Yes | GCS URI (gs://) of media or document |
| contentType | string | Yes | MIME type (image/*, video/*, application/pdf, etc.) |
| assetType | string | No | Asset type hint for analysis |
| location | string | No | Location description |
| checkpointId | string | Yes | Checkpoint document ID |
| userId | string | Yes | User ID |
| propertyId | string | Yes | Property ID |

**Response:**

```json
{
  "status": "accepted",
  "message": "Checkpoint analysis queued for processing",
  "checkpointId": "abc123"
}
```

**Status Codes:**
- `200`: Analysis queued successfully
- `400`: Invalid request parameters
- `401`: Unauthorized
- `500`: Server error

---

## Analysis Pipeline

### Flow Diagram

```
Document Upload
    ↓
Firebase Storage
    ↓
Checkpoint Created (sourceType: "inspection_report")
    ↓
Pub/Sub Message Published
    ↓
Worker Receives Message
    ↓
Check sourceType
    ↓
Route to analyze_inspection_report()
    ↓
Report Parser (Gemini AI)
    ↓
Extract Structured Data
    ↓
Transform to Checkpoint Format
    ↓
Update Firestore
    ↓
Generate Embedding (Vector Search)
    ↓
Trigger Metrics Aggregation
    ↓
Analysis Complete
```

### Worker Processing

**File:** `gcp/proxy/workers/function/checkpoint_analysis/main.py`

**Logic:**

```python
# Get checkpoint document
checkpoint_doc = checkpoint_ref.get()
source_type = checkpoint_doc.get("sourceType", "media")

# Route based on source type
if source_type == "inspection_report":
    analysis_result = analyze_inspection_report(
        document_uri=image_url,
        content_type=content_type,
        asset_type=asset_type,
        location=location
    )
else:
    analysis_result = analyze_checkpoint_image(
        media_url=image_url,
        content_type=content_type,
        location=location
    )
```

### Report Parser

**File:** `gcp/proxy/workers/function/checkpoint_analysis/report_parser.py`

**Function:** `parse_inspection_report()`

**AI Model:** Gemini 2.0 Flash with document understanding

**Extraction Process:**

1. **Document Upload**: Upload to Gemini via GCS URI
2. **Prompt Engineering**: Asset-specific analysis prompt
3. **JSON Response**: Structured output with all fields
4. **Transformation**: Convert to checkpoint format
5. **Validation**: Ensure data integrity

**Extracted Fields:**

```json
{
  "inspectorName": "John Smith, ABC Inspections",
  "inspectionDate": "2025-01-15",
  "overallCondition": "Fair",
  "summary": "Property shows moderate wear...",
  "detectedItems": ["roof", "foundation", "plumbing"],
  "conditions": ["Fair", "Minor wear"],
  "issues": [
    {
      "description": "Roof shingles showing wear",
      "severity": "moderate",
      "category": "structural",
      "estimatedCost": 5000,
      "confidence": 0.9
    }
  ],
  "recommendations": [
    "Replace roof within 2-3 years",
    "Monitor foundation cracks"
  ],
  "inspectorNotes": "Overall property in acceptable condition"
}
```

---

## Integration Points

### 1. Checkpoint Context (Frontend)

**File:** `apps/common/src/contexts/checkpoint-context.tsx`

**Usage:**

```typescript
// Create inspection report checkpoint
const result = await createCheckpoint(
  {
    name: "Annual Home Inspection",
    assetType: "real_estate",
    location: "Whole Property",
    sourceType: "inspection_report",
    inspectionReport: {
      documentType: "home_inspection",
      inspectorName: "John Smith",
      reportUrl: downloadURL,
      reportGsURI: gsURI,
      fileName: "inspection.pdf",
      fileSize: 2048576,
      contentType: "application/pdf"
    }
  },
  [] // Empty media array for reports
);
```

### 2. Checkpoint AI Chat

**Integration:** Automatic - no changes needed

**How it Works:**
- Report findings stored in `aiAnalysis.issues`
- Vector embeddings generated from summary + issues
- Semantic search works identically for reports and media
- Chat agent retrieves report checkpoints naturally

**Example Queries:**

```typescript
// User asks: "What critical issues were found?"
// Agent calls: ask_checkpoints_retrieval(
//   user_query="critical issues",
//   property_id="prop123"
// )
// Returns: Checkpoints with critical issues (from reports or photos)
```

### 3. Property Insights

**Metrics Aggregation:** Automatic

**Contribution:**
- Issues from reports counted in severity totals
- Condition scores factor into overall property score
- Deterioration rate calculated across all checkpoints
- Timeline includes both media and report checkpoints

---

## Error Handling

### Upload Errors

**Scenario:** Document upload to Storage fails

**Handling:**
```typescript
try {
  await uploadBytesResumable(storageRef, file);
} catch (error) {
  // Show user-friendly error
  toast({
    title: 'Upload Failed',
    description: 'Failed to upload document. Please try again.',
    variant: 'destructive'
  });
  // Log for debugging
  console.error('Storage upload error:', error);
}
```

### Analysis Errors

**Scenario:** AI analysis fails

**Handling:**
```python
try:
    analysis_result = parse_inspection_report(...)
except Exception as e:
    logger.error(f"Report parsing failed: {e}")
    # Update checkpoint status
    checkpoint_ref.update({
        "analysisStatus": "failed",
        "aiAnalysis": {
            "summary": "Analysis failed - please try re-uploading",
            "analyzedAt": firestore.SERVER_TIMESTAMP
        }
    })
```

**User Experience:**
- Checkpoint shows "Analysis Failed" badge
- User can retry by re-uploading
- Original document always preserved
- Manual viewing still available

### Validation Errors

**Client-Side Validation:**

```typescript
// Check file type
const validTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

if (!validTypes.includes(file.type)) {
  toast({
    title: 'Invalid File Type',
    description: 'Please upload a PDF, image, or Word document.',
    variant: 'destructive'
  });
  return;
}

// Check file size (50 MB limit)
if (file.size > 50 * 1024 * 1024) {
  toast({
    title: 'File Too Large',
    description: 'Please upload a file smaller than 50 MB.',
    variant: 'destructive'
  });
  return;
}
```

---

## Examples

### Example 1: Upload Home Inspection Report (Mobile)

```typescript
// 1. User selects document
const document = await DocumentPicker.getDocumentAsync({
  type: ['application/pdf', 'image/*'],
  copyToCacheDirectory: true
});

// 2. Upload to Storage
const storage = getStorage();
const storageRef = ref(storage, `checkpoints/${userId}/${propertyId}/${Date.now()}_${document.name}`);
const response = await fetch(document.uri);
const blob = await response.blob();
await uploadBytesResumable(storageRef, blob);

// 3. Get URLs
const downloadURL = await getDownloadURL(storageRef);
const gsURI = `gs://${storageRef.bucket}/${storageRef.fullPath}`;

// 4. Create checkpoint
const checkpointData = {
  userId,
  propertyId,
  name: "Annual Home Inspection 2025",
  assetType: "real_estate",
  location: "Whole Property",
  sourceType: "inspection_report",
  media: [],
  inspectionReport: {
    documentType: "home_inspection",
    inspectorName: "ABC Inspections",
    reportUrl: downloadURL,
    reportGsURI: gsURI,
    fileName: document.name,
    fileSize: document.size,
    contentType: document.mimeType
  },
  createdAt: Timestamp.now(),
  analysisStatus: "pending"
};

const result = await createCheckpoint(checkpointData, []);

// 5. Trigger analysis
await analyzeCheckpoint({
  imageUrl: gsURI,
  contentType: document.mimeType,
  assetType: "real_estate",
  location: "Whole Property",
  checkpointId: result.id,
  userId,
  propertyId
});
```

### Example 2: Query Report Findings (Chat)

```typescript
// User asks via chat
const userMessage = "What critical issues were found in my home inspection?";

// Backend processes
const response = await sendMessage({
  message: userMessage,
  sessionId,
  propertyId,
  primaryAgent: "checkpoint"
});

// Agent retrieves relevant checkpoints
// Returns structured response with findings from inspection reports
```

### Example 3: Display Report in Timeline (Web)

```typescript
// Checkpoint list component
{checkpoints.map(checkpoint => (
  <CheckpointCard
    key={checkpoint.id}
    checkpoint={checkpoint}
    onClick={() => setSelectedCheckpoint(checkpoint)}
  >
    {checkpoint.sourceType === 'inspection_report' ? (
      <div className="flex items-center gap-2">
        <FileText className="h-8 w-8 text-primary" />
        <span className="text-xs font-medium">Report</span>
      </div>
    ) : (
      <img src={checkpoint.media[0]?.thumbnailUrl} alt={checkpoint.name} />
    )}
  </CheckpointCard>
))}
```

---

## Performance Considerations

### Document Processing Time

| Document Type | Size | Typical Analysis Time |
|---------------|------|----------------------|
| PDF (1-5 pages) | < 1 MB | 30-60 seconds |
| PDF (5-20 pages) | 1-5 MB | 60-120 seconds |
| PDF (20+ pages) | 5-20 MB | 120-180 seconds |
| Image (scanned) | < 5 MB | 30-45 seconds |
| Word document | < 2 MB | 45-90 seconds |

### Optimization Tips

1. **Compress PDFs**: Use PDF compression before upload
2. **Optimize Images**: Reduce resolution for scanned reports
3. **Split Large Reports**: Break into logical sections
4. **Cache Results**: Analysis results cached in Firestore
5. **Async Processing**: All analysis happens asynchronously

---

## Security & Privacy

### Access Control

- Reports accessible only by property owner
- Firebase Security Rules enforce user-level isolation
- Storage bucket configured with proper IAM policies
- Time-limited signed URLs for sharing

### Data Encryption

- At rest: Firebase Storage encryption
- In transit: HTTPS/TLS 1.3
- Analysis: Processed in secure GCP environment
- No data retention by AI provider

### Compliance

- GDPR compliant (data deletion on request)
- CCPA compliant (data access and portability)
- SOC 2 Type II certified infrastructure
- Regular security audits

---

## Monitoring & Logging

### Key Metrics

- Upload success rate
- Analysis completion rate
- Average processing time
- Error rates by type
- User adoption rate

### Logging

```python
# Worker logs
logger.info(f"Processing inspection report: {checkpoint_id}")
logger.info(f"Extracted {len(issues)} issues from report")
logger.error(f"Report parsing failed: {error}")

# Trace spans
with tracer.start_as_current_span("parse_inspection_report"):
    result = parse_inspection_report(...)
```

### Alerts

- Analysis failure rate > 5%
- Processing time > 5 minutes
- Storage quota exceeded
- API error rate spike

---

## Future Enhancements

### Planned Features

1. **Multi-page Analysis**: Better handling of lengthy reports
2. **Comparative Analysis**: Side-by-side report comparison
3. **OCR Improvements**: Enhanced handwritten text recognition
4. **Cost Tracking**: Aggregate repair costs over time
5. **Contractor Integration**: Direct sharing with service providers
6. **Report Templates**: Pre-fill based on report type
7. **Batch Upload**: Multiple reports at once
8. **Export**: Generate combined reports

### API Extensions

```typescript
// Planned endpoints
POST /api/checkpoint/compare-reports
POST /api/checkpoint/extract-costs
POST /api/checkpoint/generate-summary-report
GET /api/checkpoint/report-history
```

---

## Support & Resources

### Documentation
- User Guide: `/docs/checkpoint/INSPECTION_REPORT_USER_GUIDE.md`
- Implementation: `/docs/checkpoint/INSPECTION_REPORT_IMPLEMENTATION.md`
- Web App: `/docs/checkpoint/INSPECTION_REPORT_WEBAPP_IMPLEMENTATION.md`

### Code References
- Report Parser: `gcp/proxy/workers/function/checkpoint_analysis/report_parser.py`
- Analysis Service: `gcp/proxy/workers/function/checkpoint_analysis/checkpoint_service.py`
- Worker Main: `gcp/proxy/workers/function/checkpoint_analysis/main.py`
- Mobile UI: `apps/mapp/components/property-details/CreateInspectionReportModal.tsx`
- Web UI: `apps/webapp/src/components/checkpoints/create-checkpoint-dialog.tsx`

### Contact
- Technical Issues: engineering@homeapp.com
- API Questions: api-support@homeapp.com
- Feature Requests: product@homeapp.com

