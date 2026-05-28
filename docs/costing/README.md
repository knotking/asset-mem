# Cost Estimation System Documentation

## Overview

The Cost Estimation System provides intelligent, AI-powered cost estimates for home repairs, vehicle maintenance, and property care services. It combines cutting-edge AI technology with reliable fallback mechanisms to deliver accurate, location-aware pricing.

## Quick Links

- [Overview & Architecture](OVERVIEW.md) - System architecture and key components
- [AI Cost Estimation](AI_COST_ESTIMATION.md) - How AI-powered estimation works
- [Configuration Guide](CONFIGURATION.md) - Setup and configuration options
- [API Integration](API_INTEGRATION.md) - How to integrate with the cost agent
- [Testing Guide](TESTING.md) - Testing strategies and test cases
- [Deployment Guide](DEPLOYMENT.md) - Rollout strategy and monitoring
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions

## Key Features

### 🤖 AI-Powered Estimation
- Real-time pricing using Gemini with Google Search grounding
- Location-aware cost adjustments based on regional markets
- Intelligent complexity analysis for accurate recommendations
- Current 2026 pricing data from web sources

### 📊 Service Provider Calibration
- Extracts pricing from local service providers (SerpAPI, SerpAPI)
- Calibrates AI estimates with real market data
- Confidence scoring based on data quality

### 🛡️ Reliable Fallback System
- Hardcoded cost library for 9 common repair categories
- Automatic fallback on AI failure or low confidence
- Graceful degradation ensures continuous service

### 📍 Location Intelligence
- Parses addresses to extract city and state
- Regional cost multipliers (SF: 1.4x, NYC: 1.35x, etc.)
- Reflects actual local labor rates and material costs

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cost Agent (Orchestrator)                │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ AI Estimator │  │   Service    │  │  Hardcoded   │
│   (Primary)  │  │  Provider    │  │   Library    │
│              │  │  Calibration │  │  (Fallback)  │
└──────────────┘  └──────────────┘  └──────────────┘
        │                │                │
        └────────────────┴────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Structured Cost    │
              │     Response        │
              └─────────────────────┘
```

## Response Format

All cost estimates return structured JSON:

```json
{
  "costEstimates": {
    "repair_type": "Description of repair",
    "DIY": {
      "cost_range": "$XX-YY",
      "includes": ["Materials", "Tools", "Time"],
      "savings": "Percentage saved vs professional",
      "complexity": "Difficulty assessment"
    },
    "Service": {
      "cost_range": "$XX-YY",
      "includes": ["Labor", "Materials", "Warranty"],
      "benefits": "Professional service benefits",
      "complexity": "When professional is recommended"
    },
    "comparison": {
      "diy_savings": "Savings analysis",
      "professional_benefits": "Value of professional service",
      "considerations": "Important factors to consider"
    },
    "recommendation": {
      "notes": "Specific recommendations",
      "next_steps": "What to do next"
    }
  }
}
```

## Getting Started

### For Developers

1. **Read the [Overview](OVERVIEW.md)** to understand the system architecture
2. **Review [API Integration](API_INTEGRATION.md)** for integration examples
3. **Check [Configuration](CONFIGURATION.md)** for setup options
4. **Run tests** using the [Testing Guide](TESTING.md)

### For Operators

1. **Review [Deployment Guide](DEPLOYMENT.md)** for rollout strategy
2. **Set up monitoring** as described in the deployment guide
3. **Configure feature flags** per [Configuration Guide](CONFIGURATION.md)
4. **Monitor logs** and metrics for system health

### For Product Managers

1. **Understand capabilities** from the [Overview](OVERVIEW.md)
2. **Review accuracy metrics** in [Testing Guide](TESTING.md)
3. **Plan rollout** using [Deployment Guide](DEPLOYMENT.md)
4. **Track success criteria** defined in deployment documentation

## Quick Start Example

### Basic Usage

```python
from cost_agent import cost_agent

# Simple cost estimation
query = {
    "diagnosis": "Leaking pipe under kitchen sink"
}
result = cost_agent.run(json.dumps(query))
```

### With Location Context

```python
# Location-aware pricing
query = {
    "diagnosis": "Electrical outlet not working",
    "property_address": "123 Market St, San Francisco, CA 94103"
}
result = cost_agent.run(json.dumps(query))
```

### With Service Provider Calibration

```python
# Calibrated with real provider data
query = {
    "diagnosis": "HVAC not cooling properly",
    "property_address": "456 Oak Ave, Seattle, WA 98101",
    "serviceResults": {
        "localPros": {
            "serpAPIResults": [...],
            "googleSearchResults": [...]
        }
    }
}
result = cost_agent.run(json.dumps(query))
```

## Key Metrics

### System Performance
- **AI Usage Rate**: Target >80%
- **Average Confidence**: Target >0.7
- **Calibration Rate**: Track % of estimates calibrated
- **Fallback Rate**: Target <20%
- **Latency**: AI <5s, Fallback <100ms

### Business Metrics
- **Cost Accuracy**: Within ±20% of actual quotes
- **User Satisfaction**: Maintained or improved
- **Coverage**: Handles any repair type (vs 9 hardcoded)

## Documentation Structure

```
docs/costing/
├── README.md (this file)
├── OVERVIEW.md - Architecture and components
├── AI_COST_ESTIMATION.md - AI estimation details
├── CONFIGURATION.md - Setup and configuration
├── API_INTEGRATION.md - Integration guide
├── TESTING.md - Testing strategies
├── DEPLOYMENT.md - Rollout and monitoring
├── TROUBLESHOOTING.md - Common issues
└── INDEX.md - Complete documentation index
```

## Support & Resources

### Documentation
- **Technical Details**: See [Overview](OVERVIEW.md)
- **Configuration**: See [Configuration Guide](CONFIGURATION.md)
- **API Reference**: See [API Integration](API_INTEGRATION.md)

### Code Location
- **Cost Agent**: `gcp/agents/homecare/property_agent/sub_agents/cost_agent/`
- **E2E QA**: manual `adk web` on staging (ADK evalsets removed); unit tests: `make test`
- **Unit tests**: `gcp/agents/homecare/tests/test_cost_agent.py`
- **Documentation**: `docs/costing/`

### Getting Help
1. Check [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Review logs for fallback reasons
3. Verify configuration settings
4. Test with known good inputs

## Version History

### v1.0 (January 2026)
- ✅ AI-powered cost estimation with Gemini
- ✅ Google Search grounding for real-time data
- ✅ Location-aware pricing
- ✅ Service provider calibration
- ✅ Hardcoded library fallback
- ✅ Comprehensive validation
- ✅ Feature flags and configuration
- ✅ Full test coverage

## Next Steps

1. **Explore Documentation**: Start with [Overview](OVERVIEW.md)
2. **Understand AI Estimation**: Read [AI Cost Estimation](AI_COST_ESTIMATION.md)
3. **Configure System**: Follow [Configuration Guide](CONFIGURATION.md)
4. **Integrate**: Use [API Integration](API_INTEGRATION.md) examples
5. **Deploy**: Follow [Deployment Guide](DEPLOYMENT.md)

## Contributing

When modifying the cost estimation system:

1. Update relevant documentation in `docs/costing/`
2. Add test cases to `cost_estimation_ai.test.json`
3. Run full test suite
4. Update version history
5. Document configuration changes

## License

Part of the HomeApp AI Agent System.

---

**Last Updated**: January 18, 2026
**Status**: Production Ready
**Version**: 1.0
