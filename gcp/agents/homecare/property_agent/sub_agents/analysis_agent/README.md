# Analysis Agent Documentation

## Overview

The Analysis Agent orchestrates a comprehensive workflow for property-related needs. It handles repairs, maintenance, pest control, service recommendations, and product requests. It can analyze uploaded media when available, or perform text‑only triage from the user's query when no media is provided. After triage, it checks coverage in user documents, provides DIY guidance with products and videos, and offers professional service provider options.

## Scope

The Property Agent addresses a wide range of property-related queries:
- **Repairs and Maintenance**: Plumbing, electrical, HVAC, appliances, vehicle issues, structural problems
- **Pest Control**: Insect infestations, rodent problems, wildlife issues, pest prevention and treatment recommendations
- **Service Recommendations**: Finding and recommending local service providers, contractors, professionals
- **Product Requests**: Product recommendations, shopping queries, purchase advice for property-related items
- **General Property Care**: Home improvement, maintenance tips, property management, preventive care

## Architecture

The Analysis Agent coordinates multiple specialized sub-agents, each defined in their own modules:

```
Analysis Agent (orchestrator)
├── Triage Agent (in analysis_agent module)
│   └── analyse_multimodal_data
├── Coverage Agent (separate module)
│   └── ask_user_docs_retreival
├── DIY Agent (separate module)
│   ├── google_search_agent
│   ├── youtube_search
│   ├── shopping_agent (as tool)
│   └── cost_estimation_diy
├── Service Agent (separate module)
│   ├── serpapi_search
│   ├── yelpapi_search
│   ├── google_search_agent
│   └── cost_estimation
├── Shopping Agent (separate module, reusable)
│   └── product_recommendations
└── Cost Agent (separate module)
    └── cost_estimation / cost_estimation_diy
```

## Sub-Agents

### 1. Triage Agent

- **Purpose**: Produce a clear diagnosis or need description either by analyzing multimodal data (images, documents, videos) when provided, or by deriving a concise diagnosis from text when no media is available. Handles repairs, maintenance, pest control, service requests, and product queries. When text-only triage is unclear, asks targeted clarification questions until a clear diagnosis can be determined.
- **Tool (when media provided)**: `analyse_multimodal_data(user_query, gcs_url)`
  - **Enhanced Capability**: If the media is an image, uses **Gemini Robotics** for object detection to locate and annotate the issue described in the `user_query`.
  - **Annotation**: Draws bounding boxes around detected objects on the image and returns an `annotated_media_uri` pointing to the modified image in GCS.
- **Output**: 
  - JSON containing a diagnosis text when the issue is clear, optionally including `annotated_media_uri`.
  - JSON with `needs_clarification: true` and `clarification_questions` array when more information is needed
  - Used by subsequent agents only after a clear diagnosis is obtained
- **Behavior**:
  - **With media**: Analyzes the media and returns diagnosis + optional annotated image
  - **Text-only (clear)**: Returns diagnosis from user_query
  - **Text-only (unclear)**: Asks 1-3 targeted clarification questions
  - **Iterative**: Continues asking questions until a clear, actionable diagnosis is obtained

### 2. Coverage Agent (separate module: `coverage_agent`)

- **Purpose**: Retrieve warranty and insurance coverage information from user-uploaded documents.
- **Tool**: `ask_user_docs_retreival`
- **Output**: JSON with warranty and insurance information relevant to the issue.
- **Location**: `sub_agents/coverage_agent/`

### 3. DIY Agent (separate module: `diy_agent`)

- **Purpose**: Provide DIY repair recommendations including internet research, video tutorials, and DIY product suggestions.
- **Tools**:
  - `google_search_agent`: Internet research for DIY steps
  - `youtube_search`: Relevant DIY video tutorials
  - `shopping_agent`: Product recommendations (uses "DIY" category)
  - `cost_estimation_diy`: DIY cost estimates
- **Output**: JSON with DIY steps, YouTube videos, and recommended products.
- **Location**: `sub_agents/diy_agent/`

### 4. Service Agent (separate module: `service_agent`)

- **Purpose**: Provide professional service provider options near the user.
- **Tools**:
  - `serpapi_search`: Local service/business listings
  - `yelpapi_search`: Yelp listings with reviews and ratings
  - `google_search_agent` (fallback): General web search to extract providers when others return none
  - `cost_estimation`: Professional service cost estimates
- **Output**: JSON with local professional listings. Primary sources: SerpAPI and Yelp; fallback: `localPros.googleSearchResults`.
- **Location**: `sub_agents/service_agent/`

### 5. Shopping Agent (separate module: `shopping_agent`)

- **Purpose**: Provide product recommendations for repairs. Reusable across different contexts (DIY, Professional, etc.).
- **Tool**: `product_recommendations(query, category)`: Searches for products based on query and category
- **Output**: JSON with product recommendations containing:
  - `item_name`: Product/item name
  - `image_url`: Product image URL
  - `vendor`: Vendor/manufacturer/store name
  - `reviews`: Number of reviews
  - `store_url`: URL to product/store page
- **Location**: `sub_agents/shopping_agent/`
- **Usage**: Used by DIY Agent with "DIY" category. Can be used by other agents for different categories.

### 6. Cost Agent (separate module: `cost_agent`)

- **Purpose**: Provide structured DIY vs Service cost estimates.
- **Tools**:
  - `cost_estimation`: High-level DIY vs professional cost ranges
  - `cost_estimation_diy`: DIY-only cost guidance
- **Output**: JSON under `costEstimationResults.costEstimates`.
- **Context Requirement**: Always read the triage diagnosis and tailor cost ranges to that specific problem before returning a response.
- **Location**: `sub_agents/cost_agent/`

## Workflow

1. Triage (mandatory first step)
   - If media is provided, analyze the first URI to produce a domain-specific diagnosis.
   - If no media is provided, perform text-only triage from `user_query` (and `property_address` if present):
     * **Clear query**: Produce a concise diagnosis from the user_query
     * **Unclear query**: Ask 1-3 targeted clarification questions and wait for user response
     * **Iterative**: Continue asking questions until a clear, actionable diagnosis is obtained
- If triage returns `needs_clarification: true`, return ONLY the clarification questions and stop (wait for user response). Do **not** provide service recommendations, DIY content, coverage summaries, or cost estimates until the user responds with more details.
   - If triage fails or diagnosis is invalid/empty, return ONLY the triage result and stop.
   - Only proceed to steps 2-5 when triage returns a valid, actionable diagnosis.
2. Optional Agents (Coverage, DIY, Service, Cost)
   - Consult `analysis_optional_agents` to determine which optional sections to produce (default order: coverage → DIY → service → cost).
   - Coverage: Retrieve warranty/insurance information from user docs.
   - DIY: Use the triage diagnosis to tailor Google search, YouTube search, and DIY product recommendations.
   - Service: Use the triage diagnosis to find local pros via SerpAPI and Yelp (within 50 miles, top 10). If none are found, perform a Google search and return parsed providers under `localPros.googleSearchResults`.
   - Cost: Use the triage diagnosis to generate DIY vs service cost estimates via the cost agent.
3. Response Assembly
   - Combine all results into one nested JSON object.

## Input Schema

```json
{
  "user_query": "string",  // REQUIRED - minimum required field
  "diagnosis_uris": ["string"],  // Optional - may be omitted, null, or empty
  "context_doc_uris": ["string"],  // Optional - may be omitted, null, or empty
  "property_address": "string",  // Optional - may be omitted, null, or empty
  "analysis_optional_agents": ["coverage", "diy", "service", "cost"]  // Optional - defaults to all when omitted or empty
}
```

**Important Notes:**
- `user_query` is the **only required field**. The triage agent can work with just this field.
- `diagnosis_uris` may be omitted, null, or empty; in that case, triage runs in text‑only mode.
- `analysis_optional_agents` limits which optional sub-agents run after triage. Allowed values are `coverage`, `diy`, `service`, and `cost`. If the list is missing, null, empty, or invalid, all optional agents run in the canonical order.
- All other fields are optional and the agent will gracefully handle their absence.
- The triage agent will **never fail** due to missing optional fields - it will always work with `user_query` as the minimum.

## Output Schema

The Analysis Agent **MUST** return responses in a dual format that includes both Markdown and JSON:

### Response Format

```
# {analysis.title goes here}

```json
{
  "analysis": {
    "title": "string",
    "triageResult": {
      "diagnosis": "string",
      "annotated_media_uri": "string", // Optional: URI of image with detected objects annotated
      "needs_clarification": false
    },
    // OR when clarification is needed:
    "triageResult": {
      "needs_clarification": true,
      "clarification_questions": ["question 1", "question 2", "question 3"],
      "message": "optional friendly message"
    },
    "coverageResult": {
      "warrantyInfo": "string",
      "insuranceInfo": "string"
    },
    "diyResults": {
      "diySteps": {
        "summary": "string",
        "steps": [
          { "stepNumber": 1, "description": "string" }
        ]
      },
      "youtubeSearch": {
        "videos": [
          { "title": "string", "url": "string", "description": "string" }
        ]
      },
      "recommendedProducts": {
        "products": [
          {
            "item_name": "string",
            "image_url": "string",
            "vendor": "string",
            "reviews": "string",
            "store_url": "string"
          }
        ]
      }
    },
    "serviceResults": {
      "localPros": {
        "serpAPIResults": "object",
        "yelpAPIResults": "object"
      }
    },
    "costEstimationResults": {
      "costEstimates": {
        "repair_type": "string",
        "DIY": { "cost_range": "string", "includes": ["string"], "savings": "string", "complexity": "string" },
        "Service": { "cost_range": "string", "includes": ["string"], "benefits": "string", "complexity": "string" },
        "comparison": { "diy_savings": "string", "professional_benefits": "string", "considerations": "string" }
      }
    }
  }
}
```
```

### Format Requirements

1. **Markdown Text** (FIRST):
   - Must appear before the JSON code block
   - Must begin with `# {analysis.title}` as the first line
   - Should summarize the outcome using the triage diagnosis (or clarification message) as the anchor
   - Should include sections, bullet points, links, and formatting suitable for Telegram
   - Used by Telegram API for display in Telegram messages

2. **JSON Code Block** (SECOND):
   - Must be wrapped in a markdown code block with language tag `json`
   - Must include the `analysis.title` field mirroring the Markdown heading and derived from the triage diagnosis
   - Contains the structured data matching the schema above
   - Used by webapp (`chat-message.tsx`) for structured parsing and UI rendering

### Client Consumption

- **Telegram API**: Extracts the Markdown text (from before the JSON block) for display in Telegram messages (see `telegram_api.py`)
- **Webapp (chat-message.tsx)**: Extracts and parses the JSON from the code block for structured UI rendering

This dual format ensures:
- Structured data is available for programmatic consumption (webapp)
- Human-readable content is available for messaging platforms (Telegram)

## Key Features

- **Comprehensive scope**: Handles repairs, maintenance, pest control, service recommendations, and product requests
- **Multimodal analysis**: Images, videos, and documents via Gemini 2.5 Flash
- **Visual Grounding**: Object detection and image annotation using **Gemini Robotics** for visual confirmation of issues
- **Coverage retrieval**: Warranty and insurance details from user documents
- **DIY guidance**: Steps, videos, and DIY product recommendations
- **Service options**: Cost estimates and local pros from multiple sources (plumbers, electricians, pest control, contractors, etc.)
- **Product recommendations**: Shopping agent provides product suggestions for property-related needs
- **Pest control support**: Specialized handling for pest control queries with appropriate service providers
- **Parallelism**: DIY and Service sub-steps leverage multiple tools

## Error Handling

- Guard clause: If triage cannot provide a valid diagnosis, return triage-only JSON
- Graceful handling for API failures and empty tool results
- Clear messages for unsupported content types or missing data

## Performance Considerations

- Parallel execution of research/lookups within DIY and Service
- Efficient API usage with rate-limiting considerations


## Module Structure

The Analysis Agent orchestrates sub-agents that are now organized as separate modules:

- **`analysis_agent/`**: Contains the orchestrator and triage agent
- **`coverage_agent/`**: Standalone module for coverage retrieval
- **`diy_agent/`**: Standalone module for DIY recommendations
- **`service_agent/`**: Standalone module for service provider discovery
- **`shopping_agent/`**: Standalone reusable module for product recommendations
- **`cost_agent/`**: Standalone module for cost estimation

Each module follows a consistent structure:
- `agent.py`: Agent definition and tools
- `prompts.py`: Agent instructions
- `__init__.py`: Module exports

## Notes

- Sub-agents are imported and used as tools by the analysis agent orchestrator.
- The triage diagnosis should be used to tailor both DIY and Service queries for higher relevance.
- Shopping agent provides generic product recommendations; calling agents (like DIY agent) provide specific instructions about category and context.
