# Analysis Agent Documentation

## Overview

The Analysis Agent is a comprehensive multimodal analysis system that provides end-to-end diagnostic workflows for home care and vehicle issues. It analyzes uploaded media, conducts research, finds service providers, recommends products, and provides cost estimates.

## Architecture

The Analysis Agent orchestrates multiple specialized sub-agents to provide comprehensive diagnostic services:

```
Analysis Agent
├── Core Analysis Tool
│   └── analyse_multimodal_data
├── Research Agent
│   ├── google_search_agent
│   ├── ask_user_docs_retreival
│   └── youtube_search
├── Service Provider Agent
│   ├── serpapi_search
│   └── yelpapi_search
├── Product Recommendations Agent
│   └── product_recommendations
└── Cost Estimation Agent
    └── cost_estimation
```

## Sub-Agents

### 1. Research Agent

**Purpose**: Gathers comprehensive information from multiple sources based on analysis results.

**Tools**:
- `google_search_agent`: Internet search for general information
- `ask_user_docs_retreival`: Retrieves warranty and insurance information from user documents
- `youtube_search`: Finds relevant video tutorials

**Output**: JSON with summary of findings, user documents, Google search results, and YouTube videos.

### 2. Service Provider Agent

**Purpose**: Finds local service providers and authorized service centers.

**Tools**:
- `serpapi_search`: Searches for local business listings
- `yelpapi_search`: Searches Yelp for service providers with reviews and ratings

**Output**: JSON with SerpAPI and Yelp results including contact info, locations, specialties, reviews, and ratings.

### 3. Product Recommendations Agent

**Purpose**: Finds relevant products for both DIY repair and professional service scenarios.

**Tools**:
- `product_recommendations`: Searches Google Shopping via SerpAPI for products across multiple retailers with targeted recommendations

**Features**:
- **Dual Scenario Support**: Provides products for both DIY and professional service scenarios
- **Targeted Retailer Selection**: Recommends appropriate retailers based on problem type
  - Home repairs: Home Depot, Lowe's, Ace Hardware
  - Automotive: AutoZone, Advance Auto, Costco (for tires)
  - General: Amazon, Harbor Freight
- **Smart Product Prioritization**: ★ indicates products from recommended retailers
- **Comprehensive Product Info**: Names, prices, ratings, reviews, image URLs, and purchase links
- **Shopping Guidance**: Tips for comparing prices, return policies, and buying extra supplies

**Output**: JSON with recommended products organized by DIY vs Service scenarios, retailer recommendations, and shopping tips.

### 4. Cost Estimation Agent

**Purpose**: Provides high-level cost estimates for both DIY and professional service options.

**Tools**:
- `cost_estimation`: Calculates cost estimates based on repair categories

**Cost Categories Covered**:
- **Automotive**: Scratch repair ($20-50 DIY, $200-500 pro), dent repair ($30-80 DIY, $150-400 pro), brake service ($100-300 DIY, $300-600 pro)
- **Home Repairs**: Plumbing ($50-150 DIY, $150-400 pro), electrical ($30-100 DIY, $150-300 pro), drywall ($20-50 DIY, $200-400 pro)
- **Appliances**: General appliance repair ($50-200 DIY, $200-500 pro), specific appliances (refrigerator, washer, dryer)
- **HVAC**: Furnace repair ($100-400 DIY, $400-1000 pro), AC repair ($100-300 DIY, $300-800 pro)

**Output**: JSON with DIY estimates, professional estimates, cost comparison, and recommendations.

## Workflow

### 1. Multimodal Analysis
- Analyzes uploaded images, videos, or documents using Gemini 2.5 Flash
- Extracts key information about the problem or issue
- Returns comprehensive analysis summary

### 2. Conditional Research
- If analysis indicates a problem (not a formal document), calls research agent
- Skips research for formal documents (insurance policies, manuals, warranties)
- Research agent runs all tools in parallel for comprehensive information gathering

### 3. Parallel Service Execution
- Runs service provider, product recommendations, and cost estimation agents simultaneously
- Each agent receives the analysis result as input
- Service provider agent also receives property address if available

### 4. Response Assembly
- Combines all results into structured JSON response
- Includes analysis result, research results, service provider results, product recommendations, and cost estimates

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
  "analysisResult": "string",
  "researchResults": {},
  "serviceProviderResults": {},
  "productRecommendationsResults": {},
  "costEstimationResults": {}
}
```

## Key Features

### Multimodal Analysis
- Supports images, videos, and documents
- Uses Gemini 2.5 Flash for analysis
- Extracts problem descriptions, model numbers, and brand information
- Handles various file formats via GCS URLs

### Comprehensive Research
- Parallel execution of multiple research tools
- Combines internet search, user documents, and video tutorials
- Provides structured summaries with citations

### Service Provider Discovery
- Searches multiple platforms (SerpAPI, Yelp)
- Includes contact information, locations, and reviews
- Identifies authorized vs. non-authorized service centers

### Product Recommendations
- Multi-retailer search (Amazon, Home Depot, Lowe's, Walmart)
- Real-time pricing and availability
- Direct purchase links

### Cost Estimation
- Predefined cost categories for common repairs
- DIY vs. professional cost comparison
- High-level recommendations based on complexity

## Error Handling

- Graceful handling of API failures
- Fallback responses when no results found
- Clear error messages for unsupported content types
- Robust handling of missing or invalid data

## Performance Considerations

- Parallel execution of sub-agents for faster response times
- Efficient API usage with rate limiting considerations
- Caching of common repair cost estimates
- Optimized multimodal analysis with appropriate model selection

## Future Enhancements

- Machine learning-based cost estimation improvements
- Integration with additional retailer APIs
- Enhanced service provider filtering and ranking
- Real-time pricing updates
- User preference learning for recommendations
