# Analysis Agent Documentation

## Overview

The Analysis Agent orchestrates a diagnostic workflow for home care and vehicle issues. It can analyze uploaded media when available, or perform text‑only triage from the user’s query when no media is provided. After triage, it checks coverage in user documents, provides DIY guidance with products and videos, and offers professional service provider options.

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

- **Purpose**: Produce a clear diagnosis either by analyzing multimodal data (images, documents, videos) when provided, or by deriving a concise diagnosis from text when no media is available.
- **Tool (when media provided)**: `analyse_multimodal_data(user_query, gcs_url)`
- **Output**: JSON containing a diagnosis text used by subsequent agents.

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
- **Location**: `sub_agents/cost_agent/`

## Workflow

1. Triage (mandatory first step)
   - If media is provided, analyze the first URI to produce a domain-specific diagnosis.
   - If no media is provided, perform text-only triage from `user_query` (and `property_address` if present) to produce a concise diagnosis.
   - If triage fails or diagnosis is invalid/empty, return ONLY the triage result and stop.
2. Coverage
   - Retrieve warranty/insurance information from user docs.
3. DIY
   - Use the triage diagnosis to tailor Google search, YouTube search, and DIY product recommendations.
4. Service
   - Use the triage diagnosis to find local pros via SerpAPI and Yelp (within 50 miles, top 10). If none are found, perform a Google search and return parsed providers under `localPros.googleSearchResults`.
5. Cost Estimation
   - Use the triage diagnosis to generate cost estimates via Cost Agent.
5. Response Assembly
   - Combine all results into one nested JSON object.

## Input Schema

```json
{
  "user_query": "string",
  "diagnosis_uris": ["string"],
  "context_doc_uris": ["string"],
  "property_address": "string"
}
```
Note: `diagnosis_uris` may be omitted or empty; in that case, triage runs in text‑only mode.

## Output Schema

```json
{
  "analysis": {
    "triageResult": {
      "diagnosis": "string"
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

## Key Features

- **Multimodal analysis**: Images, videos, and documents via Gemini 2.5 Flash
- **Coverage retrieval**: Warranty and insurance details from user documents
- **DIY guidance**: Steps, videos, and DIY product recommendations
- **Service options**: Cost estimates and local pros from multiple sources
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
