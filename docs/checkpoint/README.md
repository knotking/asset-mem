# Checkpoint Documentation

Serving code lives under `gcp/agents/homecare/property_agent/checkpoint/` (`run_checkpoint_pipeline`, retrieval, optional-branch analysis). See [`property_agent/ARCHITECTURE.md`](../../gcp/agents/homecare/property_agent/ARCHITECTURE.md).

## Overview

The Checkpoint feature allows users to capture and track property condition over time through photos and videos, with AI-powered analysis to detect changes, issues, and maintenance needs.

## Documentation Index

### Core Features

- **[Property Reports Plan](../property/PROPERTY_REPORTS_PLAN.md)** - Snapshot/comparison PDF reports from checkpoints; optional Reports chat mode and Docs RAG
- **[Property Agent Architecture](../../gcp/agents/homecare/property_agent/ARCHITECTURE.md)** - Canonical checkpoint chat analysis contract (`contentJson` / `contentMarkdown`)
- **[Checkpoint Feature Plan](./CHECKPOINT_FEATURE_PLAN.md)** - Complete implementation plan and roadmap
- **[Checkpoint Chat Integration](./CHECKPOINT_CHAT_INTEGRATION.md)** - Integration with AI chat interface
- **[Checkpoint Analysis API](./CHECKPOINT_ANALYSIS_API.md)** - API reference for checkpoint analysis

### Implementation Details

- **[Checkpoint Versioning Design](./CHECKPOINT_VERSIONING.md)** - Series + captures model, data schema, migration, and phased rollout (proposed)
- **[Property Health Insights V2 Spec](./PROPERTY_HEALTH_INSIGHTS_V2.md)** - Target semantics for `metrics/summary`, comparison UX (View comparison, auto-match), UI states, rollout phases
- **[Checkpoint Implementation Summary](./CHECKPOINT_IMPLEMENTATION_SUMMARY.md)** - Summary of checkpoint feature implementation
- **[Checkpoint Updates Summary](./CHECKPOINT_UPDATES_SUMMARY.md)** - Recent updates and changes
- **[Checkpoint Presentation Updates](./CHECKPOINT_PRESENTATION_UPDATES.md)** - Presentation materials updates

### Technical Documentation

- **[Checkpoint Processing Verification](./CHECKPOINT_PROCESSING_VERIFICATION.md)** - Processing workflow verification
- **[Checkpoint Asset Type Changes](./CHECKPOINT_ASSET_TYPE_CHANGES.md)** - Asset type system changes
- **[Checkpoint Scalability Recommendations](./CHECKPOINT_SCALABILITY_RECOMMENDATIONS.md)** - Scalability considerations

### Fixes and Improvements

- **[Fix: Analyzing Placeholder](./FIX_ANALYZING_PLACEHOLDER.md)** - Fix for analyzing state display
- **[Fix: Webapp Untitled Checkpoint](./FIX_WEBAPP_UNTITLED_CHECKPOINT.md)** - Fix for untitled checkpoint handling

## Quick Start

### For Users

1. **Create a Checkpoint**: Navigate to property details → Checkpoints tab → Create checkpoint
2. **Query Checkpoints**: Switch to checkpoint agent in chat and ask questions
3. **Get Analysis**: Enable optional agents (coverage, DIY, service, cost) for comprehensive recommendations

### For Developers

1. **Backend**: See `gcp/agents/homecare/property_agent/checkpoint/analysis/` and `ARCHITECTURE.md`
2. **API**: See [Checkpoint Analysis API](./CHECKPOINT_ANALYSIS_API.md)
3. **Frontend (Webapp)**: See [Checkpoint Chat Integration](./CHECKPOINT_CHAT_INTEGRATION.md)
4. **Frontend (Mobile)**: See checkpoint components in `apps/mapp/components/property-details/`

## Architecture

```
Checkpoint System
├── Data Layer (Firestore)
│   ├── Checkpoint documents
│   ├── Vector embeddings
│   └── AI analysis results
│
├── Processing Layer (Cloud Functions)
│   ├── Checkpoint analysis worker
│   ├── Comparison worker
│   └── Metrics aggregation
│
├── AI Layer (Vertex AI property_agent)
│   ├── run_checkpoint_pipeline (retrieval + optional branches)
│   └── Optional branches (coverage, DIY, service, cost) in checkpoint/analysis/
│
└── Client Layer
    ├── Webapp (Next.js)
    └── Mobile App (React Native)
```

## Key Concepts

### Checkpoint
A snapshot of property condition at a specific point in time, including:
- Photos/videos
- AI analysis (detected items, conditions, issues)
- Location/area information
- Timestamp and metadata

### Checkpoint Agent
AI agent that answers questions about checkpoints using semantic search:
- "What changed in my kitchen?"
- "Show me checkpoints with damage"
- "When did I last check the roof?"

### Checkpoint pipeline (`run_checkpoint_pipeline`)
Composite tool that provides comprehensive recommendations:
- Retrieves checkpoints via vector search
- Runs optional coverage, DIY, service, and cost branches in parallel
- Emits `contentJson` (accordions) and `contentMarkdown` (prose) via `state_delta` patches

### Optional Agents
Specialized agents for different analysis aspects:
- **Coverage**: Warranty/insurance information
- **DIY**: Repair guides and products
- **Service**: Local professionals
- **Cost**: Cost estimates and comparisons

## Use Cases

### 1. Property Maintenance Tracking
- Regular inspections (monthly, seasonal)
- Before/after comparisons
- Condition deterioration detection

### 2. Issue Documentation
- Damage documentation for insurance
- Maintenance history for property sales
- Contractor communication

### 3. AI-Powered Insights
- Trend analysis over time
- Proactive maintenance recommendations
- Cost-effective repair solutions

### 4. Comprehensive Analysis
- Get coverage information for detected issues
- Find DIY solutions with step-by-step guides
- Locate local service providers
- Compare repair costs (DIY vs professional)

## Integration Points

### Chat Interface
- Primary agent selection (Analysis vs Checkpoint)
- Checkpoint selection drawer
- Optional agent toggles
- Real-time streaming responses

### Property Details
- Checkpoints tab
- Timeline view
- Comparison tools
- Analysis results display

### Backend Services
- Vertex AI Agent Engine
- Firestore Vector Search
- Cloud Functions workers
- External APIs (SerpAPI, SerpAPI, YouTube)

## Best Practices

### For Users
1. Create checkpoints regularly (monthly recommended)
2. Use consistent naming and locations
3. Enable optional agents for comprehensive insights
4. Review analysis recommendations carefully

### For Developers
1. Use checkpoint_ids to filter specific checkpoints
2. Select only needed optional agents for faster responses
3. Handle partial results gracefully
4. Implement proper error handling
5. Cache checkpoint data when possible

## Performance Considerations

- **Simple Query**: 2-5 seconds
- **Single Optional Agent**: 5-10 seconds
- **Multiple Optional Agents**: 15-30 seconds
- **Full Analysis**: 20-40 seconds

Optimize by:
- Limiting checkpoint count (10 max recommended)
- Selecting only needed optional agents
- Using appropriate location radius for service searches

## Troubleshooting

### Common Issues

**No checkpoints found**
- Verify property has checkpoints created
- Check checkpoint selection in drawer
- Ensure property_id is provided

**Analysis returns empty results**
- Verify checkpoints have AI analysis data
- Check optional agents are selected
- Review checkpoint data quality

**Service agent returns no providers**
- Verify location data is provided
- Adjust location radius (try 10-20 miles)
- Check property address is valid

## Support

- **Documentation**: `/docs/checkpoint/`
- **API Reference**: [Checkpoint Analysis API](./CHECKPOINT_ANALYSIS_API.md)
- **Issues**: GitHub Issues
- **Architecture**: [Architecture Diagram](../ARCHITECTURE_DIAGRAM.md)

## Related Documentation

- [Property Agent README](../../gcp/agents/homecare/property_agent/README.md)
- [Property Agent Architecture](../../gcp/agents/homecare/property_agent/ARCHITECTURE.md)
- [Architecture Diagram](../ARCHITECTURE_DIAGRAM.md)
