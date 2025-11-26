# Gemini File Search - Usability Guide

This guide provides detailed instructions for using the Gemini File Search infrastructure from webapp, mobile app, and agent integrations.

## Quick Start

### Prerequisites

1. GCS bucket configured for file uploads
2. Gemini API key configured in Secret Manager
3. File Search infrastructure deployed (see ARCHITECTURE.md)

### Environment Variables

```bash
# For proxy API
GEMINI_API_KEY=your-api-key
GCP_PROJECT_ID=your-project-id
GCS_BUCKET=your-bucket-name
FILE_SEARCH_UPLOAD_TOPIC=file-search-upload-topic-staging
FILE_SEARCH_RESULT_TOPIC=file-search-result-topic-staging

# For agents
GEMINI_API_KEY=your-api-key
GCP_PROJECT_ID=your-project-id
```

## API Reference

### Base URL

```
Production: https://api.homegeek.ai
Staging: https://api-staging.homegeek.ai
```

### Authentication

All endpoints require a `user_id` in the request body. In production, this should be validated against Firebase Auth.

---

## File Upload

### Async Upload (Recommended)

Upload files asynchronously via Pub/Sub. Best for batch uploads.

**Endpoint:** `POST /file-search/upload`

**Request:**
```json
{
  "user_id": "user123",
  "gcs_urls": [
    "gs://bucket/uploads/user123/document1.pdf",
    "gs://bucket/uploads/user123/document2.pdf"
  ],
  "property_id": "property456",
  "metadata": {
    "source": "webapp",
    "document_type": "warranty"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Files queued for processing. Message ID: 123456789",
  "file_ids": [],
  "errors": []
}
```

**Example (JavaScript):**
```javascript
async function uploadFiles(gcsUrls, userId, propertyId) {
  const response = await fetch('/file-search/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      gcs_urls: gcsUrls,
      property_id: propertyId,
    }),
  });
  return response.json();
}
```

### Sync Upload

Upload files synchronously. Use for single files when immediate availability is needed.

**Endpoint:** `POST /file-search/upload-sync`

**Request:** Same as async upload

**Response:**
```json
{
  "success": true,
  "message": "Uploaded 2 files",
  "file_ids": [
    "files/abc123xyz",
    "files/def456uvw"
  ],
  "errors": []
}
```

---

## List Files

List all files for a user, optionally filtered by property or status.

**Endpoint:** `POST /file-search/files/list`

**Request:**
```json
{
  "user_id": "user123",
  "property_id": "property456",
  "status": "active",
  "limit": 50
}
```

**Response:**
```json
[
  {
    "id": "user123_20241126120000_abc12345",
    "user_id": "user123",
    "property_id": "property456",
    "gcs_url": "gs://bucket/uploads/user123/warranty.pdf",
    "gemini_file_id": "files/abc123xyz",
    "original_filename": "warranty.pdf",
    "mime_type": "application/pdf",
    "file_size_bytes": 1048576,
    "status": "active",
    "created_at": "2024-11-26T12:00:00Z",
    "expires_at": "2024-11-28T12:00:00Z"
  }
]
```

**Status Values:**
- `pending` - Queued for processing
- `processing` - Currently uploading
- `active` - Ready for queries
- `expired` - Gemini file expired (will be refreshed)
- `failed` - Upload failed
- `deleted` - Soft deleted

---

## Get Single File

**Endpoint:** `GET /file-search/files/{doc_id}?user_id={user_id}`

**Response:**
```json
{
  "id": "user123_20241126120000_abc12345",
  "user_id": "user123",
  "property_id": "property456",
  "gcs_url": "gs://bucket/uploads/user123/warranty.pdf",
  "gemini_file_id": "files/abc123xyz",
  "original_filename": "warranty.pdf",
  "mime_type": "application/pdf",
  "file_size_bytes": 1048576,
  "status": "active",
  "created_at": "2024-11-26T12:00:00Z",
  "expires_at": "2024-11-28T12:00:00Z"
}
```

---

## Delete File

**Endpoint:** `DELETE /file-search/files/{doc_id}?user_id={user_id}`

**Response:**
```json
{
  "success": true,
  "message": "File deleted"
}
```

---

## Query Files

Search across user's files using semantic search.

**Endpoint:** `POST /file-search/query`

**Request:**
```json
{
  "user_id": "user123",
  "query": "What is the warranty coverage for the HVAC system?",
  "property_id": "property456",
  "file_ids": ["files/abc123", "files/def456"],
  "top_k": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "content": "The HVAC system has a 10-year warranty covering all parts and labor...",
      "score": 0.95,
      "file_id": "files/abc123",
      "file_name": "hvac_warranty.pdf",
      "chunk_index": 1
    },
    {
      "content": "Warranty does not cover damage from improper installation...",
      "score": 0.82,
      "file_id": "files/abc123",
      "file_name": "hvac_warranty.pdf",
      "chunk_index": 3
    }
  ],
  "total_results": 2,
  "query": "What is the warranty coverage for the HVAC system?"
}
```

---

## File Search Stores

Group files together for organized querying.

### Create Store

**Endpoint:** `POST /file-search/stores/create`

**Request:**
```json
{
  "user_id": "user123",
  "name": "HVAC Documents",
  "file_ids": ["files/abc123", "files/def456"],
  "property_id": "property456",
  "description": "All HVAC-related documents"
}
```

**Response:**
```json
{
  "id": "user123_20241126120000",
  "store_id": "user123_20241126120000",
  "user_id": "user123",
  "property_id": "property456",
  "name": "HVAC Documents",
  "description": "All HVAC-related documents",
  "file_ids": ["files/abc123", "files/def456"],
  "status": "active",
  "created_at": "2024-11-26T12:00:00Z"
}
```

### List Stores

**Endpoint:** `POST /file-search/stores/list?user_id={user_id}&property_id={property_id}`

### Delete Store

**Endpoint:** `DELETE /file-search/stores/{store_id}?user_id={user_id}`

---

## Webapp Integration

### Complete Upload Flow

```typescript
// 1. Upload file to Firebase Storage
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

async function uploadDocument(file: File, userId: string, propertyId: string) {
  const storage = getStorage();
  const timestamp = Date.now();
  const storagePath = `uploads/${userId}/${timestamp}_${file.name}`;
  const storageRef = ref(storage, storagePath);
  
  // Upload to Firebase Storage
  await uploadBytes(storageRef, file);
  
  // Get GCS URL (convert Firebase Storage URL to GCS URL)
  const gcsUrl = `gs://${storage.app.options.storageBucket}/${storagePath}`;
  
  // 2. Register with Gemini File Search
  const response = await fetch('/api/file-search/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      gcs_urls: [gcsUrl],
      property_id: propertyId,
    }),
  });
  
  return response.json();
}
```

### Document Query Component

```tsx
// components/DocumentSearch.tsx
import { useState } from 'react';

export function DocumentSearch({ userId, propertyId }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/file-search/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          query: query,
          property_id: propertyId,
        }),
      });
      const data = await response.json();
      setResults(data.results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your documents..."
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>
      
      <div className="results">
        {results.map((result, idx) => (
          <div key={idx} className="result">
            <p>{result.content}</p>
            <small>Source: {result.file_name} (Score: {result.score.toFixed(2)})</small>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Mobile App Integration

### React Native Upload

```typescript
// hooks/useDocumentUpload.ts
import * as DocumentPicker from 'expo-document-picker';
import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';

export function useDocumentUpload(userId: string, propertyId: string) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickAndUpload = async () => {
    // Pick document
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
    });

    if (result.type === 'cancel') return;

    setUploading(true);
    try {
      // Upload to Firebase Storage
      const storage = getStorage();
      const timestamp = Date.now();
      const storagePath = `uploads/${userId}/${timestamp}_${result.name}`;
      const storageRef = ref(storage, storagePath);

      const response = await fetch(result.uri);
      const blob = await response.blob();

      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on('state_changed', (snapshot) => {
        const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(percent);
      });

      await uploadTask;

      // Register with Gemini
      const gcsUrl = `gs://${storage.app.options.storageBucket}/${storagePath}`;
      await registerWithGemini([gcsUrl], userId, propertyId);

    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return { pickAndUpload, uploading, progress };
}

async function registerWithGemini(gcsUrls: string[], userId: string, propertyId: string) {
  const response = await fetch(`${API_BASE}/file-search/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      gcs_urls: gcsUrls,
      property_id: propertyId,
    }),
  });
  return response.json();
}
```

---

## Agent Integration

### Using File Search Agent in Conversations

When a user asks about their documents, the Property Agent automatically routes to the File Search Agent:

```
User: "What's the warranty on my water heater?"

Property Agent:
→ Routes to File Search Agent (detected document-related query)

File Search Agent:
1. Retrieves user's Gemini files from Firestore
2. Searches files using Gemini model
3. Returns answer with source citations

Response: "According to your uploaded warranty document (water_heater_warranty.pdf), 
your water heater has a 6-year warranty covering the tank and a 1-year warranty 
on parts and labor. [Source: water_heater_warranty.pdf, page 2]"
```

### Direct Agent Tool Usage

```python
from property_agent.sub_agents.file_search_agent import ask_file_search_retrieval

# In your agent implementation
def handle_document_query(user_query: str, context: ToolContext):
    result = ask_file_search_retrieval(
        user_query=user_query,
        context_doc_uris=None,  # Search all files
        tool_context=context,
    )
    return result
```

---

## Best Practices

### 1. File Organization

- Associate files with properties using `property_id`
- Use meaningful filenames
- Upload related documents together

### 2. Query Optimization

- Be specific in queries
- Filter by property when possible
- Use stores to group related documents

### 3. File Management

- Files auto-refresh before 48-hour expiry
- Delete files you no longer need
- Monitor file status for upload failures

### 4. Error Handling

```typescript
async function safeUpload(gcsUrls: string[], userId: string) {
  try {
    const response = await uploadFiles(gcsUrls, userId);
    if (!response.success) {
      console.error('Upload errors:', response.errors);
      // Handle partial failures
      if (response.file_ids.length > 0) {
        // Some files uploaded successfully
      }
    }
    return response;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
```

---

## Supported File Types

| Type | Extensions | Max Size |
|------|------------|----------|
| PDF | .pdf | 2GB |
| Images | .jpg, .jpeg, .png, .gif, .webp | 2GB |
| Documents | .doc, .docx, .txt | 2GB |
| Spreadsheets | .xls, .xlsx, .csv | 2GB |
| Audio | .mp3, .wav, .m4a | 2GB |
| Video | .mp4, .mov, .avi | 2GB |

---

## Troubleshooting

### File Upload Stuck in "Processing"

1. Check Cloud Function logs for errors
2. Verify Gemini API key is valid
3. Check file size limits

### Query Returns No Results

1. Verify files have `status: active`
2. Check if files are associated with correct property
3. Try broader queries

### File Expired

Files are automatically refreshed. If a file shows expired:
1. Manual refresh: `POST /file-search/files/{id}/refresh`
2. Check refresh Cloud Function logs

---

## Rate Limits

| Operation | Limit |
|-----------|-------|
| File uploads | 100 files/minute |
| Queries | 60 queries/minute |
| File refreshes | 50 refreshes/minute |

---

## Support

For issues or questions:
1. Check Cloud Logging for error details
2. Review the Architecture documentation
3. Contact the platform team

