# Evaluation Documentation

## Overview

The evaluation system for the Homecare AI Agent has been updated to reflect the new multimodal diagnostic capabilities and multi-agent architecture. The evaluation framework tests the comprehensive diagnostic workflow including multimodal analysis, research, service provider discovery, product recommendations, and cost estimation.

## Test Structure

### Main Test Files

1. **`test_eval.py`** - Main evaluation test file with multiple test scenarios
2. **`conversation.test.json`** - Comprehensive conversation test cases
3. **`test_config.json`** - Evaluation criteria and thresholds
4. **`cost_estimation.test.json`** - Specific cost estimation test cases
5. **`product_recommendations.test.json`** - Product recommendation test cases

### Test Categories

#### 1. Full Conversation Tests (`test_eval_full_conversation`)
Tests the complete multimodal diagnostic workflow:
- Multimodal analysis capabilities
- Research agent functionality
- Service provider discovery
- Product recommendations
- Cost estimation
- Integration between all sub-agents

#### 2. Diagnostic Agent Tests (`test_eval_diagnostic_agent`)
Tests the diagnostic agent's orchestration capabilities:
- Proper delegation to sub-agents
- Multimodal data analysis
- Conditional research execution
- Parallel agent execution
- Response assembly

#### 3. Cost Estimation Tests (`test_eval_cost_estimation`)
Tests the cost estimation agent's accuracy:
- DIY vs professional cost calculations
- Category-specific estimates
- Cost comparison analysis
- Recommendation quality

#### 4. Product Recommendation Tests (`test_eval_product_recommendations`)
Tests the product recommendations agent:
- Multi-retailer search accuracy
- Product relevance
- Price and availability information
- Purchase link generation

#### 5. Service Provider Tests (`test_eval_service_provider`)
Tests the service provider agent:
- Local service discovery
- Contact information accuracy
- Review and rating inclusion
- Authorization status identification

## Test Cases

### Multimodal Diagnostic Scenarios

The test cases cover realistic home care and vehicle diagnostic scenarios:

1. **Vehicle Issues**:
   - Car scratch repair
   - Bumper dent repair
   - Brake pad replacement
   - Paint chip repair

2. **Home Repairs**:
   - Faucet leak repair
   - Sink leak repair
   - Drywall crack repair
   - Electrical outlet repair

3. **Appliance Issues**:
   - Washing machine error codes
   - Refrigerator noise problems
   - Dryer heating issues
   - HVAC system problems

4. **Document Analysis**:
   - Insurance policy analysis
   - Warranty document review
   - Manual interpretation

### Expected Tool Usage

Each test case includes expected tool usage patterns:

```json
{
  "expected_tool_use": [
    {
      "tool_name": "diagnostic_agent",
      "tool_input": {
        "user_query": "Problem description",
        "diagnosis_uris": ["gs://bucket/image.jpg"],
        "context_doc_uris": ["gs://bucket/document.pdf"],
        "property_address": "123 Main St, City, State"
      }
    }
  ]
}
```

### Reference Responses

Each test case includes comprehensive reference responses that demonstrate:
- Proper problem identification
- Research integration
- Service provider recommendations
- Product suggestions
- Cost estimates
- Safety considerations

## Evaluation Criteria

### Tool Trajectory Score (0.8)
Measures how accurately the agent uses the appropriate tools:
- Correct agent delegation
- Proper tool parameter passing
- Appropriate tool sequencing
- Parallel execution when required

### Response Match Score (0.7)
Measures how closely the agent's responses match expected outputs:
- Content accuracy
- Information completeness
- Response structure
- Safety considerations

## Running Evaluations

### Full System Evaluation
```bash
poetry run pytest eval/test_eval.py::test_eval_full_conversation -v
```

### Individual Agent Evaluation
```bash
# Diagnostic Agent
poetry run pytest eval/test_eval.py::test_eval_diagnostic_agent -v

# Cost Estimation Agent
poetry run pytest eval/test_eval.py::test_eval_cost_estimation -v

# Product Recommendations Agent
poetry run pytest eval/test_eval.py::test_eval_product_recommendations -v

# Service Provider Agent
poetry run pytest eval/test_eval.py::test_eval_service_provider -v
```

### All Evaluations
```bash
poetry run pytest eval/test_eval.py -v
```

## Test Data Requirements

### Environment Setup
- Google Cloud Project configured
- Vertex AI RAG Engine access
- External API keys (SerpAPI, Yelp, retailer APIs)
- Test GCS bucket with sample images/videos

### Sample Data
The evaluation uses sample GCS URLs for testing:
- `gs://bucket/error-code-photo.jpg` - Appliance error codes
- `gs://bucket/refrigerator-noise.mp4` - Appliance noise issues
- `gs://bucket/car-insurance-policy.pdf` - Insurance documents
- `gs://bucket/hvac-issue.mp4` - HVAC problems

## Performance Expectations

### Response Time
- Multimodal analysis: < 30 seconds
- Research agent: < 45 seconds
- Service provider search: < 20 seconds
- Product recommendations: < 25 seconds
- Cost estimation: < 10 seconds

### Accuracy Targets
- Tool usage accuracy: > 80%
- Response quality: > 70%
- Cost estimation accuracy: > 85%
- Product relevance: > 75%

## Continuous Improvement

### Test Case Updates
- Regular addition of new diagnostic scenarios
- Integration of user feedback
- Performance monitoring and optimization
- API integration testing

### Evaluation Metrics
- Track tool usage patterns
- Monitor response quality trends
- Analyze cost estimation accuracy
- Measure user satisfaction

## Troubleshooting

### Common Issues
1. **API Rate Limits**: Implement proper rate limiting and retry logic
2. **GCS Access**: Ensure proper permissions for test data access
3. **External API Failures**: Implement fallback responses
4. **Response Timeouts**: Optimize agent execution for faster responses

### Debug Mode
Enable debug logging for detailed evaluation information:
```bash
export DEBUG=true
poetry run pytest eval/test_eval.py -v -s
```

This evaluation framework ensures the Homecare AI Agent system provides accurate, comprehensive, and reliable diagnostic services for home care and vehicle issues.
