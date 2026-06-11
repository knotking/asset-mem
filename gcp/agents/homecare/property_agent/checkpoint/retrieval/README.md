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

1. **By ID** (when UI `checkpoint_ids` are provided): direct Firestore document fetches. `before_tool` forces tool args to match session UI ids only — the executor cannot pass slug names like `garage`.
2. **Inventory list** (when the query asks to list checkpoints or report live status): `order_by(createdAt desc)` with a cap of 20; disclosure notes when truncated (e.g. “20 most recent of 127”)
3. **Vector search** (semantic queries with no UI chips, or after by-id miss): query embedding via text-embedding-004, then Firestore `findNearest` (top 5)
4. **Result Formatting**: Retrieved checkpoints are formatted with summaries, status, detected items, conditions, and issues

## Firestore Index Requirements

Indexes on the `checkpoints` collection (see `apps/webapp/firestore.indexes.json`):

- **Inventory list**: `createdAt` (DESC) — single-field; optional `location` + `createdAt` composite when location filter is set
- **Vector search**: `embedding` only (768-dim flat), or `location` + `createdAt` + `embedding` when location filter is set

Embeddings must be stored as Firestore **`Vector`** values (not plain arrays). The checkpoint analysis worker writes `Vector(...)` on new runs. For checkpoints analyzed before that fix, run:

```bash
GCP_PROJECT_ID=homegeek-staging python gcp/proxy/workers/function/checkpoint_analysis/migrate_checkpoint_embeddings.py --dry-run
GCP_PROJECT_ID=homegeek-staging python gcp/proxy/workers/function/checkpoint_analysis/migrate_checkpoint_embeddings.py
```

Optional scope: `--user-id UID --property-id PID`. Requires Application Default Credentials.

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

Structured UI data is assembled into **`contentJson`** on the Firestore chat message. Prose lives in **`contentMarkdown`**. See [`property_agent/ARCHITECTURE.md`](../../../property_agent/ARCHITECTURE.md).
