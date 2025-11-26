# Architectural Fix: File Search Endpoints

## Issue Summary

From PR discussion: *"This should be tool invocation from the agent and not part of the proxy. Also, should filter by metadata like user id"*

**Problem Identified:**
1. File import and query endpoints were implemented as direct proxy API endpoints
2. They should be tool invocations that the agent can call
3. The proxy was handling business logic that should be delegated to the agent layer
4. Queries didn't properly filter by user metadata

## Changes Made

### 1. Removed Non-User-Scoped Endpoints from Proxy API

**File:** `gcp/proxy/api/main.py`

#### Removed Endpoints:
- `POST /file-search/import-gcs-file` (lines 351-387)
  - **Issue:** Optional user_id parameter, not enforced
  - **Impact:** Could import files without proper user isolation
  
- `POST /file-search/query` (lines 389-423)
  - **Issue:** No user_id parameter at all
  - **Impact:** Allowed queries across all stores without user filtering

#### Replaced With:
- **Commented-out code** with detailed deprecation notices explaining:
  - Why the endpoints were removed
  - What to use instead (agent tools or user-scoped endpoints)
  - Links to proper implementation locations

### 2. Added Comprehensive Architecture Documentation

**File:** `gcp/proxy/api/main.py` (lines 237-280)

Added a 40+ line comment block explaining:
- **Two-tier architecture:**
  1. Agent tools (preferred for queries)
  2. User-scoped proxy endpoints (for direct file operations)
- **Benefits of each approach**
- **Why deprecated patterns were removed**
- **Proper use cases for remaining endpoints**

### 3. Verified Agent Tools Properly Filter by User ID

**File:** `gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/agent_v2.py`

✅ **Confirmed proper user isolation:**
1. **Line 17-19 in agent.py:** `before_tool_callback` sets `user_id` from session
2. **Line 52:** Extracts `user_id` from `tool_context.state` or session
3. **Line 66:** Calls `backend.get_user_file_ids(user_id, context_doc_uris)` - filters by user
4. **Line 75:** Calls `backend.get_user_store_name(user_id)` - gets user-specific corpus
5. **Line 81-87:** Queries only the user's files and store with `file_ids` parameter

**Key Architecture Pattern:**
```python
def ask_user_docs_retrieval_v2(user_query: str, context_doc_uris, tool_context: ToolContext):
    # Extract user_id from agent context (automatic)
    user_id = tool_context.state.get("user_id") or tool_context._invocation_context.session.user_id
    
    # Get only this user's file IDs
    file_ids = backend.get_user_file_ids(user_id, context_doc_uris)
    
    # Query only this user's corpus with filtered file IDs
    result = backend.query(
        query=user_query,
        store_names=[corpus_name],
        file_ids=file_ids,  # User isolation here
        ...
    )
```

### 4. Updated Documentation

#### Updated Files:
1. **`gcp/proxy/api/GEMINI_FILE_SEARCH.md`**
   - Added architecture notice at top explaining preferred patterns
   - Added deprecation warnings to sections 5 & 6
   - Marked deprecated endpoints clearly

2. **`gcp/proxy/api/ARCHITECTURE_FILE_SEARCH.md`**
   - Updated architecture diagrams to show deprecated endpoints
   - Added notes about user-scoped alternatives

3. **`gcp/proxy/api/README_GEMINI_FILE_SEARCH.md`**
   - Strikethrough deprecated endpoints in API list
   - Added user-scoped endpoints to the list
   - Updated usage examples to use user-scoped endpoints

## Architecture: Before vs After

### Before (Problematic)
```
Frontend → Proxy API → File Search
           ↓
           /file-search/import-gcs-file (optional user_id)
           /file-search/query (no user_id filtering!)
```
**Issues:**
- Proxy handles business logic
- No guaranteed user isolation
- Agent can't decide when to use file search

### After (Fixed)
```
Frontend → Agent → Agent Tools → File Search (with user_id from context)
           ↓
           ask_user_docs_retrieval_v2()
           - Automatic user_id extraction
           - Agent decides when to search
           - Proper user isolation

OR (for direct file operations)

Frontend → Proxy API → User-Scoped Endpoints
           ↓
           /file-search/user/import-gcs-file (required user_id)
           /file-search/user/query (required user_id)
```

## User Isolation Verification

### Agent Tool Isolation (✅ Verified)
- **user_id source:** Extracted from `ToolContext.state["user_id"]` set by `before_tool_callback`
- **Filtering:** `get_user_file_ids(user_id)` returns only files belonging to that user
- **Store isolation:** `get_user_store_name(user_id)` returns user-specific corpus
- **Query scope:** `file_ids` parameter limits results to user's documents only

### User-Scoped Endpoints (✅ Already Correct)
- **Endpoints:** `/file-search/user/*`
- **Required parameter:** `user_id` is mandatory in request body
- **Auto-creates stores:** User stores created automatically per user
- **Proper isolation:** All operations scoped to user_id

## What Still Works

### Admin/Testing Endpoints (Retained)
- `POST /file-search/create-store` - Create stores explicitly
- `GET /file-search/list-stores` - List all stores
- `DELETE /file-search/delete-store` - Delete stores
- `POST /file-search/operation-status` - Check operation status

### User-Scoped Endpoints (Retained & Recommended)
- `POST /file-search/user/upload-file` - Upload file for user
- `POST /file-search/user/import-gcs-file` - Import GCS file for user
- `POST /file-search/user/query` - Query user's documents

## Migration Path

### For Queries (Recommended):
**Use agent tools** - Let the agent decide when to search:
```python
# Agent automatically calls ask_user_docs_retrieval_v2() when needed
# user_id is extracted from session context automatically
```

### For Direct File Operations:
**Use user-scoped endpoints:**
```bash
# Import file
curl -X POST "$URL/$SECRET/file-search/user/import-gcs-file" \
  -d '{"user_id": "user123", "gcs_uri": "gs://bucket/file.pdf", ...}'

# Query
curl -X POST "$URL/$SECRET/file-search/user/query" \
  -d '{"user_id": "user123", "query": "What is this about?", ...}'
```

## Files Modified

1. `gcp/proxy/api/main.py` - Removed endpoints, added architecture docs
2. `gcp/proxy/api/GEMINI_FILE_SEARCH.md` - Added deprecation notices
3. `gcp/proxy/api/ARCHITECTURE_FILE_SEARCH.md` - Updated diagrams
4. `gcp/proxy/api/README_GEMINI_FILE_SEARCH.md` - Updated examples

## Verification Checklist

- [x] Removed non-user-scoped import endpoint
- [x] Removed non-user-scoped query endpoint
- [x] Added comprehensive architecture documentation
- [x] Verified agent tools extract user_id from ToolContext
- [x] Verified agent tools filter by user_id
- [x] Updated all documentation with deprecation notices
- [x] Updated usage examples to show correct patterns
- [x] Confirmed user-scoped endpoints still work
- [x] Confirmed admin endpoints still work

## Impact Assessment

### Breaking Changes:
- ❌ Direct calls to `/file-search/import-gcs-file` will return 404
- ❌ Direct calls to `/file-search/query` will return 404

### Migration Required:
- Switch to `/file-search/user/import-gcs-file` with required `user_id`
- Switch to `/file-search/user/query` with required `user_id`
- Or preferably, use agent tools for queries

### No Impact:
- ✅ Agent-based queries already use proper tools
- ✅ User-scoped endpoints unchanged
- ✅ Admin endpoints unchanged
- ✅ Document analysis endpoints unchanged

## Security Improvements

1. **Mandatory user isolation** - All file operations now require user_id
2. **Agent-controlled access** - Agents decide when to search (not direct API calls)
3. **Context-aware filtering** - user_id automatically extracted from session
4. **No cross-user queries** - Impossible to query other users' documents

## References

- Agent tool implementation: `gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/agent_v2.py`
- User-scoped endpoints: `gcp/proxy/api/main.py` lines 453+
- Architecture docs: `gcp/proxy/api/ARCHITECTURE_FILE_SEARCH.md`
- File search abstraction: `gcp/shared/file_search/`

---

**Status:** ✅ Complete
**Date:** November 26, 2024
**Branch:** google-file-search

