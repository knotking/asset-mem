# Checkpoint Agent

This sub-agent retrieves checkpoint information using Firestore Vector Search for semantic query matching. It enables natural language queries about checkpoints such as "What changed in my kitchen?" or "Show me checkpoints with water damage".

## What it does

- Performs semantic search on checkpoint analysis data using Firestore Vector Search
- Generates query embeddings using Gemini Embeddings API (text-embedding-004)
- Retrieves relevant checkpoints based on vector similarity
- Supports location filtering for more targeted results
- Returns formatted checkpoint summaries with analysis data

## Where it lives

- Agent definition: `agent.py`
- Vector search utility: `firestore_vector_search.py`
- System instructions: `prompts.py`

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
    tool_context=tool_context
)

# Returns list of checkpoints matching the query semantically
```

## Integration

The checkpoint agent is integrated into the root `property_agent` executor as a tool. The executor selects `checkpoint_agent` when:

- User queries mention checkpoints
- User asks about property condition over time
- User asks about changes or timeline queries
- User asks about specific locations/assets over time

## Response Format

The agent returns responses in **dual format** (Markdown + JSON) to support multiple client platforms:

### 1. Markdown Format (for Telegram and human readability)
Human-readable text with:
- Clear heading with query results title
- Structured sections for each checkpoint
- Detailed findings and comparisons
- Insights and recommendations

### 2. JSON Format (for Web App and Mobile App)
Structured data with:
- `analysis.title`: Concise summary of the query results
- `analysis.checkpointSummary`: Metadata about checkpoints analyzed (count, query type, locations, date range)
- `analysis.checkpointDetails`: Array of checkpoint objects with all relevant information
- `analysis.insights`: Changes, patterns, and recommendations based on query type

### Response Structure

**Simple Query Mode** (no optional agents):
```json
{
  "analysis": {
    "title": "Checkpoint Query Results",
    "checkpointSummary": {
      "checkpointsAnalyzed": 2,
      "queryType": "comparison|single|trend|location-specific",
      "locations": ["Kitchen", "Bathroom"],
      "dateRange": "Jan 2025 - Jan 2026"
    },
    "checkpointDetails": [
      {
        "name": "Monthly Inspection - Jan 2025",
        "location": "Kitchen",
        "date": "2025-01-15",
        "summary": "Brief summary",
        "detectedItems": ["item1", "item2"],
        "conditions": ["condition1"],
        "issues": ["issue1"]
      }
    ],
    "insights": {
      "changes": "Description of changes (for comparison queries)",
      "patterns": "Description of patterns (for trend queries)",
      "recommendations": "Brief recommendations if applicable"
    }
  }
}
```

**Analysis Mode** (with optional agents):
When `checkpoint_optional_agents` is provided, the agent delegates to `checkpoint_analysis_agent` which returns comprehensive analysis with coverage, DIY, service, and/or cost recommendations in dual format.

### Query Types

The agent handles various query types:
- **Single checkpoint queries**: "Show me the latest kitchen checkpoint"
- **Comparison queries**: "What changed in my bathroom between checkpoints?"
- **Trend queries**: "How has my property condition changed over time?"
- **Location-specific queries**: "Show me all exterior checkpoints"

If no checkpoints are found, returns: "No matching checkpoints found for your query. Try rephrasing your question or check if you have any checkpoints created."

## Notes

- Checkpoints must have embeddings generated (done automatically after analysis)
- Vector search works best with semantically similar queries
- Location filtering improves precision for location-specific queries
- Maximum 1000 results per query (Firestore limit)
