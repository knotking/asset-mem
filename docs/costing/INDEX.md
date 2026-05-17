# Cost Estimation System - Documentation Index

## Quick Navigation

### Getting Started
- [README](README.md) - Start here for overview and quick links
- [Overview & Architecture](OVERVIEW.md) - System architecture and components
- [API Integration](API_INTEGRATION.md) - How to integrate with the cost agent

### Technical Documentation
- [AI Cost Estimation](AI_COST_ESTIMATION.md) - Deep dive into AI estimation
- [Configuration Guide](CONFIGURATION.md) - Setup and configuration options
- [Testing Guide](TESTING.md) - Testing strategies and test cases

### Operations
- [Deployment Guide](DEPLOYMENT.md) - Rollout strategy and monitoring
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

## Documentation by Role

### For Developers
1. [Overview](OVERVIEW.md) - Understand the architecture
2. [AI Cost Estimation](AI_COST_ESTIMATION.md) - Learn how AI works
3. [API Integration](API_INTEGRATION.md) - Integration examples
4. [Configuration](CONFIGURATION.md) - Configuration options
5. [Testing](TESTING.md) - Test your changes

### For DevOps/SRE
1. [Deployment Guide](DEPLOYMENT.md) - Rollout and monitoring
2. [Configuration](CONFIGURATION.md) - Environment setup
3. [Troubleshooting](TROUBLESHOOTING.md) - Debug issues
4. [Overview](OVERVIEW.md) - System architecture

### For Product Managers
1. [README](README.md) - High-level overview
2. [Overview](OVERVIEW.md) - Capabilities and features
3. [Deployment Guide](DEPLOYMENT.md) - Rollout strategy
4. [Testing](TESTING.md) - Accuracy metrics

## Documentation by Topic

### Architecture & Design
- [Overview - System Architecture](OVERVIEW.md#system-architecture)
- [Overview - Core Components](OVERVIEW.md#core-components)
- [Overview - Data Flow](OVERVIEW.md#data-flow)
- [AI Cost Estimation - Model & Configuration](AI_COST_ESTIMATION.md#ai-model--configuration)

### AI & Machine Learning
- [AI Cost Estimation - Complete Guide](AI_COST_ESTIMATION.md)
- [AI Cost Estimation - Google Search Grounding](AI_COST_ESTIMATION.md#google-search-grounding)
- [AI Cost Estimation - Prompt Engineering](AI_COST_ESTIMATION.md#prompt-engineering)
- [AI Cost Estimation - Response Parsing](AI_COST_ESTIMATION.md#response-parsing)
- [AI Cost Estimation - Confidence Scoring](AI_COST_ESTIMATION.md#confidence-scoring)

### Configuration & Setup
- [Configuration Guide - Complete](CONFIGURATION.md)
- [Configuration - Feature Flags](CONFIGURATION.md#feature-flags)
- [Configuration - Thresholds](CONFIGURATION.md#thresholds)
- [Configuration - Regional Multipliers](CONFIGURATION.md#regional-multipliers)
- [Configuration - Environment Variables](CONFIGURATION.md#environment-variables)

### Integration & API
- [API Integration - Complete Guide](API_INTEGRATION.md)
- [API Integration - Request Format](API_INTEGRATION.md#request-format)
- [API Integration - Response Format](API_INTEGRATION.md#response-format)
- [API Integration - Code Examples](API_INTEGRATION.md#code-examples)

### Testing & Quality
- [Testing Guide - Complete](TESTING.md)
- [Testing - Test Cases](TESTING.md#test-cases)
- [Testing - Validation](TESTING.md#validation)
- [Testing - Performance Testing](TESTING.md#performance-testing)

### Deployment & Operations
- [Deployment Guide - Complete](DEPLOYMENT.md)
- [Deployment - Rollout Strategy](DEPLOYMENT.md#rollout-strategy)
- [Deployment - Monitoring](DEPLOYMENT.md#monitoring)
- [Deployment - Alerts](DEPLOYMENT.md#alerts)
- [Troubleshooting - Complete Guide](TROUBLESHOOTING.md)

### Features & Capabilities
- [Overview - Key Capabilities](OVERVIEW.md#key-capabilities)
- [Overview - Location-Aware Pricing](OVERVIEW.md#location-aware-pricing)
- [Overview - Complexity Analysis](OVERVIEW.md#complexity-analysis)
- [AI Cost Estimation - Location Intelligence](AI_COST_ESTIMATION.md#location-intelligence)

## Code References

### Main Implementation
- **Cost Agent**: `gcp/agents/homecare/property_agent/sub_agents/cost_agent/agent.py`
- **AI Estimator**: `gcp/agents/homecare/property_agent/sub_agents/cost_agent/ai_cost_estimator.py`
- **Service Pricing**: `gcp/agents/homecare/property_agent/sub_agents/cost_agent/service_pricing_extractor.py`
- **Configuration**: `gcp/agents/homecare/property_agent/sub_agents/cost_agent/config.py`
- **Prompts**: `gcp/agents/homecare/property_agent/sub_agents/cost_agent/prompts.py`

### Tests
- **E2E eval**: `gcp/agents/homecare/property_agent/evals/cost_agent.evalset.json` (`make test-eval-cost`)
- **Unit tests**: `gcp/agents/homecare/tests/test_cost_agent.py`, `tests/test_diy_agent.py`

### Documentation
- **Code README**: `gcp/agents/homecare/property_agent/sub_agents/cost_agent/README.md`
- **Implementation Summary**: `gcp/agents/homecare/property_agent/sub_agents/cost_agent/IMPLEMENTATION_SUMMARY.md`
- **Docs Directory**: `docs/costing/`

## Common Tasks

### I want to...

**...understand how the system works**
→ Start with [README](README.md), then [Overview](OVERVIEW.md)

**...integrate the cost agent into my app**
→ Read [API Integration](API_INTEGRATION.md)

**...configure the system**
→ Follow [Configuration Guide](CONFIGURATION.md)

**...deploy to production**
→ Follow [Deployment Guide](DEPLOYMENT.md)

**...troubleshoot an issue**
→ Check [Troubleshooting](TROUBLESHOOTING.md)

**...understand how AI estimation works**
→ Read [AI Cost Estimation](AI_COST_ESTIMATION.md)

**...write tests**
→ Follow [Testing Guide](TESTING.md)

**...adjust confidence thresholds**
→ See [Configuration - Thresholds](CONFIGURATION.md#thresholds)

**...add a new regional multiplier**
→ See [Configuration - Regional Multipliers](CONFIGURATION.md#regional-multipliers)

**...monitor system health**
→ See [Deployment - Monitoring](DEPLOYMENT.md#monitoring)

**...understand fallback behavior**
→ See [Overview - Fallback System](OVERVIEW.md#6-hardcoded-library-fallback)

**...improve accuracy**
→ See [Testing - Accuracy Improvement](TESTING.md#improving-accuracy)

## Version History

### v1.0 (January 2026)
- Initial release with AI-powered estimation
- Google Search grounding integration
- Location-aware pricing
- Service provider calibration
- Hardcoded library fallback
- Comprehensive validation
- Feature flags and configuration
- Full test coverage
- Complete documentation

## Related Systems

### Analysis Agent
- **Docs**: `docs/analysis/`
- **Integration**: Cost agent is called by analysis agent
- **Relationship**: Provides cost estimates after triage

### Service Agent
- **Docs**: `docs/analysis/ANALYSIS_AGENT_SUB_AGENTS.md`
- **Integration**: Provides service provider data for calibration
- **Relationship**: Service results feed into cost calibration

### Checkpoint Agent
- **Docs**: `docs/checkpoint/`
- **Integration**: Cost agent called for checkpoint-based estimates
- **Relationship**: Provides costs for checkpoint issues

## External Resources

### Gemini API
- **Documentation**: https://ai.google.dev/docs
- **Models**: https://ai.google.dev/models/gemini
- **Search Grounding**: https://ai.google.dev/docs/grounding

### APIs Used
- **SerpAPI**: Service provider pricing extraction
- **SerpAPI**: Service provider pricing extraction
- **Google Search**: Via Gemini grounding

## Support

### Documentation Issues
- File issue in project repository
- Tag with `documentation` label
- Reference specific doc file

### System Issues
- Check [Troubleshooting](TROUBLESHOOTING.md) first
- Review logs for error messages
- Verify configuration settings

### Feature Requests
- File enhancement request
- Tag with `enhancement` label
- Describe use case and benefits

## Contributing

### Documentation Updates
1. Edit relevant `.md` file in `docs/costing/`
2. Update version history if significant
3. Update this index if adding new doc
4. Submit pull request

### Code Changes
1. Update code in `cost_agent/` directory
2. Add/update tests
3. Update relevant documentation
4. Update implementation summary

## Search Tips

### Finding Information

**By Keyword**:
- Use Ctrl+F / Cmd+F in your browser
- Search across all docs in `docs/costing/`

**By Topic**:
- Use the "Documentation by Topic" section above
- Follow links to specific sections

**By Role**:
- Use the "Documentation by Role" section above
- Follow the recommended reading order

**By Task**:
- Use the "Common Tasks" section above
- Find the "I want to..." that matches your need

---

**Last Updated**: January 18, 2026
**Version**: 1.0
