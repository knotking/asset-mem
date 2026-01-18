# Analysis Agent Overview

## Introduction

The Analysis Agent is a comprehensive AI-powered orchestrator designed to handle property-related queries including repairs, maintenance, pest control, service recommendations, and product requests. It provides a complete workflow from problem diagnosis to actionable solutions.

**Related Feature**: The [Checkpoint Analysis Agent](../checkpoint/CHECKPOINT_AI_CHAT_ANALYSIS.md) extends similar capabilities to checkpoint data, enabling users to get coverage, DIY, service, and cost recommendations based on issues detected in their property checkpoints.

## Purpose

The Analysis Agent serves as the primary diagnostic and solution-finding system for property care needs. It:

- **Analyzes Problems**: Uses multimodal AI to understand issues from images, videos, documents, or text descriptions
- **Provides Solutions**: Offers DIY guidance, professional service options, and cost estimates
- **Checks Coverage**: Reviews warranty and insurance documents for applicable coverage
- **Recommends Products**: Suggests relevant products for repairs and maintenance
- **Finds Professionals**: Locates local service providers with ratings and reviews

## Scope

The Analysis Agent handles a comprehensive range of property-related queries:

### Repairs and Maintenance
- Plumbing issues (leaks, clogs, pressure problems)
- Electrical problems (outlets, switches, wiring)
- HVAC systems (heating, cooling, ventilation)
- Appliances (kitchen, laundry, household)
- Vehicle issues (minor repairs, maintenance)
- Structural problems (walls, floors, roofs)

### Pest Control
- Insect infestations (ants, termites, bed bugs)
- Rodent problems (mice, rats)
- Wildlife issues (squirrels, raccoons)
- Pest prevention strategies
- Treatment recommendations

### Service Recommendations
- Finding local service providers
- Contractor recommendations
- Professional service comparisons
- Emergency service contacts

### Product Requests
- Product recommendations for repairs
- Shopping guidance for property-related items
- Purchase advice and comparisons
- Tool and material suggestions

### General Property Care
- Home improvement guidance
- Maintenance tips and schedules
- Property management advice
- Preventive care strategies

## Architecture

The Analysis Agent follows a hierarchical orchestration pattern:

```
Root Property Agent (main orchestrator)
└── Analysis Agent (diagnostic orchestrator)
    ├── Triage Agent (problem identification)
    │   └── analyse_multimodal_data (tool)
    ├── Coverage Agent (warranty/insurance)
    │   └── ask_user_docs_retrieval (tool)
    ├── DIY Agent (self-repair guidance)
    │   ├── google_search_agent (tool)
    │   ├── youtube_search (tool)
    │   ├── shopping_agent (tool)
    │   └── cost_estimation_diy (tool)
    ├── Service Agent (professional options)
    │   ├── serpapi_search (tool)
    │   ├── yelpapi_search (tool)
    │   ├── google_search_agent (tool)
    │   └── cost_estimation (tool)
    ├── Shopping Agent (product recommendations)
    │   └── product_recommendations (tool)
    └── Cost Agent (cost analysis)
        ├── cost_estimation (tool)
        └── cost_estimation_diy (tool)
```

## Key Features

### 1. Multimodal Analysis
- Analyzes images, videos, and documents using Gemini 2.5 Flash
- Extracts problem details from visual content
- Supports multiple file formats (JPEG, PNG, PDF, MP4, etc.)

### 2. Text-Only Triage
- Performs intelligent diagnosis from text descriptions
- Asks clarification questions when needed
- Iteratively refines understanding through conversation

### 3. Comprehensive Coverage Check
- Searches user-uploaded warranty documents
- Reviews insurance policies for applicable coverage
- Provides relevant coverage information for the diagnosed issue

### 4. DIY Guidance
- Step-by-step repair instructions from web research
- Curated YouTube video tutorials
- Product recommendations for DIY repairs
- DIY cost estimates

### 5. Professional Service Options
- Local service provider listings (within configurable radius)
- Multiple data sources (SerpAPI, Yelp, Google Search)
- Provider ratings, reviews, and contact information
- Distance-based sorting when coordinates available
- Professional service cost estimates

### 6. Cost Analysis
- Structured DIY vs Professional cost comparisons
- Detailed breakdowns of costs and benefits
- Savings calculations and considerations
- Complexity assessments

### 7. Flexible Agent Selection
- Optional agent selection via `analysis_optional_agents` parameter
- Default: runs all agents (coverage, DIY, service, cost)
- Customizable: select specific agents as needed
- Canonical execution order maintained

## Technology Stack

### AI Models
- **Gemini 2.5 Flash**: Multimodal analysis, agent orchestration
- **Vertex AI RAG**: Document retrieval for coverage information

### External APIs
- **SerpAPI**: Local business search
- **Yelp API**: Service provider listings with reviews
- **YouTube API**: Video tutorial search
- **Google Search API**: General information retrieval
- **Google Maps API**: Location-based services and geocoding

### Infrastructure
- **Google Cloud Platform**: Hosting and compute
- **Cloud Storage**: Media file storage
- **Firestore**: Session and metadata storage
- **Cloud Run**: API deployment
- **Pub/Sub**: Asynchronous processing

## Response Format

The Analysis Agent returns responses in a **dual format** to support multiple client platforms:

### 1. Markdown Format (for Telegram)
Human-readable text with:
- Clear heading with analysis title
- Structured sections
- Bullet points and lists
- Clickable links
- Formatted for messaging platforms

### 2. JSON Format (for Web App)
Structured data with:
- `analysis.title`: Concise summary of the diagnosis
- `triageResult`: Problem diagnosis or clarification questions
- `coverageResult`: Warranty and insurance information
- `diyResults`: DIY steps, videos, and products
- `serviceResults`: Local service provider listings
- `costEstimationResults`: Cost comparisons and estimates

Both formats are included in every response, ensuring compatibility across all client platforms (Telegram bot, web app, mobile app).

## Workflow Overview

1. **Input Reception**: Receives user query with optional media, documents, and location
2. **Triage**: Analyzes the problem using multimodal AI or text-only triage
3. **Clarification** (if needed): Asks targeted questions to understand the issue
4. **Coverage Check**: Searches user documents for applicable warranties/insurance
5. **DIY Research**: Finds repair instructions, videos, and products
6. **Service Search**: Locates local professionals with ratings and contact info
7. **Cost Analysis**: Provides DIY vs professional cost comparisons
8. **Response Assembly**: Combines all results into dual-format response

## Integration Points

### Client Applications
- **Telegram Bot**: Sends text/media, receives Markdown responses
- **Web Application**: Sends structured requests, receives JSON responses
- **Mobile App**: Sends structured requests, receives JSON responses

### Backend Services
- **Proxy API**: FastAPI gateway for all client requests
- **Agent Workers**: Background processing for long-running analyses
- **Firebase Integration**: User authentication and data storage

## Performance Characteristics

- **Triage Time**: 2-5 seconds for text, 5-10 seconds for multimodal
- **Full Analysis**: 15-30 seconds for complete workflow
- **Parallel Execution**: DIY and Service agents run tools in parallel
- **Scalability**: Horizontal scaling via Cloud Run

## Error Handling

- **Graceful Degradation**: Returns partial results if some agents fail
- **Clear Error Messages**: Informative messages for unsupported content
- **Fallback Mechanisms**: Google Search fallback when primary APIs fail
- **Retry Logic**: Automatic retries for transient failures

## Security and Privacy

- **User Isolation**: Each user's documents stored separately
- **Access Control**: RAG corpora scoped to individual users
- **Data Encryption**: All data encrypted in transit and at rest
- **Session Management**: Secure session handling with Firebase Auth

## Related Features

### Checkpoint Analysis Agent (January 2026)

The analysis agent's capabilities have been extended to checkpoint data through the **Checkpoint Analysis Agent**. This allows users to:

- Select checkpoints and get comprehensive analysis of detected issues
- Receive coverage, DIY, service, and cost recommendations
- Analyze property condition trends over time
- Get actionable insights based on checkpoint history

See [Checkpoint AI Chat Analysis](../checkpoint/CHECKPOINT_AI_CHAT_ANALYSIS.md) for details.

## Future Enhancements

- **Multi-language Support**: Expand beyond English
- **Voice Input**: Accept voice descriptions of problems
- **AR Integration**: Augmented reality for guided repairs
- **Predictive Maintenance**: Proactive issue detection based on checkpoint trends
- **Cost Tracking**: Historical cost analysis and trends
- **Contractor Ratings**: User feedback and rating system
- **Parallel Agent Execution**: Run DIY and Service agents simultaneously for faster results

