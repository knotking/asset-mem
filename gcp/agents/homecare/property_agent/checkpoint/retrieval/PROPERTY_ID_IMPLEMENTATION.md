# Property ID Handling Implementation

This document describes how `property_id` is handled for checkpoint queries, implementing both **Option 1** (explicit request parameter) and **Option 2** (retrieved from Firestore session).

## Overview

The checkpoint agent requires `property_id` to query property-specific checkpoints. We've implemented a dual-strategy approach:

1. **Option 1**: `property_id` is passed explicitly in the agent request
2. **Option 2**: If not provided, `property_id` is retrieved from the Firestore session document

## Implementation Details

### Option 1: Explicit Request Parameter

**Schema Updates:**

- Added `property_id` field to `AgentRequest` schema (`gcp/proxy/api/schemas/agent.py`)
- Added `property_id` field to `DocsInput` schema (`gcp/agents/homecare/property_agent/agent_inputs.py`)

**Flow:**

1. Frontend passes `property_id` in the request body
2. API extracts `property_id` from `AgentRequest`
3. `property_id` is included in the payload sent to the agent
4. Agent framework passes `property_id` to tool functions via input schema
5. `before_tool_callback` sets `property_id` in `tool_context.state`

**Frontend Update:**

```typescript
// apps/webapp/src/app/home/properties/[propertyId]/chat/[sessionId]/page.tsx
const requestBody = {
  // ... other fields
  property_id: property?.id, // Pass property_id for checkpoint queries
};
```

### Option 2: Firestore Session Lookup

**Function:**

- `get_property_id_from_session_by_agent_id()` in `gcp/proxy/api/services/vertex_service.py`

**Flow:**

1. If `property_id` is not provided in the request
2. API queries Firestore `users/{user_id}/chats` collection
3. Finds session document where `agentSessionId == session_id`
4. Extracts `propertyId` field from session document
5. Uses this `property_id` if found

**Implementation:**

```python
def get_property_id_from_session_by_agent_id(user_id: str, agent_session_id: str) -> Optional[str]:
    db = firestore.Client()
    chats_ref = db.collection("users").document(user_id).collection("chats")
    query = chats_ref.where("agentSessionId", "==", agent_session_id).limit(1)
    docs = query.stream()

    for doc in docs:
        session_data = doc.to_dict()
        property_id = session_data.get("propertyId") or session_data.get("property_id")
        if property_id:
            return property_id
    return None
```

### Agent-Level Integration

**Tool Context Setup:**

- `before_tool_callback` in `gcp/agents/homecare/property_agent/agent.py` sets `property_id` in `tool_context.state` if available in input

**Checkpoint Agent:**

- `ask_checkpoints_retrieval` function checks `tool_context.state.get("property_id")` if not provided as parameter
- Falls back to parameter if explicitly provided
- Logs warning and returns empty if `property_id` is missing

## Priority

The implementation uses the following priority order:

1. **Explicit parameter** - If `property_id` is passed as a tool function parameter, use it
2. **Tool context state** - If set by `before_tool_callback` from input schema, use it
3. **Session lookup** - If not in request, try to retrieve from Firestore session (Option 2)

## Benefits

- **Flexibility**: Works with both explicit passing and automatic retrieval
- **Backward Compatibility**: Existing code without `property_id` can still work if session has `propertyId`
- **Performance**: Explicit parameter avoids Firestore query
- **Reliability**: Multiple fallback options ensure `property_id` is available when possible

## Future Enhancements

- Consider caching session document lookups to reduce Firestore queries
- Add `property_id` to other agent input schemas if needed
- Consider adding `property_id` to session metadata in Vertex AI Reasoning Engine
