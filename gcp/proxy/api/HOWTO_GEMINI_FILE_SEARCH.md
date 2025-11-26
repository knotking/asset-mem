# How To Use Gemini File Search API

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Workflow](#basic-workflow)
3. [Common Use Cases](#common-use-cases)
4. [Integration Patterns](#integration-patterns)
5. [Advanced Usage](#advanced-usage)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Getting Started

### Prerequisites

1. **Get a Gemini API Key**
   ```bash
   # Visit https://aistudio.google.com/apikey
   # Click "Create API Key"
   # Copy your key
   ```

2. **Set Environment Variable**
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```

3. **Verify Installation**
   ```bash
   cd gcp/proxy/api
   python -c "from gemini_file_search import get_file_search_manager; print('✓ Ready')"
   ```

### Your First Query in 3 Minutes

```python
from gemini_file_search import get_file_search_manager

# Step 1: Initialize
manager = get_file_search_manager()

# Step 2: Create a store
store = manager.create_file_search_store("My First Store")
store_name = store["name"]
print(f"Created: {store_name}")

# Step 3: Import a document from GCS
result = manager.import_gcs_file_to_store(
    gcs_uri="gs://your-bucket/document.pdf",
    store_name=store_name,
    display_name="My Document"
)
print(f"Import: {result['status']}")

# Step 4: Ask a question
response = manager.query_file_search(
    query="What is this document about?",
    store_names=[store_name]
)
print(f"Answer: {response['text']}")
```

---

## Basic Workflow

### Workflow 1: Single Document Q&A

**Scenario**: Upload one document and ask questions about it.

```python
from gemini_file_search import get_file_search_manager
import time

manager = get_file_search_manager()

# 1. Create store
print("Creating store...")
store = manager.create_file_search_store("Property Analysis")
store_name = store["name"]

# 2. Upload document
print("Uploading document...")
result = manager.import_gcs_file_to_store(
    gcs_uri="gs://my-bucket/property-deed.pdf",
    store_name=store_name,
    display_name="Property Deed",
    mime_type="application/pdf",
    wait_for_completion=True  # Wait for indexing
)

if result["status"] == "completed":
    print("✓ Document indexed and ready!")
    
    # 3. Ask questions
    questions = [
        "What is the property address?",
        "Who are the owners?",
        "When was the property purchased?",
        "What is the square footage?"
    ]
    
    for question in questions:
        print(f"\nQ: {question}")
        response = manager.query_file_search(
            query=question,
            store_names=[store_name],
            model="gemini-2.5-flash"
        )
        print(f"A: {response['text']}")
        
        # Show source
        if response.get('grounding_metadata'):
            chunks = response['grounding_metadata'].get('grounding_chunks', [])
            if chunks:
                chunk = chunks[0]
                print(f"Source: {chunk.get('document_name')} (Page {chunk.get('page_number', 'N/A')})")
```

### Workflow 2: Multi-Document Search

**Scenario**: Search across multiple related documents.

```python
from gemini_file_search import get_file_search_manager

manager = get_file_search_manager()

# 1. Create store for property documents
store = manager.create_file_search_store("All Property Documents")
store_name = store["name"]

# 2. Upload multiple documents
documents = [
    {"uri": "gs://bucket/deed.pdf", "name": "Property Deed"},
    {"uri": "gs://bucket/insurance.pdf", "name": "Insurance Policy"},
    {"uri": "gs://bucket/inspection.pdf", "name": "Inspection Report"},
    {"uri": "gs://bucket/appraisal.pdf", "name": "Appraisal"}
]

print("Uploading documents...")
for doc in documents:
    print(f"  • {doc['name']}")
    manager.import_gcs_file_to_store(
        gcs_uri=doc["uri"],
        store_name=store_name,
        display_name=doc["name"],
        wait_for_completion=False  # Async for multiple files
    )

# 3. Wait for all imports to complete
print("\nWaiting for indexing...")
time.sleep(30)  # Or poll operation status

# 4. Ask questions across all documents
print("\nQuerying all documents...")
response = manager.query_file_search(
    query="What are all the key dates related to this property?",
    store_names=[store_name]
)

print(f"Answer:\n{response['text']}")

# Show all sources
if response.get('grounding_metadata'):
    chunks = response['grounding_metadata'].get('grounding_chunks', [])
    print(f"\nFound information in {len(chunks)} sources:")
    for i, chunk in enumerate(chunks, 1):
        print(f"  {i}. {chunk.get('document_name')} - Page {chunk.get('page_number', 'N/A')}")
```

### Workflow 3: User-Specific Document Stores

**Scenario**: Each user has their own document collection.

```python
from gemini_file_search import get_file_search_manager

def get_or_create_user_store(user_id):
    """Get or create a File Search store for a specific user."""
    manager = get_file_search_manager()
    
    # Check if user store exists
    stores = manager.list_file_search_stores()
    store_name = f"user_{user_id}_docs"
    
    for store in stores:
        if store_name in store.get('display_name', ''):
            return store['name']
    
    # Create new store
    store = manager.create_file_search_store(f"Documents for {store_name}")
    return store['name']

def add_document_for_user(user_id, gcs_uri, display_name):
    """Add a document to a user's store."""
    manager = get_file_search_manager()
    store_name = get_or_create_user_store(user_id)
    
    result = manager.import_gcs_file_to_store(
        gcs_uri=gcs_uri,
        store_name=store_name,
        display_name=display_name,
        wait_for_completion=False
    )
    
    return result

def query_user_documents(user_id, question):
    """Query a user's documents."""
    manager = get_file_search_manager()
    store_name = get_or_create_user_store(user_id)
    
    response = manager.query_file_search(
        query=question,
        store_names=[store_name]
    )
    
    return response['text']

# Usage
user_id = "user123"

# Add documents
add_document_for_user(user_id, "gs://bucket/deed.pdf", "Property Deed")
add_document_for_user(user_id, "gs://bucket/insurance.pdf", "Insurance")

# Query
answer = query_user_documents(user_id, "What properties do I own?")
print(answer)
```

---

## Common Use Cases

### Use Case 1: Property Document Analysis

```python
def analyze_property_documents(property_id, document_uris):
    """Analyze all documents for a property."""
    manager = get_file_search_manager()
    
    # Create property-specific store
    store = manager.create_file_search_store(f"Property {property_id}")
    store_name = store["name"]
    
    # Import all documents
    for uri in document_uris:
        manager.import_gcs_file_to_store(
            gcs_uri=uri,
            store_name=store_name,
            display_name=uri.split('/')[-1]
        )
    
    # Ask comprehensive questions
    questions = [
        "What is the complete property address?",
        "What is the total square footage and lot size?",
        "What are all the insurance policies and their coverage amounts?",
        "When was the last inspection and what issues were found?",
        "What are all the important dates (purchase, closing, etc.)?"
    ]
    
    analysis = {}
    for question in questions:
        response = manager.query_file_search(
            query=question,
            store_names=[store_name]
        )
        analysis[question] = {
            'answer': response['text'],
            'sources': [
                {
                    'document': chunk.get('document_name'),
                    'page': chunk.get('page_number')
                }
                for chunk in response.get('grounding_metadata', {})
                    .get('grounding_chunks', [])
            ]
        }
    
    return analysis

# Usage
documents = [
    "gs://bucket/properties/prop123/deed.pdf",
    "gs://bucket/properties/prop123/insurance.pdf",
    "gs://bucket/properties/prop123/inspection.pdf"
]

results = analyze_property_documents("prop123", documents)

for question, data in results.items():
    print(f"\nQ: {question}")
    print(f"A: {data['answer']}")
    if data['sources']:
        print("Sources:", ", ".join([f"{s['document']} p.{s['page']}" for s in data['sources']]))
```

### Use Case 2: Document Comparison

```python
def compare_insurance_policies(policy_uris):
    """Compare multiple insurance policies."""
    manager = get_file_search_manager()
    
    store = manager.create_file_search_store("Insurance Comparison")
    store_name = store["name"]
    
    # Upload all policies
    for i, uri in enumerate(policy_uris, 1):
        manager.import_gcs_file_to_store(
            gcs_uri=uri,
            store_name=store_name,
            display_name=f"Policy {i}"
        )
    
    # Comparison questions
    response = manager.query_file_search(
        query="""Compare all insurance policies and create a table showing:
        1. Policy number
        2. Coverage amount
        3. Deductible
        4. Premium
        5. Key exclusions""",
        store_names=[store_name],
        model="gemini-2.5-pro"  # Use Pro for complex analysis
    )
    
    return response['text']

# Usage
policies = [
    "gs://bucket/insurance/home-policy.pdf",
    "gs://bucket/insurance/auto-policy.pdf",
    "gs://bucket/insurance/umbrella-policy.pdf"
]

comparison = compare_insurance_policies(policies)
print(comparison)
```

### Use Case 3: Information Extraction

```python
def extract_structured_data(document_uri):
    """Extract structured information from a document."""
    manager = get_file_search_manager()
    
    store = manager.create_file_search_store("Data Extraction")
    store_name = store["name"]
    
    manager.import_gcs_file_to_store(
        gcs_uri=document_uri,
        store_name=store_name,
        display_name="Document"
    )
    
    # Extract specific information
    queries = {
        'dates': "List all dates mentioned in the document in YYYY-MM-DD format",
        'amounts': "List all monetary amounts with their context",
        'people': "List all people mentioned with their roles",
        'addresses': "List all addresses mentioned",
        'phone_numbers': "List all phone numbers and emails"
    }
    
    extracted = {}
    for key, query in queries.items():
        response = manager.query_file_search(
            query=query,
            store_names=[store_name]
        )
        extracted[key] = response['text']
    
    return extracted

# Usage
data = extract_structured_data("gs://bucket/contract.pdf")
print("Extracted Data:")
for key, value in data.items():
    print(f"\n{key.upper()}:")
    print(value)
```

### Use Case 4: Document Summarization

```python
def summarize_documents(document_uris, summary_type="brief"):
    """Generate summaries of documents."""
    manager = get_file_search_manager()
    
    store = manager.create_file_search_store("Summarization")
    store_name = store["name"]
    
    # Upload documents
    for uri in document_uris:
        manager.import_gcs_file_to_store(
            gcs_uri=uri,
            store_name=store_name,
            display_name=uri.split('/')[-1]
        )
    
    # Generate summary based on type
    if summary_type == "brief":
        query = "Provide a 3-sentence summary of the key points across all documents"
    elif summary_type == "detailed":
        query = "Provide a comprehensive summary with main sections and key details"
    elif summary_type == "executive":
        query = "Provide an executive summary highlighting critical information and action items"
    else:
        query = "Summarize the main points"
    
    response = manager.query_file_search(
        query=query,
        store_names=[store_name],
        model="gemini-2.5-pro"
    )
    
    return response['text']

# Usage
docs = ["gs://bucket/report1.pdf", "gs://bucket/report2.pdf"]
summary = summarize_documents(docs, summary_type="executive")
print("Executive Summary:")
print(summary)
```

---

## Integration Patterns

### Pattern 1: FastAPI Endpoint

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from gemini_file_search import get_file_search_manager

app = FastAPI()

class QueryRequest(BaseModel):
    user_id: str
    question: str

@app.post("/api/query-documents")
async def query_user_docs(request: QueryRequest):
    """Query a user's documents."""
    try:
        manager = get_file_search_manager()
        
        # Get user's store
        store_name = f"fileSearchStores/user_{request.user_id}"
        
        # Query
        response = manager.query_file_search(
            query=request.question,
            store_names=[store_name]
        )
        
        return {
            "answer": response['text'],
            "sources": [
                {
                    "document": chunk.get('document_name'),
                    "page": chunk.get('page_number'),
                    "excerpt": chunk.get('chunk_text', '')[:200]
                }
                for chunk in response.get('grounding_metadata', {})
                    .get('grounding_chunks', [])
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Pattern 2: Document Upload Handler

```python
from firebase_admin import storage
from gemini_file_search import get_file_search_manager

async def on_document_uploaded(user_id, file_path):
    """Called when a user uploads a document to Firebase Storage."""
    
    # Get GCS URI
    bucket = storage.bucket()
    blob = bucket.blob(file_path)
    gcs_uri = f"gs://{bucket.name}/{file_path}"
    
    # Add to File Search
    manager = get_file_search_manager()
    store_name = get_or_create_user_store(user_id)
    
    result = manager.import_gcs_file_to_store(
        gcs_uri=gcs_uri,
        store_name=store_name,
        display_name=blob.name.split('/')[-1],
        mime_type=blob.content_type,
        wait_for_completion=False
    )
    
    # Store operation ID for status checking
    return result['operation_name']

def get_or_create_user_store(user_id):
    """Get or create user's File Search store."""
    manager = get_file_search_manager()
    stores = manager.list_file_search_stores()
    
    for store in stores:
        if f"user_{user_id}" in store.get('display_name', ''):
            return store['name']
    
    store = manager.create_file_search_store(f"Documents for user_{user_id}")
    return store['name']
```

### Pattern 3: Agent Integration

```python
from gemini_file_search import get_file_search_manager

class PropertyAgent:
    """Agent that can answer questions about user's property documents."""
    
    def __init__(self, user_id):
        self.user_id = user_id
        self.manager = get_file_search_manager()
        self.store_name = self._get_user_store()
    
    def _get_user_store(self):
        """Get user's File Search store."""
        stores = self.manager.list_file_search_stores()
        for store in stores:
            if f"user_{self.user_id}" in store.get('display_name', ''):
                return store['name']
        return None
    
    def answer_question(self, question):
        """Answer a question using user's documents."""
        if not self.store_name:
            return "No documents available. Please upload documents first."
        
        response = self.manager.query_file_search(
            query=question,
            store_names=[self.store_name],
            model="gemini-2.5-flash"
        )
        
        # Format response with citations
        answer = response['text']
        
        chunks = response.get('grounding_metadata', {}).get('grounding_chunks', [])
        if chunks:
            answer += "\n\nSources:\n"
            for i, chunk in enumerate(chunks, 1):
                answer += f"{i}. {chunk.get('document_name')} (Page {chunk.get('page_number', 'N/A')})\n"
        
        return answer
    
    def add_document(self, gcs_uri, display_name):
        """Add a document to user's collection."""
        if not self.store_name:
            store = self.manager.create_file_search_store(
                f"Documents for user_{self.user_id}"
            )
            self.store_name = store['name']
        
        return self.manager.import_gcs_file_to_store(
            gcs_uri=gcs_uri,
            store_name=self.store_name,
            display_name=display_name
        )

# Usage
agent = PropertyAgent("user123")
agent.add_document("gs://bucket/deed.pdf", "Property Deed")
answer = agent.answer_question("What is my property address?")
print(answer)
```

---

## Advanced Usage

### Async Operations for Large Files

```python
from gemini_file_search import get_file_search_manager
import asyncio
import time

async def upload_large_files_async(store_name, file_uris):
    """Upload multiple large files without blocking."""
    manager = get_file_search_manager()
    
    operations = []
    
    # Start all uploads
    for uri in file_uris:
        result = manager.import_gcs_file_to_store(
            gcs_uri=uri,
            store_name=store_name,
            display_name=uri.split('/')[-1],
            wait_for_completion=False  # Don't wait
        )
        operations.append(result['operation_name'])
        print(f"Started: {uri}")
    
    # Poll for completion
    print("\nWaiting for all uploads to complete...")
    all_done = False
    while not all_done:
        await asyncio.sleep(5)
        
        statuses = []
        for op_name in operations:
            status = manager.get_operation_status(op_name)
            statuses.append(status['done'])
        
        completed = sum(statuses)
        total = len(statuses)
        print(f"Progress: {completed}/{total} completed")
        
        all_done = all(statuses)
    
    print("✓ All uploads completed!")

# Usage
asyncio.run(upload_large_files_async(
    store_name="fileSearchStores/abc123",
    file_uris=[
        "gs://bucket/large-report-1.pdf",
        "gs://bucket/large-report-2.pdf",
        "gs://bucket/large-report-3.pdf"
    ]
))
```

### Custom Generation Config

```python
from gemini_file_search import get_file_search_manager

def query_with_custom_config(query, store_names):
    """Query with custom generation parameters."""
    manager = get_file_search_manager()
    
    response = manager.query_file_search(
        query=query,
        store_names=store_names,
        model="gemini-2.5-pro",
        generation_config={
            'temperature': 0.1,  # More deterministic
            'top_p': 0.95,
            'top_k': 40,
            'max_output_tokens': 2048,
            'candidate_count': 1
        }
    )
    
    return response['text']

# Usage - more factual, less creative
answer = query_with_custom_config(
    query="List all dates in the document",
    store_names=["fileSearchStores/abc123"]
)
```

### Batch Processing

```python
from gemini_file_search import get_file_search_manager
import json

def batch_analyze_documents(documents_info):
    """Analyze multiple documents in batch."""
    manager = get_file_search_manager()
    results = []
    
    for doc_info in documents_info:
        # Create store for each document
        store = manager.create_file_search_store(doc_info['name'])
        store_name = store['name']
        
        # Upload
        manager.import_gcs_file_to_store(
            gcs_uri=doc_info['uri'],
            store_name=store_name,
            display_name=doc_info['name']
        )
        
        # Analyze
        response = manager.query_file_search(
            query=doc_info['question'],
            store_names=[store_name]
        )
        
        results.append({
            'document': doc_info['name'],
            'question': doc_info['question'],
            'answer': response['text']
        })
    
    return results

# Usage
docs = [
    {
        'name': 'Contract A',
        'uri': 'gs://bucket/contract-a.pdf',
        'question': 'What is the termination date?'
    },
    {
        'name': 'Contract B',
        'uri': 'gs://bucket/contract-b.pdf',
        'question': 'What is the termination date?'
    }
]

results = batch_analyze_documents(docs)
print(json.dumps(results, indent=2))
```

---

## Troubleshooting

### Problem 1: Import Takes Too Long

```python
# Solution: Use async with status polling
def upload_with_status_updates(gcs_uri, store_name):
    manager = get_file_search_manager()
    
    # Start async
    result = manager.import_gcs_file_to_store(
        gcs_uri=gcs_uri,
        store_name=store_name,
        display_name=gcs_uri.split('/')[-1],
        wait_for_completion=False
    )
    
    op_name = result['operation_name']
    print(f"Upload started: {op_name}")
    
    # Poll with updates
    while True:
        time.sleep(5)
        status = manager.get_operation_status(op_name)
        
        if status['done']:
            print("✓ Upload completed!")
            break
        else:
            print("Still processing...")
```

### Problem 2: No Grounding Metadata

```python
# Solution: Ensure document is fully indexed and query is specific
def query_with_retry(query, store_names, max_retries=3):
    manager = get_file_search_manager()
    
    for attempt in range(max_retries):
        response = manager.query_file_search(
            query=query,
            store_names=store_names,
            include_grounding_metadata=True
        )
        
        if response.get('grounding_metadata'):
            return response
        
        print(f"No citations found, retrying... ({attempt + 1}/{max_retries})")
        time.sleep(10)
    
    return response
```

### Problem 3: Storage Limit Exceeded

```python
# Solution: Clean up old stores
def cleanup_old_stores(keep_recent=10):
    manager = get_file_search_manager()
    stores = manager.list_file_search_stores()
    
    # Sort by creation time (if available)
    stores.sort(key=lambda x: x.get('create_time', ''), reverse=True)
    
    # Delete old stores
    for store in stores[keep_recent:]:
        print(f"Deleting old store: {store['display_name']}")
        manager.delete_file_search_store(store['name'])
```

---

## Best Practices

### 1. Store Organization

```python
# ✅ Good: Separate stores by user/category
user_store = create_store(f"user_{user_id}_documents")
property_store = create_store(f"property_{property_id}_docs")

# ❌ Bad: One giant store for everything
all_docs_store = create_store("all_documents")
```

### 2. Display Names

```python
# ✅ Good: Descriptive names
display_name = f"Property_Deed_{property_id}_2024-01-15.pdf"

# ❌ Bad: Generic names
display_name = "document.pdf"
```

### 3. Query Formulation

```python
# ✅ Good: Specific natural language questions
query = "What is the property address listed in the deed?"

# ❌ Bad: Keyword search
query = "address"
```

### 4. Error Handling

```python
# ✅ Good: Comprehensive error handling
try:
    response = manager.query_file_search(query, store_names)
except ValueError as e:
    logger.error(f"Invalid input: {e}")
    return {"error": "Invalid request"}
except Exception as e:
    logger.error(f"Query failed: {e}")
    return {"error": "Service unavailable"}
```

### 5. Resource Cleanup

```python
# ✅ Good: Clean up test stores
def cleanup_after_test():
    manager = get_file_search_manager()
    stores = manager.list_file_search_stores()
    
    for store in stores:
        if "test_" in store['display_name']:
            manager.delete_file_search_store(store['name'])
```

---

## Next Steps

1. **Try the examples**: Run `python example_gemini_file_search.py`
2. **Read the API docs**: See `GEMINI_FILE_SEARCH.md`
3. **Review OpenAPI spec**: See `openapi_gemini_file_search.yaml`
4. **Check architecture**: See `ARCHITECTURE_FILE_SEARCH.md`
5. **Integrate**: Adapt patterns to your use case

---

**Need Help?**
- API Reference: `GEMINI_FILE_SEARCH.md`
- Official Docs: https://ai.google.dev/gemini-api/docs/file-search
- Get API Key: https://aistudio.google.com/apikey

