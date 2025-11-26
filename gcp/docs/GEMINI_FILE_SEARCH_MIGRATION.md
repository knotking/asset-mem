# Gemini File Search Migration Guide

This guide describes how to migrate from the existing Vertex AI RAG-based file search to the new Gemini File Search infrastructure.

## Overview

### Current Architecture (Vertex AI RAG)
- Files uploaded to GCS
- Worker imports files to Vertex AI RAG corpus
- Import results stored as JSON files in GCS
- User Docs Agent queries RAG corpus for retrieval

### New Architecture (Gemini File Search)
- Files uploaded to GCS
- Worker uploads files to Gemini Files API
- Metadata stored in Firestore
- File Search Agent queries Gemini directly with file context

## Migration Steps

### Phase 1: Infrastructure Deployment

#### 1.1 Deploy Terraform Changes

```bash
cd gcp/terraform/environments/staging

# Review changes
terraform plan

# Apply infrastructure
terraform apply
```

This deploys:
- Firestore database and indexes
- New Pub/Sub topics (file-search-*)
- File search Cloud Functions
- Cloud Scheduler for file refresh

#### 1.2 Create Gemini API Key Secret

```bash
# Create secret in Secret Manager
gcloud secrets create gemini-api-key \
  --project=$PROJECT_ID \
  --replication-policy="automatic"

# Add API key version
echo -n "YOUR_GEMINI_API_KEY" | \
  gcloud secrets versions add gemini-api-key \
  --project=$PROJECT_ID \
  --data-file=-
```

#### 1.3 Deploy Cloud Functions

```bash
cd gcp/proxy/workers/file_search

# Package function
zip -r function-source-file-search.zip main.py requirements.txt

# Upload to GCS
gsutil cp function-source-file-search.zip \
  gs://$GCS_BUCKET/function-source-file-search.zip

# Redeploy functions via Terraform or gcloud
```

#### 1.4 Deploy Proxy API Updates

```bash
cd gcp/proxy/api

# Build and deploy Cloud Run
gcloud run deploy homecare-agent-proxy \
  --source . \
  --region us-central1 \
  --project $PROJECT_ID
```

### Phase 2: Data Migration

#### 2.1 Export Existing RAG Files Metadata

Run the migration script to identify files in the current RAG corpus:

```python
# scripts/export_rag_files.py
import os
import json
from google.cloud import storage
from vertexai import rag

PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
RAG_CORPUS = os.environ.get("USER_UPLOAD_RAG_CORPUS")
BUCKET_NAME = os.environ.get("GOOGLE_CLOUD_BUCKET")

def export_rag_files():
    """Export list of files from RAG corpus."""
    files = list(rag.list_files(corpus_name=RAG_CORPUS))
    
    export_data = []
    for f in files:
        export_data.append({
            "rag_file_id": f.name,
            "display_name": f.display_name,
            "create_time": str(f.create_time),
        })
    
    # Save to file
    with open("rag_files_export.json", "w") as f:
        json.dump(export_data, f, indent=2)
    
    print(f"Exported {len(export_data)} files")
    return export_data

if __name__ == "__main__":
    export_rag_files()
```

#### 2.2 Map RAG Files to GCS URLs

Parse the import results to map RAG files to original GCS URLs:

```python
# scripts/map_rag_to_gcs.py
import json
from google.cloud import storage

def map_rag_files_to_gcs(bucket_name: str):
    """Map RAG file IDs to original GCS URLs from import results."""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    mappings = {}
    
    # Iterate through all user import-results folders
    for blob in bucket.list_blobs(prefix="uploads/"):
        if "import-results" in blob.name and blob.name.endswith(".ndjson"):
            content = blob.download_as_text()
            
            # Extract user_id from path
            parts = blob.name.split("/")
            user_id = parts[1] if len(parts) > 1 else "unknown"
            
            for line in content.splitlines():
                try:
                    obj = json.loads(line)
                    file_id = obj.get("FileId")
                    filename = obj.get("Filename")
                    
                    if file_id and filename:
                        if user_id not in mappings:
                            mappings[user_id] = []
                        
                        mappings[user_id].append({
                            "rag_file_id": file_id,
                            "gcs_url": filename,  # This is the original GCS URL
                        })
                except:
                    pass
    
    with open("rag_to_gcs_mappings.json", "w") as f:
        json.dump(mappings, f, indent=2)
    
    print(f"Mapped files for {len(mappings)} users")
    return mappings

if __name__ == "__main__":
    import os
    bucket = os.environ.get("GOOGLE_CLOUD_BUCKET")
    map_rag_files_to_gcs(bucket)
```

#### 2.3 Re-Upload Files to Gemini

Trigger re-upload of existing files to Gemini Files API:

```python
# scripts/migrate_to_gemini.py
import json
import asyncio
from google.cloud import pubsub_v1

PROJECT_ID = "your-project-id"
TOPIC = "file-search-upload-topic-staging"

def publish_migration_request(user_id: str, gcs_urls: list):
    """Publish file upload request for migration."""
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC)
    
    payload = {
        "user_id": user_id,
        "gcs_urls": gcs_urls,
        "metadata": {"source": "migration"}
    }
    
    future = publisher.publish(
        topic_path,
        json.dumps(payload).encode("utf-8")
    )
    return future.result()

def migrate_all_users():
    """Migrate all users' files to Gemini."""
    with open("rag_to_gcs_mappings.json") as f:
        mappings = json.load(f)
    
    for user_id, files in mappings.items():
        gcs_urls = [f["gcs_url"] for f in files]
        
        # Batch uploads (max 10 files per request)
        for i in range(0, len(gcs_urls), 10):
            batch = gcs_urls[i:i+10]
            message_id = publish_migration_request(user_id, batch)
            print(f"Published migration for {user_id}: {message_id}")

if __name__ == "__main__":
    migrate_all_users()
```

### Phase 3: Agent Migration

#### 3.1 Update Property Agent Configuration

Modify the Property Agent to use the new File Search Agent:

```python
# In gcp/agents/homecare/property_agent/agent.py

# Add import
from property_agent.sub_agents.file_search_agent import file_search_agent

# Option A: Replace user_docs_agent entirely
doculink_agent = Agent(
    model='gemini-2.5-flash',
    name='doculink_agent',
    instruction=doculink_agent_instruction(),
    tools=[
        file_search_agent,  # New: Gemini File Search
        knowledge_base_agent,
    ],
    # ...
)

# Option B: Run both agents in parallel during migration
doculink_agent = Agent(
    model='gemini-2.5-flash',
    name='doculink_agent',
    instruction=doculink_agent_instruction(),
    tools=[
        user_docs_agent,     # Legacy: Vertex AI RAG
        file_search_agent,   # New: Gemini File Search
        knowledge_base_agent,
    ],
    # ...
)
```

#### 3.2 Update Tool Selection Logic

Update the DocuLink agent prompt to prefer File Search:

```python
# In prompts.py
def doculink_agent_instruction() -> str:
    return """
    ...
    When user has uploaded documents:
    1. PREFER using file_search_agent for document queries
    2. Fall back to user_docs_agent only if file_search returns no results
    ...
    """
```

### Phase 4: Client Migration

#### 4.1 Update Webapp File Upload

```typescript
// In webapp/src/lib/api.ts

// Old: RAG file upload
export async function uploadToRAG(gcsUrls: string[], userId: string) {
  return fetch(`${API_BASE}/rag-file-upload`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      context_doc_uris: gcsUrls,
    }),
  });
}

// New: Gemini file upload
export async function uploadToGemini(gcsUrls: string[], userId: string, propertyId?: string) {
  return fetch(`${API_BASE}/file-search/upload`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      gcs_urls: gcsUrls,
      property_id: propertyId,
    }),
  });
}

// Query files
export async function queryFiles(userId: string, query: string, propertyId?: string) {
  return fetch(`${API_BASE}/file-search/query`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      query: query,
      property_id: propertyId,
    }),
  });
}
```

#### 4.2 Update Mobile App File Upload

```typescript
// In mapp/lib/api.ts

export async function uploadDocuments(
  gcsUrls: string[],
  userId: string,
  propertyId?: string
) {
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

### Phase 5: Validation

#### 5.1 Test File Upload

```bash
# Test upload endpoint
curl -X POST "${API_URL}/file-search/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "gcs_urls": ["gs://bucket/test/document.pdf"]
  }'
```

#### 5.2 Test File Query

```bash
# Test query endpoint
curl -X POST "${API_URL}/file-search/query" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "query": "What is the warranty period?"
  }'
```

#### 5.3 Test Agent Integration

```bash
# Test via agent endpoint
curl -X POST "${API_URL}/firebase-agent-stream" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "user_query": "Search my documents for warranty information"
  }'
```

### Phase 6: Cleanup

#### 6.1 Remove Legacy RAG Resources

After successful migration and validation:

```bash
# Delete RAG corpus files (optional - keep for rollback)
# WARNING: This is destructive!

# List files in corpus
gcloud ai rag-files list \
  --project=$PROJECT_ID \
  --corpus-name=$USER_UPLOAD_RAG_CORPUS

# Delete files (if confirmed)
# gcloud ai rag-files delete $FILE_ID --corpus-name=$USER_UPLOAD_RAG_CORPUS
```

#### 6.2 Remove Legacy Code

1. Remove `user_docs_agent` from Property Agent tools
2. Remove legacy `/rag-file-upload` endpoint
3. Remove legacy Cloud Function `pubsub_to_user_docs`
4. Update environment variables

## Rollback Plan

If issues arise during migration:

### Immediate Rollback

1. Revert Property Agent to use `user_docs_agent`
2. Point client apps back to `/rag-file-upload` endpoint
3. Files remain in RAG corpus for immediate use

### Partial Rollback

1. Keep both agents active
2. Update DocuLink prompt to prefer RAG
3. Investigate Gemini issues

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Infrastructure | 1-2 days | None |
| Phase 2: Data Migration | 2-3 days | Phase 1 |
| Phase 3: Agent Migration | 1-2 days | Phase 2 |
| Phase 4: Client Migration | 1-2 days | Phase 3 |
| Phase 5: Validation | 2-3 days | Phase 4 |
| Phase 6: Cleanup | 1 day | Phase 5 + 1 week observation |

**Total: ~2-3 weeks with observation period**

## Monitoring During Migration

### Key Metrics

- File upload success rate (target: >99%)
- Query latency (target: <2s p95)
- Agent response quality (manual review)
- Error rates (target: <1%)

### Alerts

- File upload failures > 5% over 1 hour
- Query latency > 5s p95
- Cloud Function errors

## Support

For migration issues, contact the platform team or file an issue in the repository.

