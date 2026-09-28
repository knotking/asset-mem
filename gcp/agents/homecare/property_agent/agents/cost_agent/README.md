# Cost Agent - AI-Powered Cost Estimation

## Overview

The Cost Agent provides intelligent, location-aware cost estimates for home repairs, vehicle maintenance, and property care services. It uses AI with Google Search grounding to deliver real-time, accurate pricing that reflects current market conditions and regional variations.

## Key Features

### 🤖 AI-Powered Estimation

- **Google Search Grounding**: Prefetches live market pricing (current year) via `global_direct_generate_client_and_model()` before structured JSON estimation
- **Location-Aware Pricing**: Adjusts costs based on regional labor rates and cost-of-living
- **Complexity Analysis**: AI-driven assessment of repair difficulty and safety factors
- **Market Trends**: Incorporates current material costs and seasonal variations

### 📊 Service Provider Calibration

- **Real Market Data**: Extracts pricing from local service providers (SerpAPI, Google Search results)
- **Automatic Calibration**: Adjusts AI estimates using actual provider pricing
- **Confidence Scoring**: Weights estimates based on data quality and availability

### 🛡️ Reliable Fallback System

- **Hardcoded Library**: Maintains proven cost estimates for 9 common repair categories
- **Graceful Degradation**: Automatically falls back when AI confidence is low
- **Validation Rules**: Ensures all estimates meet sanity checks and realistic ranges

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Cost Agent                            │
│                     (Orchestrator)                           │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ├─── Extract Context (diagnosis, location, service data)
                    │
                    ├─── AI Estimation Path (Primary)
                    │    │
                    │    ├─── service_pricing_extractor.py (if provider $ data)
                    │    │    ├─── Parse SerpAPI / Google Search results
                    │    │    └─── Calibrate when confidence ≥ threshold
                    │    │
                    │    ├─── _fetch_market_pricing_context (if no provider data)
                    │    │    └─── Google Search grounding → web_context prose
                    │    │
                    │    ├─── ai_cost_estimator.py
                    │    │    ├─── Build prompt with web_context
                    │    │    └─── Structured JSON (no grounding tools)
                    │    │
                    │    ├─── Validate cost ranges
                    │    └─── Check confidence threshold
                    │
                    └─── Fallback Path (When AI fails/low confidence)
                         │
                         └─── Hardcoded Cost Library
                              ├─── Keyword matching
                              ├─── Category selection
                              └─── Build response

```

## Components

### 1. `agent.py` - Main Orchestrator

The primary agent that coordinates AI estimation and fallback logic.

**Key Functions:**

- `cost_estimation(query)`: Main cost estimation with AI-first approach
- `cost_estimation_diy(query)`: DIY-only cost estimates
- `_estimate_with_ai()`: AI estimation with calibration
- `_match_cost_category()`: Hardcoded library matching (fallback)
- `_build_cost_response()`: Response formatting

**Tools:**

- `cost_estimation`: Full DIY vs Professional comparison
- `cost_estimation_diy`: DIY-only estimates

### 2. `ai_cost_estimator.py` - AI Estimation Engine

Handles AI-powered cost estimation: structured JSON from Gemini using optional `web_context` from pricing-focused checkpoint prefetch (`checkpoint_pricing_grounding_web_summary`) or inline `_fetch_market_pricing_context` — not the DIY steps summary.

**Key Functions:**

- `estimate_costs_with_ai()`: Main AI estimation function
- `_extract_location_info()`: Parse city/state from address
- `_extract_repair_details()`: Categorize and analyze repair
- `_build_cost_estimation_prompt()`: Create structured AI prompt
- `_parse_structured_cost_json()` / `_validate_structured_costs()`: Parse and validate JSON cost output
- `validate_cost_ranges()`: Ensure estimates are realistic

**Features:**

- Location extraction and regional cost adjustments
- Repair type categorization (plumbing, electrical, HVAC, etc.)
- Complexity factor identification (permits, safety, access)
- Confidence scoring based on data quality

### 3. `service_pricing_extractor.py` - Market Data Integration

Extracts and processes pricing from real service provider results.

**Key Functions:**

- `extract_pricing_from_serp_results()`: Parse SerpAPI pricing
- `extract_pricing_from_google_results()`: Parse provider pricing signals and price levels
- `combine_service_provider_pricing()`: Merge multiple sources
- `calibrate_ai_estimate_with_provider_data()`: Adjust AI estimates
- `extract_and_combine_all_pricing()`: One-stop extraction

**Pricing Extraction:**

- Regex patterns for various price formats ($XX-YY, $XX to $YY, from $XX)
- Provider pricing extraction from listing metadata
- Confidence scoring based on data coverage

### 4. `prompts.py` - Prompt Templates

Structured prompts for different cost estimation scenarios.

**Available Prompts:**

- `get_location_pricing_prompt()`: Regional labor rates
- `get_material_cost_prompt()`: Current material costs
- `get_complexity_analysis_prompt()`: Repair difficulty assessment
- `get_market_trends_prompt()`: Current pricing trends
- `get_comprehensive_cost_estimate_prompt()`: Full estimation prompt
- `get_cost_validation_prompt()`: Estimate validation

### 5. `config.py` - Configuration & Feature Flags

Centralized configuration for the cost estimation system.

**Feature Flags:**

- `USE_AI_COST_ESTIMATION`: Enable/disable AI (default: true)
- `USE_SERVICE_PROVIDER_CALIBRATION`: Enable calibration (default: true)

**Thresholds:**

- `MIN_AI_CONFIDENCE_THRESHOLD`: Minimum confidence for AI (default: 0.6)
- `MIN_PROVIDER_DATA_CONFIDENCE`: Minimum for calibration (default: 0.5)

**Model Configuration:**

- `AI_MODEL_NAME`: Gemini model (default: gemini-3.1-flash-lite)
- `AI_TEMPERATURE`: Temperature setting (default: 0.3)
- `AI_MAX_OUTPUT_TOKENS`: Max output (default: 2048)

**Regional Multipliers:**

- San Francisco: 1.4x
- New York: 1.35x
- Los Angeles: 1.25x
- Seattle: 1.2x
- Default: 1.0x

## Usage

### Basic Cost Estimation

```python
from cost_agent import cost_agent

# Simple query
query = '{"diagnosis": "Leaking pipe under kitchen sink"}'
result = cost_agent.run(query)
```

### With Location Context

```python
# Location-aware pricing
query = '''
{
  "diagnosis": "Electrical outlet not working, needs replacement",
  "property_address": "123 Market St, San Francisco, CA 94103"
}
'''
result = cost_agent.run(query)
```

### With Service Provider Calibration

```python
# Calibrated with real provider data
query = '''
{
  "diagnosis": "HVAC not cooling, possible refrigerant issue",
  "property_address": "456 Oak Ave, Seattle, WA 98101",
  "serviceResults": {
    "localPros": {
      "serpAPIResults": [...],
      "googleSearchResults": [...]
    }
  }
}
'''
result = cost_agent.run(query)
```

### DIY-Only Estimation

```python
# Get only DIY costs
query = '{"diagnosis": "Replace air filter in HVAC system"}'
# Use cost_estimation_diy tool
```

## Response Format

The agent returns structured JSON with comprehensive cost information:

```json
{
  "costEstimates": {
    "repair_type": "Plumbing leak repair",
    "DIY": {
      "cost_range": "$25-120",
      "includes": [
        "Pipe repair clamp or epoxy",
        "Replacement fittings",
        "Water shutoff and cleanup time"
      ],
      "savings": "Typically 60-75% vs. professional service",
      "complexity": "Moderate - requires basic plumbing knowledge"
    },
    "Service": {
      "cost_range": "$220-550",
      "includes": [
        "Professional labor (San Francisco rates)",
        "Pipe section replacement",
        "Soldering/PEX crimping",
        "Moisture remediation guidance"
      ],
      "benefits": "Licensed expertise, warranty, code compliance",
      "complexity": "Professional service recommended for permanent fix"
    },
    "comparison": {
      "diy_savings": "Save $150-400 on labor costs",
      "professional_benefits": "Peace of mind, warranty, faster completion",
      "considerations": "DIY fixes are temporary; professional replacement prevents hidden water damage"
    },
    "recommendation": {
      "notes": "DIY temporary fixes buy time, but replacement by a licensed plumber is recommended to prevent hidden water damage. Estimate calibrated using data from 5 local service providers.",
      "next_steps": "For DIY: Research pipe repair techniques. For Professional: Get 2-3 quotes from licensed plumbers."
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# Feature Flags
USE_AI_COST_ESTIMATION=true
USE_SERVICE_PROVIDER_CALIBRATION=true

# Thresholds
MIN_AI_CONFIDENCE_THRESHOLD=0.6
MIN_PROVIDER_DATA_CONFIDENCE=0.5

# Timeouts (seconds)
AI_ESTIMATION_TIMEOUT=30
PROVIDER_PRICING_TIMEOUT=10

# Calibration
PROVIDER_DATA_WEIGHT=0.3  # 0.0-1.0

# Model Settings
COST_ESTIMATION_MODEL=gemini-3.1-flash-lite
AI_TEMPERATURE=0.3
AI_MAX_OUTPUT_TOKENS=2048

# Logging
LOG_AI_COST_RESPONSES=false
LOG_FALLBACK_USAGE=true

# Caching
```

### Adjusting Confidence Thresholds

Lower thresholds = more AI usage, higher thresholds = more fallback:

```python
from cost_agent.config import config

# More aggressive AI usage
config.MIN_AI_CONFIDENCE_THRESHOLD = 0.5

# More conservative (prefer fallback)
config.MIN_AI_CONFIDENCE_THRESHOLD = 0.8
```

## Decision Flow

### When AI Estimation is Used

✅ **AI is used when:**

- Feature flag `USE_AI_COST_ESTIMATION` is true
- Diagnosis is provided and >= 10 characters
- AI call succeeds
- Confidence >= `MIN_AI_CONFIDENCE_THRESHOLD` (default: 0.6)
- Cost ranges pass validation

### When Fallback is Used

⚠️ **Fallback to hardcoded library when:**

- AI estimation disabled by config
- Diagnosis missing or too short
- AI call fails or times out
- Confidence below threshold
- Cost validation fails
- Any exception during AI processing

### Calibration Conditions

🎯 **Calibration happens when:**

- `USE_SERVICE_PROVIDER_CALIBRATION` is true
- Service provider results are available
- Provider data confidence >= `MIN_PROVIDER_DATA_CONFIDENCE` (default: 0.5)
- At least one provider has pricing information

## Validation Rules

All cost estimates must pass these validation checks:

1. **Format Validation**: Cost ranges match `$XX-YY` pattern
2. **Range Validity**: Low < High for both DIY and Professional
3. **Minimum Cost**: All costs >= $5
4. **Maximum Cost**: All costs <= $50,000
5. **DIY vs Pro Ratio**: DIY high <= Professional high × 1.5
6. **Sanity Check**: Professional generally higher than DIY

## Testing

### Unit tests (fast, mocked)

```bash
cd gcp/agents/homecare
make test
# tests/test_cost_agent.py — AI path, validation, library fallback (mocked)
# tests/test_diy_agent.py::test_cost_estimation_diy_from_library
# tests/test_coverage_agent.py — coverage_agent wiring
```

### ADK eval (live, E2E)

Cost behavior in production is exercised via checkpoint analysis with `checkpoint_optional_agents: ["cost"]`:

- Validate with unit tests in `tests/test_cost_agent.py` and `make test`
- E2E: manual `adk web` on staging (ADK evalsets removed)

Covers AI + library fallback paths in a full `property_agent` session, not an isolated `cost_agent` module eval.

### What to validate manually

1. Location-aware pricing (different regions)
2. Complexity (simple DIY vs professional-only)
3. Service provider calibration when SerpAPI data is present
4. Fallback to hardcoded library when AI confidence is low
5. Validation rules (ranges, DIY vs pro ratio)

## Monitoring & Logging

### Key Metrics to Monitor

1. **AI Usage Rate**: % of requests using AI vs fallback
2. **Confidence Scores**: Distribution of AI confidence
3. **Calibration Rate**: % of estimates calibrated with provider data
4. **Fallback Reasons**: Why fallback was triggered
5. **Latency**: AI call duration vs hardcoded library
6. **Cost Accuracy**: Compare estimates to actual quotes (manual validation)

### Log Events

```python
# AI estimation success
logger.info(f"AI cost estimation successful: source={source}, confidence={confidence:.2f}")

# Fallback usage
logger.warning(f"Fallback to hardcoded library: reason={reason}")

# Calibration
logger.info(f"Calibrated estimate using {provider_count} local providers")

# Validation failure
logger.warning(f"AI cost estimate failed validation: {validation_error}")
```

## Troubleshooting

### Issue: AI always falls back to hardcoded library

**Possible Causes:**

- Feature flag disabled: Check `USE_AI_COST_ESTIMATION`
- Confidence threshold too high: Lower `MIN_AI_CONFIDENCE_THRESHOLD`
- Diagnosis too short: Ensure diagnosis >= 10 characters
- API key issues: Verify Gemini API credentials

### Issue: Estimates seem inaccurate for location

**Solutions:**

- Verify property_address is being passed correctly
- Check regional multipliers in `config.py`
- Enable service provider calibration
- Review AI prompt templates in `prompts.py`

### Issue: High latency

**Solutions:**

- Reduce `AI_MAX_OUTPUT_TOKENS`
- Adjust `AI_ESTIMATION_TIMEOUT` (seconds; default 30)
- Consider using fallback for simple repairs

### Issue: Calibration not working

**Check:**

- `USE_SERVICE_PROVIDER_CALIBRATION` is true
- Service results are being passed in query
- Provider data contains pricing information
- Provider confidence >= `MIN_PROVIDER_DATA_CONFIDENCE`

## Best Practices

### 1. Always Provide Location When Available

```python
# Good
query = {"diagnosis": "...", "property_address": "123 Main St, City, ST"}

# Less optimal
query = {"diagnosis": "..."}  # Uses national averages
```

### 2. Pass Service Results for Calibration

```python
# Best - includes service provider data
query = {
  "diagnosis": "...",
  "property_address": "...",
  "serviceResults": {...}
}
```

### 3. Monitor Fallback Usage

```python
# Enable fallback logging
config.LOG_FALLBACK_USAGE = True
```

### 4. Validate Estimates in Production

- Collect actual quotes from users
- Compare AI estimates to real costs
- Adjust confidence thresholds based on accuracy

### 5. Use Appropriate Timeouts

- Short timeout for simple repairs (10-15s)
- Longer timeout for complex estimates (30s)
- Always have fallback ready

## Future Enhancements

### Planned Features

- [ ] Cost estimate caching for common repairs
- [ ] Historical cost tracking and trend analysis
- [ ] User feedback loop for estimate accuracy
- [ ] Integration with more pricing APIs (HomeAdvisor, Angi)
- [ ] Seasonal pricing adjustments
- [ ] Material cost database integration
- [ ] Multi-language support for international markets

### Potential Improvements

- Machine learning model for confidence scoring
- A/B testing framework for AI vs hardcoded
- Real-time cost index tracking
- Integration with property value data
- Warranty cost analysis

## Contributing

When modifying the cost agent:

1. **Update tests**: Add unit tests under `tests/`
2. **Validate changes**: `make test` (CI) and manual `adk web` when changing cost output shape
3. **Monitor Impact**: Track fallback rates and confidence scores
4. **Document Changes**: Update this README
5. **Consider Backward Compatibility**: Maintain existing API contract

## Support

For issues or questions:

- Check logs for fallback reasons
- Review configuration settings
- Verify API credentials
- Test with known good inputs
- Check validation rules

## License

Part of the AssetMem AI Agent System.
