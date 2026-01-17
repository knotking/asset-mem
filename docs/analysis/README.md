# Analysis Agent Documentation

## Overview

This directory contains comprehensive documentation for the Analysis Agent, a sophisticated AI-powered system that provides property care diagnostics, repair guidance, and service recommendations.

## Documentation Structure

### 1. [ANALYSIS_AGENT_OVERVIEW.md](./ANALYSIS_AGENT_OVERVIEW.md)
**High-level introduction to the Analysis Agent**

- Purpose and capabilities
- Scope of property care queries handled
- Architecture overview
- Key features and technology stack
- Response format (dual Markdown/JSON)
- Integration points with client applications
- Performance characteristics
- Security and privacy considerations

**Audience:** Product managers, stakeholders, new team members

### 2. [ANALYSIS_AGENT_WORKFLOW.md](./ANALYSIS_AGENT_WORKFLOW.md)
**Detailed workflow and processing logic**

- Complete workflow from input to response
- Input schema and validation
- Triage process (multimodal and text-only)
- Clarification loop mechanism
- Optional agent execution (Coverage, DIY, Service, Cost)
- Response assembly and formatting
- Error handling strategies
- Workflow timing and optimization

**Audience:** Developers, technical architects, QA engineers

### 3. [ANALYSIS_AGENT_SUB_AGENTS.md](./ANALYSIS_AGENT_SUB_AGENTS.md)
**Deep dive into each sub-agent**

- Triage Agent: Problem identification and clarification
- Coverage Agent: Warranty and insurance retrieval
- DIY Agent: Self-repair guidance with videos and products
- Service Agent: Local professional provider search
- Shopping Agent: Product recommendations
- Cost Agent: DIY vs Professional cost analysis
- Tool descriptions and usage
- Input/output schemas for each agent
- Parallel execution strategies

**Audience:** Developers implementing or modifying agents

### 4. [ANALYSIS_AGENT_API_INTEGRATION.md](./ANALYSIS_AGENT_API_INTEGRATION.md)
**API integration and external service details**

- Proxy Service API endpoints
- Request/response formats
- Authentication with Firebase
- File upload integration
- External API integrations (SerpAPI, Yelp, YouTube, Google)
- Vertex AI RAG integration
- Client integration examples (Web, Telegram, Mobile)
- Webhook integration for async processing
- Rate limiting and monitoring
- Security considerations

**Audience:** Frontend developers, API consumers, integration engineers

### 5. [ANALYSIS_AGENT_TESTING.md](./ANALYSIS_AGENT_TESTING.md)
**Testing strategy and test cases**

- Testing pyramid and strategy
- Unit tests for each agent and tool
- Integration tests for agent coordination
- End-to-end tests for complete workflows
- Performance and load testing
- Test data and sample queries
- Test execution and CI/CD integration
- Coverage goals and validation checklist

**Audience:** QA engineers, developers, DevOps engineers

### 6. [ANALYSIS_AGENT_DEPLOYMENT.md](./ANALYSIS_AGENT_DEPLOYMENT.md)
**Deployment and operational procedures**

- Infrastructure architecture on Google Cloud Platform
- Deployment prerequisites and setup
- Step-by-step deployment process
- Monitoring and observability setup
- Troubleshooting common issues
- Scaling strategies (horizontal and vertical)
- Backup and disaster recovery
- Cost optimization techniques
- Security best practices
- Maintenance procedures and update process

**Audience:** DevOps engineers, SREs, system administrators

### 7. [INSPECTION_REPORT_AGENT.md](./INSPECTION_REPORT_AGENT.md)
**Inspection Report Analysis Agent (DocuLink sub-agent)**

- Architecture and data flow
- Inputs, outputs, and API
- Frontend integration (Primary Agent: Inspection, report selector)
- Dependencies and file locations

**Audience:** Developers integrating or extending inspection report analysis

## Quick Start

### For Product/Business Teams
Start with [ANALYSIS_AGENT_OVERVIEW.md](./ANALYSIS_AGENT_OVERVIEW.md) to understand what the Analysis Agent does and its capabilities.

### For Developers
1. Read [ANALYSIS_AGENT_OVERVIEW.md](./ANALYSIS_AGENT_OVERVIEW.md) for context
2. Study [ANALYSIS_AGENT_WORKFLOW.md](./ANALYSIS_AGENT_WORKFLOW.md) to understand the processing flow
3. Review [ANALYSIS_AGENT_SUB_AGENTS.md](./ANALYSIS_AGENT_SUB_AGENTS.md) for implementation details
4. Check [ANALYSIS_AGENT_API_INTEGRATION.md](./ANALYSIS_AGENT_API_INTEGRATION.md) for integration guidance

### For QA Engineers
1. Review [ANALYSIS_AGENT_OVERVIEW.md](./ANALYSIS_AGENT_OVERVIEW.md) for feature understanding
2. Study [ANALYSIS_AGENT_WORKFLOW.md](./ANALYSIS_AGENT_WORKFLOW.md) for test scenarios
3. Implement tests based on [ANALYSIS_AGENT_TESTING.md](./ANALYSIS_AGENT_TESTING.md)

### For DevOps/SRE
1. Understand the system via [ANALYSIS_AGENT_OVERVIEW.md](./ANALYSIS_AGENT_OVERVIEW.md)
2. Follow deployment steps in [ANALYSIS_AGENT_DEPLOYMENT.md](./ANALYSIS_AGENT_DEPLOYMENT.md)
3. Setup monitoring as described in deployment documentation
4. Reference troubleshooting section for operational issues

## Key Concepts

### Analysis Agent Architecture

The Analysis Agent follows a hierarchical orchestration pattern:

```
Root Property Agent
└── Analysis Agent (Orchestrator)
    ├── Triage Agent (Mandatory - Problem Identification)
    ├── Coverage Agent (Optional - Warranty/Insurance)
    ├── DIY Agent (Optional - Self-Repair Guidance)
    ├── Service Agent (Optional - Professional Options)
    ├── Shopping Agent (Optional - Product Recommendations)
    └── Cost Agent (Optional - Cost Analysis)
```

### Workflow Phases

1. **Input Reception**: Receive user query with optional media and context
2. **Triage**: Identify problem through multimodal analysis or text triage
3. **Clarification** (if needed): Ask questions until clear diagnosis obtained
4. **Optional Agents**: Run selected agents (coverage, DIY, service, cost)
5. **Response Assembly**: Combine results into dual-format response

### Dual Response Format

Every response includes both:
- **Markdown**: Human-readable text for Telegram and messaging platforms
- **JSON**: Structured data for web and mobile app parsing

### Key Features

- **Multimodal Analysis**: Images, videos, documents via Gemini 2.5 Flash
- **Text-Only Triage**: Intelligent diagnosis from text with clarification
- **Coverage Check**: Searches user warranties and insurance policies
- **DIY Guidance**: Steps, videos, and product recommendations
- **Professional Services**: Local provider search with ratings and reviews
- **Cost Analysis**: DIY vs Professional cost comparisons
- **Flexible Configuration**: Select which optional agents to run

## Related Documentation

### In This Repository

- **Property Agent**: `/gcp/agents/homecare/property_agent/README.md`
- **Inspection Report Agent**: [INSPECTION_REPORT_AGENT.md](./INSPECTION_REPORT_AGENT.md)
- **Architecture**: `/docs/ARCHITECTURE_DIAGRAM.md`
- **Tech Stack**: `/docs/TECH_STACK.md`
- **Checkpoint Feature**: `/docs/checkpoint/`
- **Location Services**: `/docs/LOCATION_BASED_SERVICE_AGENT_IMPLEMENTATION.md`

### External Resources

- **Vertex AI Agent Builder**: https://cloud.google.com/vertex-ai/docs/agent-builder
- **Gemini API**: https://ai.google.dev/docs
- **Firebase Authentication**: https://firebase.google.com/docs/auth
- **Cloud Run**: https://cloud.google.com/run/docs

## Support and Contact

### For Questions or Issues

1. **Technical Issues**: Create an issue in the repository
2. **Feature Requests**: Discuss with product team
3. **Deployment Issues**: Contact DevOps team
4. **API Integration**: Refer to API documentation or contact backend team

### Contributing

When updating this documentation:

1. Keep documents focused and well-organized
2. Include code examples where helpful
3. Update the README when adding new documents
4. Maintain consistent formatting and structure
5. Test all code examples before committing

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-15 | Initial comprehensive documentation |

## Glossary

- **Analysis Agent**: Main orchestrator for property care diagnostics
- **Triage**: Process of identifying and diagnosing the problem
- **Clarification Loop**: Iterative questioning to obtain clear diagnosis
- **Optional Agents**: Coverage, DIY, Service, Cost agents (run conditionally)
- **Multimodal Analysis**: Analyzing images, videos, and documents
- **RAG**: Retrieval-Augmented Generation for document search
- **GCS URI**: Google Cloud Storage URI (e.g., gs://bucket/file.jpg)
- **Dual Format**: Markdown + JSON response format
- **Sub-Agent**: Specialized agent handling specific aspect of workflow

## Future Enhancements

Planned improvements to the Analysis Agent:

1. **Multi-language Support**: Expand beyond English
2. **Voice Input**: Accept voice descriptions of problems
3. **AR Integration**: Augmented reality for guided repairs
4. **Predictive Maintenance**: Proactive issue detection
5. **Cost Tracking**: Historical cost analysis and trends
6. **Contractor Ratings**: User feedback and rating system
7. **Smart Scheduling**: Automated appointment booking with service providers
8. **Parts Ordering**: Direct integration with parts suppliers
9. **Video Analysis**: Real-time video streaming for diagnosis
10. **IoT Integration**: Connect with smart home devices for automated diagnostics

## Feedback

We welcome feedback on this documentation! Please:

- Report errors or unclear sections via GitHub issues
- Suggest improvements or additional topics
- Share use cases that aren't well covered
- Contribute examples and best practices

---

**Last Updated**: December 31, 2025
**Maintained By**: HomeApp Development Team
**Documentation Version**: 1.0.0

