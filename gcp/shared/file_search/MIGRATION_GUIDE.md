# Migration Guide: Moving to Shared File Search Library

This guide helps you migrate existing code to use the new shared file search abstraction.

## Overview

The shared file search library provides a unified interface that works with both:
- Gemini File Search (used in proxy)
- Vertex AI RAG (used in agents)

## Migration Paths

### Path 1: Proxy API (Gemini File Search)

**Current Location:** `gcp/proxy/api/gemini_file_search.py`
**New Location:** `gcp/shared/file_search/`
**Wrapper:** `gcp/proxy/api/gemini_file_search_v2.py`

#### Option A: Use the v2 Wrapper (Minimal Changes)

The v2 wrapper maintains the same interface as the original, so you can simply update your imports:

```python
# Before
from gemini_file_search import GeminiFileSearchManager

# After
from gemini_file_search_v2 import GeminiFileSearchManager

# Rest of code stays the same
manager = GeminiFileSearchManager(api_key='...')
store = manager.create_file_search_store('My Docs')
result = manager.query_file_search('...', [store['name']])
```

#### Option B: Use Shared Library Directly (Recommended)

For new code or refactoring, use the shared library directly:

```python
# Before
from gemini_file_search import GeminiFileSearchManager

manager = GeminiFileSearchManager(api_key='...')
store = manager.create_file_search_store('My Docs')
result = manager.query_file_search('...', [store['name']])

# After
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from shared.file_search import get_file_search_manager

manager = get_file_search_manager(backend='gemini', api_key='...')
store = manager.create_store('My Docs')  # Note: create_store instead of create_file_search_store
result = manager.query('...', [store.name])  # Note: query instead of query_file_search
```

**Key Changes:**
- `create_file_search_store()` → `create_store()` (returns FileSearchStore object)
- `query_file_search()` → `query()` (returns FileSearchResult object)
- `list_file_search_stores()` → `list_stores()` (returns list of FileSearchStore objects)
- Response objects are now dataclasses instead of dicts

### Path 2: Agents (Vertex AI RAG)

**Current Location:** `gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/agent.py`
**New Location:** `gcp/shared/file_search/`
**Wrapper:** `gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/agent_v2.py`

#### Option A: Use the v2 Agent (Minimal Changes)

Update your agent imports:

```python
# Before
from property_agent.sub_agents.user_docs_agent.agent import user_docs_agent

# After
from property_agent.sub_agents.user_docs_agent.agent_v2 import user_docs_agent_v2 as user_docs_agent

# Rest of agent code stays the same
```

#### Option B: Refactor to Use Shared Library (Recommended)

```python
# Before
from vertexai.preview import rag

rag_resources = [rag.RagResource(rag_corpus=corpus, rag_file_ids=file_ids)]
response = rag.retrieval_query(
    text=query,
    rag_resources=rag_resources,
    similarity_top_k=10,
    vector_distance_threshold=0.6
)
chunks = [context.text for context in response.contexts.contexts]

# After
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../../../.."))

from shared.file_search import get_file_search_manager

manager = get_file_search_manager(
    backend='vertex',
    project_id=os.environ.get('GCP_PROJECT_ID'),
    corpus_name=os.environ.get('USER_UPLOAD_RAG_CORPUS'),
    use_genai=False  # Use native RAG retrieval
)

result = manager.query(
    query=query,
    store_names=[corpus],
    file_ids=file_ids,
    similarity_top_k=10,
    vector_distance_threshold=0.6
)

# Access results
chunks = [chunk.chunk_text for chunk in result.grounding_chunks]
```

## Detailed Migration Steps

### Step 1: Add Shared Library to Path

Add this at the top of your file:

```python
import sys
import os

# For proxy (2 levels up)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

# For agents (7 levels up)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../../../.."))
```

### Step 2: Update Imports

```python
# Old imports (remove these)
from gemini_file_search import GeminiFileSearchManager
from vertexai.preview import rag

# New imports
from shared.file_search import get_file_search_manager
# Or for specific backends
from shared.file_search import GeminiFileSearchBackend, VertexAIRAGBackend
```

### Step 3: Update Initialization

**Gemini:**

```python
# Before
manager = GeminiFileSearchManager(api_key='...')

# After
manager = get_file_search_manager(backend='gemini', api_key='...')
# Or auto-detect
from shared.file_search import auto_detect_backend
manager = auto_detect_backend()
```

**Vertex:**

```python
# Before
# (Direct rag API usage)

# After
manager = get_file_search_manager(
    backend='vertex',
    project_id=os.environ.get('GCP_PROJECT_ID'),
    location=os.environ.get('GCP_LOCATION', 'us-central1'),
    corpus_name=os.environ.get('USER_UPLOAD_RAG_CORPUS'),
    gcs_bucket=os.environ.get('GOOGLE_CLOUD_BUCKET'),
    use_genai=False  # For retrieval-only
)
```

### Step 4: Update Method Calls

#### Store Management

```python
# Before (Gemini)
store_dict = manager.create_file_search_store('My Docs')
store_name = store_dict['name']

# After
store_obj = manager.create_store('My Docs')
store_name = store.name

# Before (Gemini)
stores_list = manager.list_file_search_stores()
for store in stores_list:
    print(store['name'], store['display_name'])

# After
stores_list = manager.list_stores()
for store in stores_list:
    print(store.name, store.display_name)
```

#### File Upload

```python
# Before (Gemini)
result = manager.upload_file_to_store(
    file_path='doc.pdf',
    store_name=store_name,
    display_name='Document',
    user_id='user123'
)
print(result['status'], result['display_name'])

# After
result = manager.upload_file(
    store_name=store_name,  # Note: parameter order changed
    file_path='doc.pdf',
    display_name='Document',
    user_id='user123'
)
print(result.status, result.display_name)
```

#### Query

```python
# Before (Gemini)
result = manager.query_file_search(
    query='What is the address?',
    store_names=[store_name],
    model='gemini-2.5-flash'
)
print(result['text'])
if 'grounding_metadata' in result:
    for chunk in result['grounding_metadata']['grounding_chunks']:
        print(chunk['document_name'])

# After
result = manager.query(
    query='What is the address?',
    store_names=[store_name],
    model='gemini-2.5-flash'
)
print(result.text)
for chunk in result.grounding_chunks:
    print(chunk.document_name)
```

```python
# Before (Vertex AI)
response = rag.retrieval_query(
    text='What is the address?',
    rag_resources=[rag.RagResource(rag_corpus=corpus, rag_file_ids=file_ids)],
    similarity_top_k=10
)
chunks = [context.text for context in response.contexts.contexts]

# After
result = manager.query(
    query='What is the address?',
    store_names=[corpus],
    file_ids=file_ids,
    similarity_top_k=10
)
chunks = [chunk.chunk_text for chunk in result.grounding_chunks]
```

### Step 5: Update Response Handling

**Before (dict access):**

```python
result = manager.query_file_search(...)
text = result['text']
model = result['model']
stores = result['stores_queried']

if 'grounding_metadata' in result:
    chunks = result['grounding_metadata']['grounding_chunks']
    for chunk in chunks:
        doc = chunk['document_name']
        text = chunk['chunk_text']
        page = chunk.get('page_number')
```

**After (object attributes):**

```python
result = manager.query(...)
text = result.text
model = result.model
stores = result.stores_queried

for chunk in result.grounding_chunks:
    doc = chunk.document_name
    text = chunk.chunk_text
    page = chunk.page_number
```

## Example Migrations

### Example 1: Proxy API Endpoint

**Before:**

```python
from gemini_file_search import get_file_search_manager

@app.post("/file-search/query")
async def query_file_search(request: QueryRequest):
    manager = get_file_search_manager()
    result = manager.query_file_search(
        query=request.query,
        store_names=request.store_names
    )
    return result
```

**After (using v2 wrapper):**

```python
from gemini_file_search_v2 import GeminiFileSearchManager

@app.post("/file-search/query")
async def query_file_search(request: QueryRequest):
    manager = GeminiFileSearchManager()
    result = manager.query_file_search(
        query=request.query,
        store_names=request.store_names
    )
    return result
```

**After (using shared library):**

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from shared.file_search import get_file_search_manager

@app.post("/file-search/query")
async def query_file_search(request: QueryRequest):
    manager = get_file_search_manager(backend='gemini')
    result = manager.query(
        query=request.query,
        store_names=request.store_names
    )
    
    # Convert to dict for JSON response
    return {
        'text': result.text,
        'model': result.model,
        'stores_queried': result.stores_queried,
        'grounding_chunks': [
            {
                'type': chunk.type,
                'document_name': chunk.document_name,
                'chunk_text': chunk.chunk_text,
                'page_number': chunk.page_number
            }
            for chunk in result.grounding_chunks
        ]
    }
```

### Example 2: Agent Retrieval Function

**Before:**

```python
from vertexai.preview import rag

def ask_user_docs_retrieval(user_query: str, context_doc_uris: List[str], tool_context):
    user_id = tool_context.state.get("user_id")
    
    # Get file IDs
    file_ids = get_user_file_ids(user_id, context_doc_uris)
    
    # Query RAG
    rag_resources = [rag.RagResource(rag_corpus=corpus, rag_file_ids=file_ids)]
    response = rag.retrieval_query(
        text=user_query,
        rag_resources=rag_resources,
        similarity_top_k=10,
        vector_distance_threshold=0.6
    )
    
    return [context.text for context in response.contexts.contexts]
```

**After:**

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../../../.."))

from shared.file_search import get_file_search_manager, VertexAIRAGBackend

def ask_user_docs_retrieval(user_query: str, context_doc_uris: List[str], tool_context):
    user_id = tool_context.state.get("user_id")
    
    # Initialize manager
    manager = get_file_search_manager(
        backend='vertex',
        project_id=os.environ.get('GCP_PROJECT_ID'),
        corpus_name=os.environ.get('USER_UPLOAD_RAG_CORPUS'),
        gcs_bucket=os.environ.get('GOOGLE_CLOUD_BUCKET'),
        use_genai=False
    )
    
    # Get file IDs (using backend-specific method)
    if isinstance(manager, VertexAIRAGBackend):
        file_ids = manager.get_user_file_ids(user_id, context_doc_uris)
    else:
        file_ids = []
    
    # Get corpus
    corpus_name = manager.get_user_store_name(user_id)
    
    # Query
    result = manager.query(
        query=user_query,
        store_names=[corpus_name],
        file_ids=file_ids,
        similarity_top_k=10,
        vector_distance_threshold=0.6
    )
    
    # Extract chunks
    return [chunk.chunk_text for chunk in result.grounding_chunks if chunk.chunk_text]
```

## Common Issues and Solutions

### Issue 1: Import Path Not Working

**Error:** `ModuleNotFoundError: No module named 'shared'`

**Solution:** Ensure you're adding the correct path:

```python
import sys
import os

# Calculate path to gcp/ directory
current_dir = os.path.dirname(__file__)
gcp_dir = os.path.abspath(os.path.join(current_dir, "../.."))  # Adjust levels as needed
sys.path.insert(0, gcp_dir)

from shared.file_search import get_file_search_manager
```

### Issue 2: Dict vs Object Attribute Access

**Error:** `TypeError: 'FileSearchStore' object is not subscriptable`

**Solution:** Use object attributes instead of dict keys:

```python
# Before
store_name = store['name']

# After
store_name = store.name
```

### Issue 3: Missing Backend Configuration

**Error:** `ValueError: project_id or GCP_PROJECT_ID must be set`

**Solution:** Ensure environment variables are set or pass explicitly:

```python
manager = get_file_search_manager(
    backend='vertex',
    project_id='my-project',  # Explicit
    corpus_name='projects/.../ragCorpora/...'
)
```

### Issue 4: Backend-Specific Methods

**Error:** `AttributeError: 'GeminiFileSearchBackend' object has no attribute 'get_user_file_ids'`

**Solution:** Check backend type before calling backend-specific methods:

```python
from shared.file_search import VertexAIRAGBackend

if isinstance(manager, VertexAIRAGBackend):
    file_ids = manager.get_user_file_ids(user_id)
else:
    # Use alternative approach for other backends
    file_ids = []
```

## Testing Your Migration

### 1. Unit Tests

Create tests that work with both old and new implementations:

```python
def test_old_implementation():
    from gemini_file_search import GeminiFileSearchManager
    manager = GeminiFileSearchManager(api_key='test')
    # Test old code...

def test_new_implementation():
    from shared.file_search import get_file_search_manager
    manager = get_file_search_manager(backend='gemini', api_key='test')
    # Test new code...
```

### 2. Integration Tests

Test the full flow with both implementations:

```python
@pytest.mark.parametrize("use_v2", [False, True])
def test_full_workflow(use_v2):
    if use_v2:
        from shared.file_search import get_file_search_manager
        manager = get_file_search_manager(backend='gemini')
    else:
        from gemini_file_search import GeminiFileSearchManager
        manager = GeminiFileSearchManager()
    
    # Run same tests for both
    store = manager.create_store('Test') if use_v2 else manager.create_file_search_store('Test')
    # ...
```

### 3. Regression Tests

Ensure responses are equivalent:

```python
def test_response_equivalence():
    # Old
    old_manager = GeminiFileSearchManager()
    old_result = old_manager.query_file_search('test', [store_name])
    
    # New
    new_manager = get_file_search_manager(backend='gemini')
    new_result = new_manager.query('test', [store_name])
    
    # Compare
    assert old_result['text'] == new_result.text
    assert old_result['model'] == new_result.model
```

## Rollback Plan

If issues arise during migration:

1. **Keep original files** - Don't delete `gemini_file_search.py` or `agent.py`
2. **Use v2 wrappers** - They maintain compatibility while using new backend
3. **Feature flags** - Control which implementation to use:

```python
USE_SHARED_LIBRARY = os.environ.get('USE_SHARED_LIBRARY', 'false').lower() == 'true'

if USE_SHARED_LIBRARY:
    from shared.file_search import get_file_search_manager
    manager = get_file_search_manager(backend='gemini')
else:
    from gemini_file_search import GeminiFileSearchManager
    manager = GeminiFileSearchManager()
```

## Timeline Recommendation

1. **Week 1**: Add shared library, create v2 wrappers
2. **Week 2**: Test v2 wrappers in staging
3. **Week 3**: Migrate proxy to use v2 wrappers
4. **Week 4**: Migrate agents to use v2 wrappers
5. **Week 5**: Refactor to use shared library directly
6. **Week 6**: Remove old implementations

## Getting Help

- See [README.md](./README.md) for API documentation
- Check examples in [README.md Examples section](./README.md#examples)
- Look at v2 wrapper implementations for reference
- Test with both backends to ensure compatibility

## Checklist

Before considering migration complete:

- [ ] All imports updated
- [ ] All method calls updated to new names
- [ ] Response handling changed from dicts to objects
- [ ] Environment variables configured
- [ ] Tests passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Rollback plan in place
- [ ] Monitoring for errors
- [ ] Performance validated

## Summary

| Aspect | Old (Gemini) | Old (Vertex) | New (Shared) |
|--------|-------------|--------------|--------------|
| **Import** | `from gemini_file_search import ...` | `from vertexai.preview import rag` | `from shared.file_search import get_file_search_manager` |
| **Init** | `GeminiFileSearchManager(api_key)` | Direct rag calls | `get_file_search_manager(backend='gemini'/'vertex')` |
| **Store** | `create_file_search_store()` | N/A | `create_store()` |
| **Upload** | `upload_file_to_store()` | N/A | `upload_file()` |
| **Query** | `query_file_search()` | `rag.retrieval_query()` | `query()` |
| **Response** | Dict (`result['text']`) | Native response | Object (`result.text`) |
| **Backend** | Fixed to Gemini | Fixed to Vertex | Configurable |

Good luck with your migration! 🚀

