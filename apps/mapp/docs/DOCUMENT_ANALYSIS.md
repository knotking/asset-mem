# Document Analysis System

This document describes the AI-powered document analysis system in mapp that automatically extracts property addresses and categorizes uploaded documents.

## Overview

When users upload documents to create a new property, the system automatically:

1. **Extracts Property Address**: Uses AI to identify and normalize property addresses from documents
2. **Categorizes Documents**: Automatically classifies documents into types (DEED, INSURANCE_POLICY, UTILITY_BILL, etc.)
3. **Extracts Key Information**: Identifies important entities like policy numbers, dates, amounts
4. **Generates Summaries**: Creates concise one-sentence summaries of each document

### Entry flow (aligned with webapp)

- Home shows `HomeOnboardingChecklist` until the user has a property with at least one document.
- **Add New Property** opens `AddPropertyModal` on the home screen (no navigation until upload succeeds; legacy `id=new-property` URLs redirect home and reopen the modal).
- After upload, files are passed via `setPendingPropertyUpload` (not route params) and the app `replace`s to the real property id; `useDocumentAutoUpload` consumes the pending batch.
- New properties use placeholder address `Pending address...` until analysis completes.

## Architecture

### Components

#### 1. API Layer (`apps/mapp/lib/api.ts`)

**Endpoints:**

- `DOCUMENT_ANALYSIS_URL`: AI document analysis service
- `RAG_FILE_UPLOAD_URL`: RAG system for document indexing

**Functions:**

```typescript
extractDocInfo(input: ExtractDocInfoInput): Promise<ExtractDocInfoOutput>
```

Analyzes a document using AI to extract:

- `documentType`: Classification (DEED, INSURANCE_POLICY, UTILITY_BILL, INSPECTION_REPORT, MORTGAGE_STATEMENT, OTHER)
- `propertyAddress`: Full normalized address (converts abbreviations like "St" → "Street")
- `keyEntities`: Array of 2-3 key entities with name/value pairs
- `summary`: One-sentence document summary

```typescript
postFileToAgent(gsURI: string, userId: string): Promise<{ success: boolean; error?: string }>
```

Uploads document to RAG system for indexing and chat context (non-blocking, failures don't prevent upload).

#### 2. UI Component (`apps/mapp/components/AddPropertyModal.tsx`)

**Document Upload Flow:**

```
User Selects Document
        ↓
Upload to Firebase Storage (with progress tracking)
        ↓
Get Download URL & gs:// URI
        ↓
    ┌───────┴───────┐
    ↓               ↓
AI Analysis    RAG Upload
    ↓               ↓
Store Results  Index for Chat
    ↓
Display in UI
    ↓
Save to Firestore on Property Creation
```

**Document States:**

1. `uploading`: File is being uploaded to Firebase Storage (shows progress bar)
2. `analyzing`: AI is analyzing the document (shows spinner)
3. `complete`: Analysis complete, results displayed (shows checkmark + summary)
4. `failed`: Upload or analysis failed (shows error message)

**Enhanced Document Type:**

```typescript
type UploadingDocument = {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  size: number;
  progress: number;
  status: 'uploading' | 'analyzing' | 'complete' | 'failed';
  error?: string;
  downloadURL?: string;
  storagePath?: string;
  gsURI?: string;
  // AI analysis results
  documentType?: string;
  propertyAddress?: string;
  keyEntities?: Array<{ name: string; value: string }>;
  summary?: string;
};
```

## Implementation Details

### Upload and Analysis Process

**Location:** `AddPropertyModal.tsx` - `uploadFilesToStorage()` function

```typescript
async uploadFilesToStorage(docsToUpload: UploadingDocument[]) {
  for (const doc of docsToUpload) {
    // 1. Upload to Firebase Storage
    const storageRef = ref(storage, `documents/${userId}/${timestamp}_${filename}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    // 2. Track upload progress
    uploadTask.on('state_changed', (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      // Update UI with progress
    });

    // 3. On upload complete, get URLs
    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
    const gsURI = `gs://${bucket}/${fullPath}`;

    // 4. Run AI analysis and RAG upload in parallel
    const [analysisResult] = await Promise.allSettled([
      extractDocInfo({ docUrl: gsURI, contentType: mimeType }),
      postFileToAgent(gsURI, userId),
    ]);

    // 5. Store analysis results
    if (analysisResult.status === 'fulfilled') {
      // Update document with: documentType, propertyAddress, keyEntities, summary
    }
  }
}
```

### Property Address Auto-Population

**Location:** `AddPropertyModal.tsx` - `handleCreate()` function

When creating a property:

1. System searches all analyzed documents for valid addresses
2. Uses the first address found (where `propertyAddress !== 'N/A'`)
3. Sets both property `name` and `address` to the extracted address
4. Falls back to user-entered name if no address is found

```typescript
const extractedAddress = documents.find(
  (doc) => doc.propertyAddress && doc.propertyAddress !== 'N/A'
)?.propertyAddress;

await addDoc(collection(db, 'users', userId, 'properties'), {
  userId,
  name: extractedAddress || propertyName.trim(),
  address: extractedAddress || 'Pending address...',
  createdAt: serverTimestamp(),
});
```

### Firestore Document Storage

**Location:** `AddPropertyModal.tsx` - `saveDocumentsToFirestore()` function

Documents are saved to `users/{uid}/docs` with the following schema:

```typescript
{
  userId: string;
  propertyId: string;
  name: string;
  url: string; // Firebase Storage download URL
  storagePath: string; // Firebase Storage path
  gsURI: string; // Google Storage URI (gs://)
  contentType: string; // MIME type
  status: 'complete';
  createdAt: Timestamp;

  // AI Analysis Results
  documentType: string; // DEED, INSURANCE_POLICY, etc. (default: 'OTHER')
  propertyAddress: string; // Extracted address (default: 'N/A')
  keyEntities: Array<{
    // Key information (default: [])
    name: string;
    value: string;
  }>;
  summary: string; // One-sentence summary (default: 'No summary available')
}
```

## UI Display

### Analysis Status Indicators

**During Upload (status: 'uploading'):**

```
📄 document.pdf
150.5 KB
Uploading... 45%
[████████░░░░░░░░]
```

**During Analysis (status: 'analyzing'):**

```
📄 document.pdf
150.5 KB
⟳ Analyzing...
```

**Complete (status: 'complete'):**

```
📄 document.pdf
150.5 KB
✓ Complete

┌─────────────────────────────────┐
│ DEED • Property deed for        │
│ residential home at 123 Main    │
│ Street                          │
│                                 │
│ 📍 123 Main Street, Anytown,   │
│    CA 12345                     │
└─────────────────────────────────┘
```

**Failed (status: 'failed'):**

```
📄 document.pdf
150.5 KB
⚠ Upload failed
```

## User Flow

### Creating a New Property with Documents

1. **User opens "Add New Property" modal**
   - Enters property name (optional if document has address)
   - Clicks "Upload" button

2. **User selects documents**
   - Can select multiple documents at once
   - Supported formats: PDF, DOC, DOCX, JPG, PNG, XLS, XLSX

3. **Documents upload immediately**
   - Progress bar shows upload percentage
   - Each document uploads independently

4. **AI analyzes documents automatically**
   - Status changes to "Analyzing..." with spinner
   - Happens in parallel with RAG indexing
   - Non-blocking (failures don't prevent property creation)

5. **Results displayed**
   - Document type badge (e.g., "DEED")
   - One-sentence summary
   - Extracted address (if found)

6. **User clicks "Create Property"**
   - System validates all uploads complete
   - Extracts first valid address from documents
   - Creates property with auto-populated address
   - Saves all documents with analysis metadata to Firestore
   - Creates draft chat session
   - Navigates to property details page

## Document Types

The AI categorizes documents into these types:

| Type                 | Description                  | Example                            |
| -------------------- | ---------------------------- | ---------------------------------- |
| `DEED`               | Property deeds and titles    | Warranty deed, quit claim deed     |
| `INSURANCE_POLICY`   | Insurance documents          | Homeowners insurance policy        |
| `UTILITY_BILL`       | Utility bills and statements | Electric, water, gas bills         |
| `INSPECTION_REPORT`  | Property inspection reports  | Home inspection, pest inspection   |
| `MORTGAGE_STATEMENT` | Mortgage and loan documents  | Mortgage statement, loan agreement |
| `OTHER`              | All other documents          | General documents, miscellaneous   |

## Address Normalization

The AI normalizes addresses to a standard format:

**Input:**

```
123 Main St, Apt 4B
Anytown, CA 12345
```

**Output:**

```
123 Main Street, Apt 4B, Anytown, CA 12345
```

**Normalization Rules:**

- `St` → `Street`
- `Ave` → `Avenue`
- `Rd` → `Road`
- `Blvd` → `Boulevard`
- `Dr` → `Drive`
- Proper capitalization
- Consistent comma placement

## Key Entities

The AI extracts 2-3 important entities from each document:

**Example for Insurance Policy:**

```typescript
[
  { name: 'Policy Number', value: 'POL12345678' },
  { name: 'Insurance Provider', value: 'Allstate' },
  { name: 'Coverage Amount', value: '$500,000' },
];
```

**Example for Deed:**

```typescript
[
  { name: 'Property Address', value: '123 Main Street, Anytown, CA' },
  { name: 'Deed Type', value: 'Warranty Deed' },
  { name: 'Recording Date', value: 'January 15, 2024' },
];
```

**Example for Utility Bill:**

```typescript
[
  { name: 'Service Provider', value: 'Pacific Gas & Electric' },
  { name: 'Account Number', value: '123456789' },
  { name: 'Billing Period', value: 'Dec 1 - Dec 31, 2024' },
];
```

## Error Handling

### Non-Blocking Failures

Both AI analysis and RAG upload are **non-blocking**:

- If AI analysis fails, document is still saved with default values
- If RAG upload fails, warning is logged but upload continues
- Users can still create properties even if analysis fails

### Graceful Degradation

```typescript
// Analysis failed - use defaults
documentType: doc.documentType || 'OTHER';
propertyAddress: doc.propertyAddress || 'N/A';
keyEntities: doc.keyEntities || [];
summary: doc.summary || 'No summary available';
```

### User-Visible Errors

Upload failures are shown to the user:

```
⚠ Upload failed: Network error
```

Analysis failures are silent (default values used).

## Performance Considerations

### Parallel Processing

- AI analysis and RAG upload run in parallel using `Promise.allSettled()`
- Multiple documents can be uploaded simultaneously
- Each document's analysis is independent

### Progress Tracking

- Real-time upload progress via Firebase `uploadBytesResumable`
- Status updates: uploading → analyzing → complete
- UI remains responsive during analysis

### Timeout Handling

- No explicit timeout on AI analysis (service-level timeout applies)
- Long-running analyses don't block UI
- Users can close modal and navigate away (upload continues in background)

## Integration with Chat System

Documents uploaded with analysis results are automatically:

1. **Indexed in RAG system** via `postFileToAgent()`
2. **Available in chat context** for AI assistant queries
3. **Auto-selected by default** in property chat sessions

The extracted information (address, type, entities, summary) helps the AI provide more accurate responses about the property.

## Testing

### Manual Testing Checklist

- [ ] Upload single document - verify analysis appears
- [ ] Upload multiple documents - verify all are analyzed
- [ ] Upload document with address - verify property auto-populated
- [ ] Upload document without address - verify fallback to manual name
- [ ] Test all supported file types (PDF, DOC, DOCX, JPG, PNG, XLS, XLSX)
- [ ] Test large files (>5MB) - verify progress tracking
- [ ] Test network interruption - verify error handling
- [ ] Test simultaneous uploads - verify no race conditions
- [ ] Verify documents appear in chat with correct context
- [ ] Verify address normalization (St → Street, etc.)

### Example Test Documents

**Test Case 1: Deed with Address**

- Upload: Property deed PDF
- Expected: Document type = DEED, address extracted, property auto-named

**Test Case 2: Insurance Policy**

- Upload: Insurance policy PDF
- Expected: Document type = INSURANCE_POLICY, policy number extracted

**Test Case 3: Multiple Documents**

- Upload: Deed + Insurance + Utility bill
- Expected: All analyzed, first valid address used for property

## Future Enhancements

### Potential Improvements

1. **Address Confirmation Dialog**
   - Show extracted address to user for confirmation
   - Allow editing before property creation
   - Match webapp's `AddressConfirmationContext` behavior

2. **Document Type Icons**
   - Add visual icons for each document type
   - Match webapp's icon system (Home, Shield, Zap, etc.)

3. **Entity Display**
   - Show extracted key entities in expandable section
   - Make entities searchable/filterable

4. **Batch Analysis**
   - Analyze all documents in single API call
   - Improve performance for multiple uploads

5. **Offline Support**
   - Queue documents for analysis when offline
   - Analyze when connection restored

6. **Advanced Filtering**
   - Filter documents by type in property details
   - Search by extracted entities
   - Date range filtering

## Related Files

- `apps/mapp/lib/api.ts` - API functions for document analysis
- `apps/mapp/components/AddPropertyModal.tsx` - Property creation with document upload
- `apps/mapp/app/(tabs)/home/index.tsx` - Property list with modal integration
- `apps/webapp/src/ai/flows/extract-doc-info.ts` - Webapp AI analysis (reference)
- `apps/webapp/src/components/properties/upload-documents-dialog.tsx` - Webapp upload UI (reference)

## API Reference

### extractDocInfo()

**Purpose:** Analyze document and extract structured information

**Parameters:**

```typescript
{
  docUrl: string; // Public URL of the document
  contentType: string; // MIME type (e.g., 'application/pdf')
}
```

**Returns:**

```typescript
{
  documentType: DocumentType; // Classification
  propertyAddress: string; // Normalized address or 'N/A'
  keyEntities: Array<{ name: string; value: string }>; // 2-3 key entities
  summary: string; // One-sentence summary
}
```

**Example:**

```typescript
const result = await extractDocInfo({
  docUrl: 'https://storage.googleapis.com/...document.pdf',
  contentType: 'application/pdf',
});

console.log(result);
// {
//   documentType: 'DEED',
//   propertyAddress: '123 Main Street, Anytown, CA 12345',
//   keyEntities: [
//     { name: 'Deed Type', value: 'Warranty Deed' },
//     { name: 'Recording Date', value: 'January 15, 2024' }
//   ],
//   summary: 'Warranty deed for residential property at 123 Main Street.'
// }
```

### postFileToAgent()

**Purpose:** Upload document to RAG system for indexing

**Parameters:**

```typescript
{
  gsURI: string; // Google Storage URI (gs://bucket/path)
  userId: string; // User ID
}
```

**Returns:**

```typescript
{
  success: boolean;  // true if indexed successfully
  error?: string;    // Error message if failed (non-blocking)
}
```

**Example:**

```typescript
const result = await postFileToAgent('gs://my-bucket/documents/user123/doc.pdf', 'user123');

console.log(result);
// { success: true }
```

## Troubleshooting

### Common Issues

**Issue: Analysis never completes (stuck on "Analyzing...")**

- Check network connectivity
- Verify DOCUMENT_ANALYSIS_URL is accessible
- Check backend logs for errors
- Try smaller document file

**Issue: Wrong document type detected**

- Document may be ambiguous or poor quality
- AI makes best guess based on content
- User cannot manually override (future enhancement)

**Issue: Address not extracted**

- Document may not contain a clear address
- OCR quality may be poor
- Address may be in non-standard format
- System returns 'N/A' and falls back to manual name

**Issue: Property created with "Pending address..."**

- No documents had valid addresses
- User can edit property details after creation
- Future: prompt user to enter address manually

## Configuration

### Environment Variables

The following URLs are hardcoded in `apps/mapp/lib/api.ts`:

```typescript
const DOCUMENT_ANALYSIS_URL =
  'https://homecare-agent-proxy-321433914812.us-central1.run.app/.../extract-doc-info';

const RAG_FILE_UPLOAD_URL =
  'https://homecare-agent-proxy-321433914812.us-central1.run.app/.../rag-upload';
```

To use different endpoints, update these constants.

### Firebase Configuration

Documents are stored in Firebase:

- **Storage Path:** `documents/{userId}/{timestamp}_{filename}`
- **Firestore Collection:** `users/{userId}/docs`
- **Required Permissions:** Read/write access to user's document collection

## Credits

This implementation is based on the webapp's document analysis system:

- AI analysis using Google Gemini via Genkit
- Address extraction with normalization
- Document type classification
- RAG system integration for chat context
