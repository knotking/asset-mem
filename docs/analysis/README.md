# Analysis Agent Documentation

> **Historical:** This folder documents the retired **Analysis / Triage** agent tree (`analysis_agent`, `diagnosis_uris`, multimodal triage at the root). The live system uses **property_agent → doculink_agent** with checkpoint retrieval and optional `checkpoint_optional_agents` (coverage, diy, service, cost). See `gcp/docs/ARCHITECTURE.md`, `gcp/agents/homecare/property_agent/README.md`, and `docs/checkpoint/` for current behavior.

## Overview

The Analysis Agent was a comprehensive AI-powered orchestrator that provided property care solutions including repairs, maintenance, pest control, service recommendations, and product advice. It coordinated specialized sub-agents to deliver diagnostic and solution-finding capabilities. **This architecture is no longer deployed.**

## Documentation Index

### Core Documentation

- **[Analysis Agent Overview](./ANALYSIS_AGENT_OVERVIEW.md)** - Complete feature overview and architecture
- **[Analysis Agent Sub-Agents](./ANALYSIS_AGENT_SUB_AGENTS.md)** - Detailed sub-agent documentation
- **[Analysis Agent Workflow](./ANALYSIS_AGENT_WORKFLOW.md)** - Step-by-step workflow guide
- **[Analysis Agent Testing](./ANALYSIS_AGENT_TESTING.md)** - Testing strategies and examples
- **[Analysis Agent Deployment](./ANALYSIS_AGENT_DEPLOYMENT.md)** - Deployment procedures
- **[Analysis Agent API Integration](./ANALYSIS_AGENT_API_INTEGRATION.md)** - API integration guide

### Related Features

- **[Checkpoint AI Chat Analysis](../checkpoint/CHECKPOINT_AI_CHAT_ANALYSIS.md)** - Similar analysis capabilities for checkpoint data

## Quick Start

### For Users

1. **Diagnose Issues**: Upload photo/video or describe the problem
2. **Get Solutions**: Receive DIY guides, service providers, and cost estimates
3. **Select Options**: Choose which analysis aspects you want (coverage, DIY, service, cost)

### For Developers

1. **Backend**: See `gcp/agents/homecare/property_agent/sub_agents/analysis_agent/`
2. **API**: Use `/api/agent/sse` endpoint with `primary_agent: "analysis"`
3. **Frontend**: Integrate with chat interface using analysis agent selection

## Architecture

```
Analysis Agent (Orchestrator)
├── Triage Agent (Problem Identification)
│   └── analyse_multimodal_data (tool)
│
├── Coverage Agent (Warranty/Insurance)
│   └── ask_user_docs_retrieval (tool)
│
├── DIY Agent (Self-Repair Guidance)
│   ├── google_search_agent (tool)
│   ├── youtube_search (tool)
│   └── shopping_agent (tool)
│
├── Service Agent (Professional Options)
│   ├── serpapi_search (tool)
│   ├── serpapi_search (tool)
│   └── google_search_agent (tool)
│
└── Cost Agent (Cost Analysis)
    ├── cost_estimation (tool)
    └── cost_estimation_diy (tool)
```

## Key Features

### Multimodal Analysis
- Analyze images, videos, and documents
- Extract problem details from visual content
- Support multiple file formats

### Text-Only Triage
- Intelligent diagnosis from text descriptions
- Clarification questions when needed
- Iterative refinement through conversation

### Comprehensive Coverage Check
- Search warranty documents
- Review insurance policies
- Provide relevant coverage information

### DIY Guidance
- Step-by-step repair instructions
- Curated YouTube video tutorials
- Product recommendations with pricing

### Professional Service Options
- Local service provider listings
- Multiple data sources (SerpAPI, SerpAPI)
- Ratings, reviews, and contact information
- Distance-based sorting

### Cost Analysis
- DIY vs Professional cost comparisons
- Detailed breakdowns
- Savings calculations
- Complexity assessments

## Optional Agent Selection

Users can customize their analysis by selecting specific agents:

| Agent | Purpose | Output |
|-------|---------|--------|
| Coverage | Check warranty/insurance | Coverage information |
| DIY | Self-repair guidance | Steps, videos, products |
| Service | Find professionals | Local provider listings |
| Cost | Cost comparison | DIY vs professional estimates |

**Default**: All agents run when not specified  
**Execution Order**: Coverage → DIY → Service → Cost

## Response Format

### Dual Format Structure

All responses include both Markdown and JSON:

**Markdown**: Human-readable, suitable for messaging platforms  
**JSON**: Structured data for programmatic consumption

### Example Response

```json
{
  "analysis": {
    "title": "Kitchen Faucet Leak Repair",
    "triageResult": {
      "diagnosis": "Leaking kitchen faucet with water damage under sink"
    },
    "coverageResult": { /* warranty/insurance info */ },
    "diyResults": { /* steps, videos, products */ },
    "serviceResults": { /* local plumbers */ },
    "costEstimationResults": { /* cost comparison */ }
  }
}
```

## Use Cases

### 1. Immediate Problem Diagnosis
- Upload photo of issue
- Get instant diagnosis
- Receive comprehensive solutions

### 2. Repair Guidance
- DIY instructions with videos
- Product recommendations
- Cost-effective solutions

### 3. Professional Service Finding
- Local provider search
- Ratings and reviews
- Contact information

### 4. Cost Planning
- Compare repair options
- Budget estimation
- Savings calculation

## Integration Points

### Chat Interface
- Primary agent selection
- Optional agent toggles
- File attachment support
- Real-time streaming responses

### Backend Services
- Vertex AI Agent Engine
- Vertex AI RAG (document retrieval)
- External APIs (SerpAPI, SerpAPI, YouTube)
- Google Maps API (geocoding)

### Client Applications
- Webapp (Next.js)
- Mobile App (React Native)
- Telegram Bot

## Performance Metrics

- **Triage Time**: 2-5 seconds (text), 5-10 seconds (multimodal)
- **Full Analysis**: 15-30 seconds
- **Parallel Execution**: DIY and Service agents can run simultaneously
- **Scalability**: Horizontal scaling via Cloud Run

## Best Practices

### For Users
1. Provide clear problem descriptions
2. Include photos/videos when possible
3. Select only needed optional agents
4. Review all recommendations carefully

### For Developers
1. Handle partial results gracefully
2. Implement proper error handling
3. Cache results when appropriate
4. Use streaming for better UX
5. Respect rate limits

## Error Handling

### Common Scenarios

**Clarification Needed**
- Triage agent asks questions
- Return only clarification, no recommendations
- Wait for user response

**Media Analysis Failed**
- Return error message
- Suggest text-only description
- Offer retry option

**No Service Providers Found**
- Expand search radius
- Use Google Search fallback
- Provide DIY alternative

**API Failures**
- Graceful degradation
- Partial results
- Clear error messages

## Testing

### Test Scenarios
1. Text-only queries
2. Image/video uploads
3. Clarification flow
4. Optional agent combinations
5. Error conditions
6. Performance benchmarks

See [Analysis Agent Testing](./ANALYSIS_AGENT_TESTING.md) for details.

## Related Features

### Checkpoint Analysis Agent

The analysis agent's capabilities have been extended to checkpoint data:
- Analyze property condition over time
- Get recommendations for detected issues
- Track maintenance trends
- Compare checkpoint states

See [Checkpoint AI Chat Analysis](../checkpoint/CHECKPOINT_AI_CHAT_ANALYSIS.md) for details.

## Support

- **Documentation**: `/docs/analysis/`
- **Issues**: GitHub Issues
- **Architecture**: [Architecture Diagram](../ARCHITECTURE_DIAGRAM.md)
- **API Reference**: See individual sub-agent documentation

## Changelog

### January 2026
- Extended analysis capabilities to checkpoint data
- Added checkpoint analysis agent
- Improved optional agent selection

### December 2025
- Initial release
- Multimodal analysis support
- Optional agent selection
- Dual format responses
