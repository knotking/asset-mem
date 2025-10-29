# Document Analysis API

This document describes the backend implementation of the document analysis endpoint using Vertex AI Gemini in the GCP proxy API.

> **⚠️ SDK Update (2025):** This implementation uses the new **Google Gen AI SDK** (`google-genai` package) instead of the deprecated `vertexai.generative_models` module. The old Vertex AI SDK will be removed on June 24, 2026. [Migration guide](https://cloud.google.com/vertex-ai/generative-ai/docs/deprecations/genai-vertexai-sdk)

## Overview

The document analysis endpoint uses **Vertex AI Gemini 2.0 Flash** to automatically extract structured information from property documents:

- **Document Type Classification**: Categorizes documents (DEED, INSURANCE_POLICY, UTILITY_BILL, etc.)
- **Property Address Extraction**: Identifies and normalizes property addresses
- **Key Entity Extraction**: Identifies 2-3 important pieces of information
- **Document Summarization**: Generates concise one-sentence summaries

## Architecture

```
┌─────────────────┐
│  mapp/webapp    │
│  (Frontend)     │
└────────┬────────┘
         │ POST /extract-doc-info
         │ { docUrl, contentType }
         ↓
┌─────────────────────────────────┐
│  GCP Proxy API (FastAPI)        │
│  └─ extract_document_info()     │
└────────┬────────────────────────┘
         │
         ↓
┌─────────────────────────────────┐
│  document_analysis.py            │
│  └─ extract_doc_info()          │
└────────┬────────────────────────┘
         │ 1. Create Part from URL (no download!)
         │ 2. Send to Gemini with schema
         │ 3. Parse JSON response
         ↓
┌─────────────────────────────────┐
│  Vertex AI Gemini 2.0 Flash     │
│  └─ Directly reads URL          │
│  └─ Returns structured JSON     │
└─────────────────────────────────┘
```

## Files

### 1. `models.py`
Defines Pydantic models for request/response validation:

```python
class DocumentType(str, Enum):
    DEED = "DEED"
    INSURANCE_POLICY = "INSURANCE_POLICY"
    UTILITY_BILL = "UTILITY_BILL"
    INSPECTION_REPORT = "INSPECTION_REPORT"
    MORTGAGE_STATEMENT = "MORTGAGE_STATEMENT"
    OTHER = "OTHER"

class KeyEntity(BaseModel):
    name: str
    value: str

class ExtractDocInfoRequest(BaseModel):
    docUrl: str
    contentType: str

class ExtractDocInfoResponse(BaseModel):
    documentType: DocumentType
    propertyAddress: str
    keyEntities: List[KeyEntity]
    summary: str
```

### 2. `document_analysis.py`
Core analysis logic using Google Gen AI SDK:

**Key Function:**
- `extract_doc_info()`: Main analysis function using Gemini

**Features:**
- **Direct URL processing** - No file download required! Uses `types.Part.from_uri()`
- Uses Gemini 2.0 Flash model for fast, cost-effective analysis
- Structured JSON output via `response_schema`
- Graceful error handling with fallback responses
- Low temperature (0.1) for consistent extraction
- Supports both `gs://` URIs and public `https://` URLs

### 3. `main.py`
FastAPI endpoint definition:

```python
@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/extract-doc-info")
async def extract_document_info(request: Request):
    """Extract structured information from property documents"""
    data = await request.json()
    doc_request = ExtractDocInfoRequest(**data)
    result = extract_doc_info(doc_request)
    return result.model_dump()
```

## API Endpoint

### URL
```
POST /{FIREBASE_WEBHOOK_SECRET}/extract-doc-info
```

### Request Body
```json
{
  "docUrl": "https://storage.googleapis.com/bucket/document.pdf",
  "contentType": "application/pdf"
}
```

**Parameters:**
- `docUrl` (string, required): Public URL of the document to analyze
- `contentType` (string, required): MIME type of the document (e.g., "application/pdf", "image/jpeg")

### Response Body
```json
{
  "documentType": "DEED",
  "propertyAddress": "123 Main Street, Anytown, CA 12345",
  "keyEntities": [
    {
      "name": "Deed Type",
      "value": "Warranty Deed"
    },
    {
      "name": "Recording Date",
      "value": "January 15, 2024"
    }
  ],
  "summary": "Warranty deed for residential property at 123 Main Street."
}
```

**Fields:**
- `documentType`: Enum value (DEED, INSURANCE_POLICY, UTILITY_BILL, INSPECTION_REPORT, MORTGAGE_STATEMENT, OTHER)
- `propertyAddress`: Normalized address string or "N/A" if not found
- `keyEntities`: Array of 0-3 key information pieces with name/value pairs
- `summary`: One-sentence description of the document

### Error Response
```json
{
  "status": "error",
  "message": "Error description"
}
```

## Configuration

### Environment Variables

Required environment variables (already configured in your GCP deployment):

```bash
GCP_PROJECT_ID=your-project-id          # Google Cloud project ID
GCP_LOCATION=us-central1                # Vertex AI location (default)
FIREBASE_WEBHOOK_SECRET=your-secret     # Webhook authentication secret
```

### Google Gen AI SDK Setup

The API automatically initializes the Google Gen AI SDK with Vertex AI on startup:

```python
from google import genai

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION
)
```

**Requirements:**
- Service account with Vertex AI User role
- Vertex AI API enabled in GCP project
- Access to Gemini 2.0 Flash model
- `google-genai` package (replaces deprecated `vertexai.generative_models`)

## Usage Examples

### From mapp (React Native)

```typescript
import { extractDocInfo } from '@/lib/api';

const result = await extractDocInfo({
  docUrl: 'https://storage.googleapis.com/.../document.pdf',
  contentType: 'application/pdf'
});

console.log(result.documentType);      // "DEED"
console.log(result.propertyAddress);   // "123 Main Street..."
console.log(result.summary);           // "Warranty deed for..."
```

### cURL Example

```bash
curl -X POST "https://your-api-url/{SECRET}/extract-doc-info" \
  -H "Content-Type: application/json" \
  -d '{
    "docUrl": "https://storage.googleapis.com/bucket/document.pdf",
    "contentType": "application/pdf"
  }'
```

## Supported Document Types

### Input Formats
- PDF (`.pdf`)
- Images (`.jpg`, `.jpeg`, `.png`)
- Microsoft Word (`.doc`, `.docx`)
- Excel (`.xls`, `.xlsx`)

### Output Classifications

| Document Type | Description | Example Documents |
|--------------|-------------|-------------------|
| `DEED` | Property deeds and titles | Warranty deed, quit claim deed, title transfer |
| `INSURANCE_POLICY` | Insurance documents | Homeowners insurance, title insurance |
| `UTILITY_BILL` | Utility statements | Electric, water, gas, internet bills |
| `INSPECTION_REPORT` | Property inspections | Home inspection, pest inspection, appraisal |
| `MORTGAGE_STATEMENT` | Loan documents | Mortgage statement, loan agreement, amortization |
| `OTHER` | Unclassified documents | General property documents, miscellaneous |

## Address Normalization

The AI normalizes addresses to a standard format:

**Transformations:**
- `St` → `Street`
- `Ave` → `Avenue`
- `Rd` → `Road`
- `Blvd` → `Boulevard`
- `Dr` → `Drive`
- `Ln` → `Lane`
- `Ct` → `Court`

**Example:**
```
Input:  "123 Main St, Apt 4B, Anytown CA"
Output: "123 Main Street, Apt 4B, Anytown, CA"
```

## Key Entity Examples

### Insurance Policy
```json
{
  "keyEntities": [
    { "name": "Policy Number", "value": "POL123456789" },
    { "name": "Insurance Provider", "value": "Allstate" },
    { "name": "Coverage Amount", "value": "$500,000" }
  ]
}
```

### Deed
```json
{
  "keyEntities": [
    { "name": "Property Address", "value": "123 Main Street" },
    { "name": "Deed Type", "value": "Warranty Deed" },
    { "name": "Recording Date", "value": "January 15, 2024" }
  ]
}
```

### Utility Bill
```json
{
  "keyEntities": [
    { "name": "Service Provider", "value": "Pacific Gas & Electric" },
    { "name": "Account Number", "value": "987654321" },
    { "name": "Billing Period", "value": "Dec 1-31, 2024" }
  ]
}
```

## Error Handling

### Graceful Degradation

If analysis fails, the function returns a fallback response:

```python
return ExtractDocInfoResponse(
    documentType=DocumentType.OTHER,
    propertyAddress="N/A",
    keyEntities=[],
    summary=f"Analysis failed: {str(e)}"
)
```

This ensures the client always receives a valid response, even on errors.

### Common Errors

**1. Document Download Failed**
```
Error: Failed to download document from URL
Cause: Invalid URL, network error, or file not accessible
Solution: Ensure document URL is public and accessible
```

**2. Vertex AI Not Initialized**
```
Error: Failed to initialize Vertex AI
Cause: Missing GCP_PROJECT_ID or incorrect credentials
Solution: Check environment variables and service account permissions
```

**3. Model Generation Error**
```
Error: Gemini API returned an error
Cause: Invalid document format or API quota exceeded
Solution: Check document format and API quotas
```

## Performance

### Typical Response Times
- **Small documents** (< 1 MB): 1-3 seconds
- **Medium documents** (1-5 MB): 3-6 seconds
- **Large documents** (5-10 MB): 6-12 seconds

### Optimization
- **No file download** - Gemini reads directly from URL (faster!)
- Uses Gemini 2.0 Flash (fastest model)
- Low temperature (0.1) for quick, deterministic results
- Structured JSON output reduces parsing time
- Reduced memory usage (no local file buffering)

### Cost
- Gemini 2.0 Flash: ~$0.001 per document analysis (varies by size)
- Most cost-effective model for document extraction

## Testing

### Manual Testing

**1. Test with sample deed:**
```bash
curl -X POST "https://your-api/{SECRET}/extract-doc-info" \
  -H "Content-Type: application/json" \
  -d '{
    "docUrl": "https://storage.googleapis.com/test/sample-deed.pdf",
    "contentType": "application/pdf"
  }'
```

**Expected:** `documentType: "DEED"`, address extracted, deed-related entities

**2. Test with insurance policy:**
```bash
# Same format with insurance document
```

**Expected:** `documentType: "INSURANCE_POLICY"`, policy number extracted

**3. Test error handling:**
```bash
# Use invalid URL
"docUrl": "https://invalid-url.com/fake.pdf"
```

**Expected:** Error response or fallback with `summary: "Analysis failed: ..."`

### Integration Testing

From mapp, test the full flow:
1. Upload document to Firebase Storage
2. Call extract-doc-info with download URL
3. Verify response fields
4. Check property address auto-population

## Monitoring

### Logging

The API logs key events:
- Document analysis requests
- Download progress
- Gemini API calls
- Analysis results
- Errors and exceptions

**Example logs:**
```
INFO: Document analysis endpoint received a request.
INFO: Analyzing document: https://storage.googleapis.com/.../doc.pdf
INFO: Downloaded document: 524288 bytes
INFO: Sending document to Gemini for analysis...
INFO: Analysis complete: DEED - Warranty deed for residential property...
```

### Metrics to Monitor
- Request count
- Success/error rate
- Average response time
- Document download time
- Gemini API latency
- Cost per request

## Security

### Authentication
- Endpoint protected by `FIREBASE_WEBHOOK_SECRET`
- Only authorized clients can access

### Data Privacy
- Documents downloaded temporarily (not stored)
- Analysis results returned directly to client
- No persistent storage of document content

### Best Practices
- Keep `FIREBASE_WEBHOOK_SECRET` confidential
- Use HTTPS for all API calls
- Validate document URLs are from trusted sources
- Limit document size (< 10 MB recommended)

## Deployment

### Cloud Run Deployment

The API is deployed as part of the GCP proxy service:

```bash
# Build and deploy
cd gcp/proxy/api
gcloud run deploy homecare-agent-proxy \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Environment Setup

Ensure these are set in Cloud Run:
```
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
FIREBASE_WEBHOOK_SECRET=your-secret
```

## Troubleshooting

### Issue: "Failed to initialize Vertex AI"
**Solution:** Check service account has Vertex AI User role

### Issue: "Document download timeout"
**Solution:** Increase timeout or check document accessibility

### Issue: "Invalid JSON response from Gemini"
**Solution:** Check document format is supported and not corrupted

### Issue: "Address not extracted"
**Solution:** Document may not contain clear address - returns "N/A" as expected

## Future Enhancements

1. **Batch Processing**: Analyze multiple documents in single request
2. **Async Processing**: Queue long-running analyses
3. **Caching**: Cache results for duplicate documents
4. **Enhanced Extraction**: Extract more entity types
5. **Confidence Scores**: Return confidence for classifications
6. **Multi-language**: Support non-English documents

## Related Documentation

- [Vertex AI Gemini Documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [mapp Document Analysis](../../apps/mapp/docs/DOCUMENT_ANALYSIS.md)
- [common extract-doc-info](../../apps/common/src/ai/flows/extract-doc-info.ts)

## Support

For issues or questions:
1. Check logs in Cloud Run console
2. Verify environment variables are set correctly
3. Test with sample documents
4. Review Vertex AI quotas and permissions
