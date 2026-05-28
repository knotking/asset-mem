# Checkpoint retrieval

This module performs semantic checkpoint search using Firestore Vector Search. It is invoked as **step 1** of `run_checkpoint_pipeline`, not as a separate root orchestrator hop.

## What it does

- Performs semantic search on checkpoint analysis data using Firestore Vector Search
- Generates query embeddings using Gemini Embeddings API (text-embedding-004)
- Retrieves relevant checkpoints based on vector similarity
- Supports location filtering for more targeted results
- Returns formatted checkpoint summaries with analysis data

## Where it lives

- Retrieval logic: `checkpoint/retrieval/` (see `firestore_vector_search.py`, prompts as applicable)
- Pipeline entry: `checkpoint/pipeline.py` → `run_checkpoint_pipeline`

## Configuration

Requires the following environment variables:

- `GCP_PROJECT_ID`: GCP project ID for Vertex AI
- `GCP_LOCATION`: GCP region (default: us-central1)

Authentication: Uses Application Default Credentials (ADC) for Firestore and Vertex AI.

## How it works

1. **Query Embedding Generation**: User's natural language query is converted to a 768-dimensional vector using text-embedding-004
2. **Vector Search**: Firestore `findNearest` API performs KNN search on checkpoint embeddings
3. **Filtering**: Optional location filter narrows results to specific assets/locations
4. **Result Formatting**: Retrieved checkpoints are formatted with summaries, detected items, conditions, and issues

## Firestore Index Requirements

Requires a composite index on the `checkpoints` collection:

- Fields: `location` (ASC), `createdAt` (DESC), `embedding` (vector, 768 dimensions)
- The vector field (`embedding`) must be the last field in the index

## Tool Function

### `ask_checkpoints_retrieval`

**Parameters:**

- `user_query` (str): Natural language query about checkpoints
- `property_id` (str): **REQUIRED** - Property ID for property-specific checkpoint queries
- `location` (Optional[str]): Location/asset filter (e.g., "Kitchen", "Car")
- `checkpoint_ids` (Optional[List[str]]): List of specific checkpoint IDs to retrieve (when provided, only these checkpoints are fetched)
- `tool_context` (ToolContext): Agent tool context with user_id

**Returns:**

- List of checkpoint dictionaries with:
  - `checkpointId`: Checkpoint document ID
  - `text`: Formatted summary text for agent consumption
  - `location`: Location/asset name
  - `createdAt`: Creation timestamp
  - `summary`: AI analysis summary
  - `detectedItems`: List of detected items
  - `conditions`: List of conditions
  - `issues`: List of issues (limited to 5)
  - `similarity_score`: Vector similarity score (0.0-1.0)

**Example Usage:**

```python
# Query: "Show me checkpoints with water damage"
checkpoints = ask_checkpoints_retrieval(
    user_query="Show me checkpoints with water damage",
    property_id="property123",
    tool_context=tool_context,
)

# Returns list of checkpoints matching the query semantically
```

## Integration

Retrieval is called from **`run_checkpoint_pipeline`** when the orchestrator starts new checkpoint work. Resolve output (`route=checkpoint`, `checkpoint_ids`, optional branches) supplies context; there is no separate `checkpoint_agent` AgentTool hop at the root.

When `checkpoint_optional_agents` is non-empty, the pipeline continues to parallel analysis, assembler, and synthesis — emitting `contentJson` / `contentMarkdown` via `state_delta`, not dual-format wire strings.

## Response format (V2)

Structured UI data is assembled into **`contentJson`** on the Firestore chat message. Prose lives in **`contentMarkdown`**. See [`docs/ORCHESTRATOR_V2_PLAN.md`](../../../docs/ORCHESTRATOR_V2_PLAN.md).
