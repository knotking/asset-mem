# GCP Shared Libraries

Shared utilities and libraries for GCP services across the HomeApp project.

## Overview

This directory contains shared code that can be used across:
- **Proxy API** (`gcp/proxy/`)
- **Agents** (`gcp/agents/`)
- **Workers** (`gcp/workers/`)

The goal is to reduce code duplication and provide consistent interfaces for common operations.

## Available Libraries

### File Search (`file_search/`)

A unified abstraction layer for document search and RAG (Retrieval Augmented Generation) operations.

**Supports:**
- Gemini File Search (google-genai SDK)
- Vertex AI RAG (vertexai.preview.rag)

**Key Features:**
- Backend-agnostic interface
- User-specific document management
- Citations and grounding metadata
- Easy backend switching

**Quick Example:**

```python
from gcp.shared.file_search import get_file_search_manager

# Create manager (auto-detects backend from environment)
manager = get_file_search_manager(backend='gemini')

# Create store and upload file
store = manager.create_store('My Documents')
manager.upload_file(store.name, 'document.pdf')

# Query with citations
result = manager.query('What is in the document?', [store.name])
print(result.text)
print(result.grounding_chunks)
```

**Documentation:** [file_search/README.md](./file_search/README.md)

## Usage

### In Proxy API

```python
# Add parent directory to path
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from shared.file_search import get_file_search_manager

manager = get_file_search_manager(backend='gemini')
```

### In Agents

```python
# Add parent directory to path
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../../../../.."))

from shared.file_search import get_file_search_manager

manager = get_file_search_manager(backend='vertex')
```

## Design Principles

### 1. Abstraction Over Implementation

Shared libraries provide abstract interfaces that hide implementation details. This allows:
- Easy backend switching
- Consistent APIs across services
- Simplified testing and mocking

### 2. Backend Flexibility

Libraries support multiple backends with the same interface:
- Gemini File Search for API-based apps
- Vertex AI RAG for GCP-native apps
- Easy to add new backends in the future

### 3. Configuration via Environment

Libraries prefer environment-based configuration:
- Reduces hard-coded values
- Simplifies deployment across environments
- Easy to override when needed

### 4. User Isolation

User-specific operations are first-class:
- `upload_user_file(user_id, ...)`
- `query_user_documents(user_id, ...)`
- Automatic user store management

### 5. Backward Compatibility

When introducing shared libraries:
- Provide wrapper classes for existing code
- Maintain original interfaces where possible
- Allow gradual migration

## Structure

```
gcp/shared/
├── __init__.py
├── README.md (this file)
└── file_search/
    ├── __init__.py
    ├── README.md
    ├── base.py              # Abstract interfaces
    ├── gemini_backend.py    # Gemini implementation
    ├── vertex_backend.py    # Vertex AI implementation
    └── factory.py           # Factory functions
```

## Adding New Shared Libraries

When creating a new shared library:

1. **Create a new directory** under `gcp/shared/`
2. **Define abstract interfaces** in `base.py`
3. **Implement backends** in separate files
4. **Create factory functions** for easy instantiation
5. **Write comprehensive documentation** in `README.md`
6. **Add examples** and usage patterns
7. **Update this README** with the new library

### Template Structure

```
gcp/shared/your_library/
├── __init__.py          # Export public API
├── README.md            # Comprehensive documentation
├── base.py              # Abstract base classes
├── implementation_a.py  # First implementation
├── implementation_b.py  # Second implementation
└── factory.py           # Factory functions
```

## Testing

### Unit Tests

Test each backend independently:

```python
# Test Gemini backend
from gcp.shared.file_search import GeminiFileSearchBackend

def test_gemini():
    backend = GeminiFileSearchBackend(api_key='test')
    assert backend.backend_type.value == 'gemini'
```

### Integration Tests

Test with real backends (requires credentials):

```python
# Test end-to-end flow
from gcp.shared.file_search import get_file_search_manager

def test_integration():
    manager = get_file_search_manager(backend='gemini')
    store = manager.create_store('Test')
    # ... test full workflow
```

## Dependencies

Shared libraries have their own dependencies:

### File Search

```
# Gemini backend
google-genai>=1.0.0

# Vertex backend
google-cloud-aiplatform>=1.100.0
google-cloud-storage>=2.10.0
```

Install what you need based on which backends you're using.

## Migration Guides

When migrating existing code to use shared libraries:

1. **Keep original code** initially (don't delete)
2. **Create v2 versions** that use shared libraries
3. **Test thoroughly** with both versions
4. **Gradually switch** to v2 in production
5. **Remove original** once v2 is stable

Example:

```
# Old
gemini_file_search.py

# New (wrapper)
gemini_file_search_v2.py  # Uses shared library

# After migration
gemini_file_search.py     # Can be removed or redirected to v2
```

## Best Practices

### 1. Use Factory Functions

```python
# Good
from gcp.shared.file_search import get_file_search_manager
manager = get_file_search_manager(backend='gemini')

# Also good (auto-detect)
from gcp.shared.file_search import auto_detect_backend
manager = auto_detect_backend()

# Avoid (unless you need specific backend features)
from gcp.shared.file_search import GeminiFileSearchBackend
manager = GeminiFileSearchBackend(api_key='...')
```

### 2. Handle Backend Differences

```python
from gcp.shared.file_search import VertexAIRAGBackend

manager = get_file_search_manager(backend='vertex')

# Check backend type when needed
if isinstance(manager, VertexAIRAGBackend):
    file_ids = manager.get_user_file_ids(user_id)
else:
    file_ids = []
```

### 3. Configuration

```python
# Prefer environment variables
manager = get_file_search_manager(backend='gemini')  # Uses GEMINI_API_KEY

# Override when needed
manager = get_file_search_manager(
    backend='gemini',
    api_key=custom_api_key
)
```

### 4. Error Handling

```python
try:
    manager = get_file_search_manager(backend='gemini')
    result = manager.query(...)
except ValueError as e:
    # Configuration error
    logger.error(f"Config error: {e}")
except Exception as e:
    # Runtime error
    logger.error(f"Operation failed: {e}")
```

## Future Libraries

Planned shared libraries:

- **Document Processing** - Common document analysis and extraction
- **Storage Utilities** - GCS operations with retry and error handling
- **Model Clients** - Unified interface for Gemini/Vertex AI models
- **Authentication** - Common auth patterns across services
- **Logging** - Structured logging with consistent formats

## Contributing

When contributing to shared libraries:

1. **Maintain backward compatibility** when possible
2. **Update documentation** for all changes
3. **Add tests** for new functionality
4. **Update examples** to show new features
5. **Consider all backends** when adding features
6. **Review impact** on proxy and agents

## License

Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0

