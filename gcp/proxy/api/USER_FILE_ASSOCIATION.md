# User File Association Guide

## Overview

This guide explains how to associate files with specific users in Gemini File Search, enabling user-scoped document management and queries.

## Key Features

✅ **Auto-create user stores** - Each user gets their own File Search store  
✅ **User ID tracking** - Files are tagged with user IDs  
✅ **Simplified API** - No need to manage store names manually  
✅ **Isolated queries** - Users only see their own documents  
✅ **Easy integration** - Works seamlessly with existing workflows  

## User-Scoped API Endpoints

### 1. Upload File for User

**Endpoint**: `POST /{SECRET}/file-search/user/upload-file`

Automatically creates a user store if it doesn't exist and uploads the file.

```bash
curl -X POST "$BASE_URL/$SECRET/file-search/user/upload-file" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "file_path": "/path/to/document.pdf",
    "display_name": "Property Deed",
    "wait_for_completion": true
  }'
```

```python
from gemini_file_search import get_file_search_manager

manager = get_file_search_manager()

# Upload file for user (store created automatically)
result = manager.upload_user_file(
    user_id="user123",
    file_path="/path/to/document.pdf",
    display_name="Property Deed"
)

print(f"Status: {result['status']}")
```

### 2. Import GCS File for User

**Endpoint**: `POST /{SECRET}/file-search/user/import-gcs-file`

Import files from Google Cloud Storage for a specific user.

```bash
curl -X POST "$BASE_URL/$SECRET/file-search/user/import-gcs-file" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "gcs_uri": "gs://my-bucket/documents/deed.pdf",
    "display_name": "Property Deed",
    "mime_type": "application/pdf",
    "wait_for_completion": true
  }'
```

```python
from gemini_file_search import get_file_search_manager

manager = get_file_search_manager()

# Import GCS file for user
result = manager.import_user_gcs_file(
    user_id="user123",
    gcs_uri="gs://my-bucket/documents/deed.pdf",
    display_name="Property Deed",
    mime_type="application/pdf"
)

print(f"Imported: {result['display_name']}")
```

### 3. Query User Documents

**Endpoint**: `POST /{SECRET}/file-search/user/query`

Query only the documents belonging to a specific user.

```bash
curl -X POST "$BASE_URL/$SECRET/file-search/user/query" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "query": "What documents do I have?",
    "model": "gemini-2.5-flash",
    "include_grounding_metadata": true
  }'
```

```python
from gemini_file_search import get_file_search_manager

manager = get_file_search_manager()

# Query user's documents
response = manager.query_user_documents(
    user_id="user123",
    query="What is my property address?"
)

print(f"Answer: {response['text']}")

# Show citations
if response.get('grounding_metadata'):
    for chunk in response['grounding_metadata']['grounding_chunks']:
        print(f"Source: {chunk['document_name']} (Page {chunk['page_number']})")
```

## Implementation Patterns

### Pattern 1: Document Upload Handler

```python
from gemini_file_search import get_file_search_manager

async def on_user_document_upload(user_id: str, gcs_uri: str, filename: str):
    """Called when user uploads a document."""
    manager = get_file_search_manager()
    
    # Import to user's File Search store (auto-created)
    result = manager.import_user_gcs_file(
        user_id=user_id,
        gcs_uri=gcs_uri,
        display_name=filename,
        wait_for_completion=False  # Async for better UX
    )
    
    return {
        "operation_id": result['operation_name'],
        "status": result['status']
    }
```

### Pattern 2: Chat Agent Integration

```python
from gemini_file_search import get_file_search_manager

class UserDocumentAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.manager = get_file_search_manager()
    
    def answer_question(self, question: str) -> str:
        """Answer questions using user's documents."""
        response = self.manager.query_user_documents(
            user_id=self.user_id,
            query=question
        )
        return response['text']
    
    def add_document(self, gcs_uri: str, name: str):
        """Add a document to user's collection."""
        return self.manager.import_user_gcs_file(
            user_id=self.user_id,
            gcs_uri=gcs_uri,
            display_name=name
        )

# Usage
agent = UserDocumentAgent("user123")
agent.add_document("gs://bucket/deed.pdf", "Property Deed")
answer = agent.answer_question("What is my property address?")
print(answer)
```

### Pattern 3: FastAPI Integration

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from gemini_file_search import get_file_search_manager

app = FastAPI()

class DocumentUploadRequest(BaseModel):
    user_id: str
    gcs_uri: str
    filename: str

class QueryRequest(BaseModel):
    user_id: str
    question: str

@app.post("/api/documents/upload")
async def upload_document(request: DocumentUploadRequest):
    """Upload a document for a user."""
    manager = get_file_search_manager()
    
    result = manager.import_user_gcs_file(
        user_id=request.user_id,
        gcs_uri=request.gcs_uri,
        display_name=request.filename
    )
    
    return {"status": "success", "operation": result['operation_name']}

@app.post("/api/documents/query")
async def query_documents(request: QueryRequest):
    """Query user's documents."""
    manager = get_file_search_manager()
    
    response = manager.query_user_documents(
        user_id=request.user_id,
        query=request.question
    )
    
    return {
        "answer": response['text'],
        "sources": [
            {
                "document": chunk['document_name'],
                "page": chunk.get('page_number')
            }
            for chunk in response.get('grounding_metadata', {})
                .get('grounding_chunks', [])
        ]
    }
```

## How It Works

### User Store Naming Convention

Files are associated with users through a consistent naming convention:

```
Store Name Pattern: "Documents for user_{user_id}"
File Display Name: "[user:{user_id}] {original_filename}"
```

Example:
```python
user_id = "user123"
store_name = "Documents for user_user123"
file_name = "[user:user123] property-deed.pdf"
```

### Automatic Store Management

```
User uploads file
       │
       ▼
Check if user store exists
       │
       ├─── Yes ──→ Use existing store
       │            fileSearchStores/abc123
       │
       └─── No ───→ Create new store
                    "Documents for user_user123"
                    │
                    ▼
            Upload file to store
            with user ID tag
```

### User Isolation

```
User A (user123)
    Store: fileSearchStores/abc123
    Files:
        • [user:user123] deed.pdf
        • [user:user123] insurance.pdf

User B (user456)
    Store: fileSearchStores/def456
    Files:
        • [user:user456] mortgage.pdf
        • [user:user456] appraisal.pdf

Query from User A
    ↓
Only searches fileSearchStores/abc123
    ↓
Returns only User A's documents
```

## Migration from Existing Code

### Before (Manual Store Management)

```python
# Old way - manual store management
manager = get_file_search_manager()

# Create store manually
store = manager.create_file_search_store("User Documents")
store_name = store['name']

# Upload file
manager.import_gcs_file_to_store(
    gcs_uri="gs://bucket/file.pdf",
    store_name=store_name,
    display_name="Document"
)

# Query - need to remember store name
response = manager.query_file_search(
    query="What is this about?",
    store_names=[store_name]
)
```

### After (User-Scoped APIs)

```python
# New way - automatic user store management
manager = get_file_search_manager()

# Upload file (store created automatically)
manager.import_user_gcs_file(
    user_id="user123",
    gcs_uri="gs://bucket/file.pdf",
    display_name="Document"
)

# Query - just provide user_id
response = manager.query_user_documents(
    user_id="user123",
    query="What is this about?"
)
```

## Best Practices

### 1. Always Use User ID

```python
# ✅ Good: Include user_id
manager.import_user_gcs_file(
    user_id="user123",
    gcs_uri="gs://bucket/file.pdf"
)

# ❌ Bad: Manual store management
manager.import_gcs_file_to_store(
    gcs_uri="gs://bucket/file.pdf",
    store_name="some-store"
)
```

### 2. Consistent User IDs

```python
# ✅ Good: Use consistent user IDs
user_id = get_authenticated_user_id()
manager.query_user_documents(user_id=user_id, query="...")

# ❌ Bad: Inconsistent IDs
manager.query_user_documents(user_id="user_123", query="...")
manager.query_user_documents(user_id="123", query="...")
```

### 3. Handle No Documents Gracefully

```python
response = manager.query_user_documents(
    user_id="user123",
    query="What documents do I have?"
)

if response['text'] == "No documents available. Please upload documents first.":
    print("User has no documents yet")
else:
    print(response['text'])
```

## Integration Examples

### With Firebase Storage

```python
from firebase_admin import storage
from gemini_file_search import get_file_search_manager

def on_firebase_file_upload(user_id: str, file_path: str):
    """When user uploads to Firebase Storage."""
    bucket = storage.bucket()
    blob = bucket.blob(file_path)
    gcs_uri = f"gs://{bucket.name}/{file_path}"
    
    manager = get_file_search_manager()
    result = manager.import_user_gcs_file(
        user_id=user_id,
        gcs_uri=gcs_uri,
        display_name=blob.name,
        mime_type=blob.content_type
    )
    
    return result
```

### With Existing Agent System

```python
from gemini_file_search import get_file_search_manager

def enhanced_agent_query(user_id: str, query: str):
    """Query both File Search and existing agent."""
    manager = get_file_search_manager()
    
    # Try File Search first
    file_search_response = manager.query_user_documents(
        user_id=user_id,
        query=query
    )
    
    # If File Search has good results, use them
    if file_search_response.get('grounding_metadata'):
        return {
            "source": "file_search",
            "answer": file_search_response['text'],
            "citations": file_search_response['grounding_metadata']
        }
    
    # Fall back to existing agent
    agent_response = query_existing_agent(query)
    return {
        "source": "agent",
        "answer": agent_response
    }
```

## Troubleshooting

### Issue: User has no documents

**Symptom**: Query returns "No documents available"

**Solution**:
```python
# Check if user store exists
manager = get_file_search_manager()
store_name = manager.get_user_store_name("user123")

if not store_name:
    print("User has no store - no documents uploaded yet")
else:
    print(f"User store exists: {store_name}")
```

### Issue: Files not showing in queries

**Symptom**: User uploaded files but queries don't return them

**Solution**:
```python
# Wait for indexing to complete
import time

result = manager.import_user_gcs_file(
    user_id="user123",
    gcs_uri="gs://bucket/file.pdf",
    wait_for_completion=True  # Important!
)

if result['status'] == 'timeout':
    # File is still indexing
    time.sleep(30)
```

### Issue: Wrong user seeing documents

**Symptom**: Cross-user data leakage

**Cause**: Using wrong user_id in queries

**Solution**:
```python
# Always get user_id from authenticated session
user_id = get_authenticated_user_id()  # From your auth system

# Never use user input directly as user_id
# ❌ Bad: user_id = request.get('user_id')
# ✅ Good: user_id = session.user_id
```

## Summary

User file association provides:

✅ **Automatic store creation** per user  
✅ **Simple API** - just provide user_id  
✅ **User isolation** - each user sees only their files  
✅ **Easy migration** - backwards compatible  
✅ **Production ready** - error handling included  

**Next Steps**:
1. Use `import_user_gcs_file()` for uploads
2. Use `query_user_documents()` for queries
3. Integrate with your auth system
4. Monitor user store sizes

---

**Documentation**: [GEMINI_FILE_SEARCH.md](GEMINI_FILE_SEARCH.md)  
**Examples**: [example_gemini_file_search.py](example_gemini_file_search.py)  
**Architecture**: [ARCHITECTURE_FILE_SEARCH.md](ARCHITECTURE_FILE_SEARCH.md)

