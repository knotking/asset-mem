# Analysis Agent Documentation

## Overview

The Analysis Agent orchestrates a multimodal diagnostic workflow for home care and vehicle issues. It analyzes uploaded media, checks coverage in user documents, provides DIY guidance with products and videos, and offers professional service options with cost estimates.

## Architecture

The Analysis Agent coordinates four specialized sub-agents:

```
Analysis Agent
├── Triage Agent
│   └── analyse_multimodal_data
├── Coverage Agent
│   └── ask_user_docs_retreival
├── DIY Agent
│   ├── google_search_agent
│   ├── youtube_search
│   └── product_recommendations_diy
└── Service Agent
    ├── cost_estimation
    ├── serpapi_search
    └── yelpapi_search
```

## Sub-Agents

### 1. Triage Agent

- **Purpose**: Analyze multimodal data (images, documents, videos) and extract the primary problem description.
- **Tool**: `analyse_multimodal_data(user_query, gcs_url)`
- **Output**: JSON containing a complete diagnosis text used by subsequent agents.

### 2. Coverage Agent

- **Purpose**: Retrieve warranty and insurance coverage information from user-uploaded documents.
- **Tool**: `ask_user_docs_retreival`
- **Output**: JSON with warranty and insurance information relevant to the issue.

### 3. DIY Agent

- **Purpose**: Provide DIY repair recommendations including internet research, video tutorials, and DIY product suggestions.
- **Tools**:
  - `google_search_agent`: Internet research for DIY steps
  - `youtube_search`: Relevant DIY video tutorials
  - `product_recommendations_diy`: DIY-focused products across retailers
- **Output**: JSON with DIY steps, YouTube videos, and recommended products.

### 4. Service Agent

- **Purpose**: Provide professional service options including cost estimates and local providers.
- **Tools**:
  - `cost_estimation`: High-level DIY vs professional cost ranges
  - `serpapi_search`: Local service/business listings
  - `yelpapi_search`: Yelp listings with reviews and ratings
- **Output**: JSON with cost estimates and local professional listings (SerpAPI and Yelp).

## Workflow

1. Triage (mandatory first step)
   - Analyze the first media URI to produce a domain-specific diagnosis.
   - If triage fails or diagnosis is invalid/empty, return ONLY the triage result and stop.
2. Coverage
   - Retrieve warranty/insurance information from user docs.
3. DIY
   - Use the triage diagnosis to tailor Google search, YouTube search, and DIY product recommendations.
4. Service
   - Use the triage diagnosis to generate cost estimates and find local pros via SerpAPI and Yelp.
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
          { "vendor": "string", "url": "string", "description": "string", "price": "string" }
        ]
      }
    },
    "serviceResults": {
      "costEstimates": "string or object",
      "localPros": {
        "serpAPIResults": "object",
        "yelpAPIResults": "object"
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
- Reusable cost category mappings for fast responses

## Notes

- Function and tool names match the implementation in `agent.py` (e.g., `ask_user_docs_retreival`, `product_recommendations_diy`).
- The triage diagnosis should be used to tailor both DIY and Service queries for higher relevance.
