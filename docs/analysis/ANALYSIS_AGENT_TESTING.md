> **Archived:** Retired Analysis / Triage agent docs. See [ORCHESTRATOR_V2_PLAN.md](../../gcp/agents/homecare/docs/ORCHESTRATOR_V2_PLAN.md).

# Analysis Agent Testing

## Overview

This document describes the testing strategy, test cases, and validation procedures for the Analysis Agent. It covers unit tests, integration tests, end-to-end tests, and performance testing.

## Testing Strategy

### Test Pyramid

```
           /\
          /  \  E2E Tests (10%)
         /____\
        /      \  Integration Tests (30%)
       /________\
      /          \  Unit Tests (60%)
     /____________\
```

### Testing Levels

1. **Unit Tests**: Individual agent tools and functions
2. **Integration Tests**: Agent coordination and API integration
3. **End-to-End Tests**: Complete workflows from client to response
4. **Performance Tests**: Load testing and benchmarking
5. **User Acceptance Tests**: Real-world scenario validation

## Unit Tests

### Triage Agent Tests

#### Test: Multimodal Analysis with Valid Image

```python
def test_triage_multimodal_valid_image():
    """Test triage agent with valid image URI"""
    input_data = {
        "user_query": "What's wrong with this faucet?",
        "diagnosis_uris": ["gs://test-bucket/faucet_leak.jpg"]
    }
    
    result = triage_agent.run(input_data)
    
    assert "triageResult" in result
    assert "diagnosis" in result["triageResult"]
    assert len(result["triageResult"]["diagnosis"]) > 0
    assert "faucet" in result["triageResult"]["diagnosis"].lower()
```

#### Test: Text-Only Triage with Clear Query

```python
def test_triage_text_only_clear():
    """Test triage agent with clear text query"""
    input_data = {
        "user_query": "My kitchen faucet is dripping constantly and there's water pooling at the base"
    }
    
    result = triage_agent.run(input_data)
    
    assert "triageResult" in result
    assert "diagnosis" in result["triageResult"]
    assert "faucet" in result["triageResult"]["diagnosis"].lower()
    assert "leak" in result["triageResult"]["diagnosis"].lower() or \
           "drip" in result["triageResult"]["diagnosis"].lower()
```

#### Test: Text-Only Triage with Unclear Query

```python
def test_triage_text_only_unclear():
    """Test triage agent with unclear query requiring clarification"""
    input_data = {
        "user_query": "Something is wrong"
    }
    
    result = triage_agent.run(input_data)
    
    assert "triageResult" in result
    assert result["triageResult"].get("needs_clarification") == True
    assert "clarification_questions" in result["triageResult"]
    assert len(result["triageResult"]["clarification_questions"]) >= 1
    assert len(result["triageResult"]["clarification_questions"]) <= 3
```

#### Test: Clarification Loop

```python
def test_triage_clarification_loop():
    """Test iterative clarification until clear diagnosis"""
    # First query - unclear
    input_data = {
        "user_query": "I have a problem"
    }
    result1 = triage_agent.run(input_data)
    assert result1["triageResult"].get("needs_clarification") == True
    
    # Second query - more specific but still unclear
    input_data = {
        "user_query": "It's in the kitchen"
    }
    result2 = triage_agent.run(input_data)
    assert result2["triageResult"].get("needs_clarification") == True
    
    # Third query - clear
    input_data = {
        "user_query": "The kitchen faucet is leaking"
    }
    result3 = triage_agent.run(input_data)
    assert "diagnosis" in result3["triageResult"]
    assert result3["triageResult"].get("needs_clarification") != True
```

#### Test: Non-Property-Related Query

```python
def test_triage_non_property_query():
    """Test triage agent with non-property-related query"""
    input_data = {
        "user_query": "What's the weather today?"
    }
    
    result = triage_agent.run(input_data)
    
    assert "triageResult" in result
    assert "diagnosis" in result["triageResult"]
    assert "property care" in result["triageResult"]["diagnosis"].lower() or \
           "specialize" in result["triageResult"]["diagnosis"].lower()
```

### Coverage Agent Tests

#### Test: Coverage Retrieval with Warranty

```python
def test_coverage_agent_with_warranty():
    """Test coverage agent finding warranty information"""
    input_data = {
        "user_query": "faucet leak warranty",
        "context_doc_uris": ["gs://test-bucket/warranty.pdf"]
    }
    
    result = coverage_agent.run(input_data)
    
    assert "coverageResult" in result
    assert "warrantyInfo" in result["coverageResult"]
    assert len(result["coverageResult"]["warrantyInfo"]) > 0
```

#### Test: Coverage Retrieval with No Results

```python
def test_coverage_agent_no_results():
    """Test coverage agent when no coverage found"""
    input_data = {
        "user_query": "spaceship repair warranty",
        "context_doc_uris": []
    }
    
    result = coverage_agent.run(input_data)
    
    assert "coverageResult" in result
    assert "warrantyInfo" in result["coverageResult"]
    assert "no warranty" in result["coverageResult"]["warrantyInfo"].lower() or \
           "not found" in result["coverageResult"]["warrantyInfo"].lower()
```

### DIY Agent Tests

#### Test: DIY Steps Generation

```python
def test_diy_agent_steps():
    """Test DIY agent generating repair steps"""
    input_data = {
        "user_query": "fix leaking faucet"
    }
    
    result = diy_agent.run(input_data)
    
    assert "diyResults" in result
    assert "diySteps" in result["diyResults"]
    assert "steps" in result["diyResults"]["diySteps"]
    assert len(result["diyResults"]["diySteps"]["steps"]) > 0
    
    # Verify steps are numbered
    for i, step in enumerate(result["diyResults"]["diySteps"]["steps"]):
        assert step["stepNumber"] == i + 1
        assert len(step["description"]) > 0
```

#### Test: YouTube Video Search

```python
def test_diy_agent_youtube():
    """Test DIY agent finding YouTube videos"""
    input_data = {
        "user_query": "fix leaking faucet"
    }
    
    result = diy_agent.run(input_data)
    
    assert "diyResults" in result
    assert "youtubeSearch" in result["diyResults"]
    assert "videos" in result["diyResults"]["youtubeSearch"]
    
    if len(result["diyResults"]["youtubeSearch"]["videos"]) > 0:
        video = result["diyResults"]["youtubeSearch"]["videos"][0]
        assert "title" in video
        assert "url" in video
        assert "youtube.com" in video["url"]
```

#### Test: Product Recommendations

```python
def test_diy_agent_products():
    """Test DIY agent product recommendations"""
    input_data = {
        "user_query": "fix leaking faucet"
    }
    
    result = diy_agent.run(input_data)
    
    assert "diyResults" in result
    assert "recommendedProducts" in result["diyResults"]
    assert "products" in result["diyResults"]["recommendedProducts"]
    
    if len(result["diyResults"]["recommendedProducts"]["products"]) > 0:
        product = result["diyResults"]["recommendedProducts"]["products"][0]
        assert "item_name" in product
        assert "vendor" in product
        assert "store_url" in product
```

### Service Agent Tests

#### Test: Local Provider Search with Coordinates

```python
def test_service_agent_with_coordinates():
    """Test service agent finding local providers with coordinates"""
    input_data = {
        "user_query": "find plumber",
        "property_address": "San Francisco, CA",
        "location_coordinates": {"lat": 37.7749, "lng": -122.4194},
        "location_radius": 50
    }
    
    result = service_agent.run(input_data)
    
    assert "serviceResults" in result
    assert "localPros" in result["serviceResults"]
    
    # Check SerpAPI results
    if len(result["serviceResults"]["localPros"]["serpAPIResults"]) > 0:
        provider = result["serviceResults"]["localPros"]["serpAPIResults"][0]
        assert "name" in provider
        assert "phone" in provider or "address" in provider
        assert "distance" in provider  # Should have distance with coordinates
```

#### Test: Local Provider Search with Address Only

```python
def test_service_agent_with_address():
    """Test service agent finding local providers with address only"""
    input_data = {
        "user_query": "find electrician",
        "property_address": "123 Main St, San Francisco, CA"
    }
    
    result = service_agent.run(input_data)
    
    assert "serviceResults" in result
    assert "localPros" in result["serviceResults"]
    
    # Should have results from at least one source
    total_results = (
        len(result["serviceResults"]["localPros"]["serpAPIResults"]) +
        len(result["serviceResults"]["localPros"]["googleSearchResults"])
    )
    assert total_results > 0
```

#### Test: Service Agent Fallback

```python
@mock.patch('service_agent.serpapi_search', return_value=[])
@mock.patch('service_agent.serpapi_search', return_value=[])
def test_service_agent_fallback(mock_yelp, mock_serp):
    """Test service agent fallback to Google Search"""
    input_data = {
        "user_query": "find rare specialist",
        "property_address": "Remote Location"
    }
    
    result = service_agent.run(input_data)
    
    assert "serviceResults" in result
    assert "localPros" in result["serviceResults"]
    # Should use Google Search fallback
    assert len(result["serviceResults"]["localPros"]["googleSearchResults"]) > 0
```

### Cost Agent Tests

#### Test: Cost Estimation

```python
def test_cost_agent_estimation():
    """Test cost agent generating estimates"""
    input_data = {
        "user_query": "faucet leak repair cost"
    }
    
    result = cost_agent.run(input_data)
    
    assert "costEstimationResults" in result
    assert "costEstimates" in result["costEstimationResults"]
    
    estimates = result["costEstimationResults"]["costEstimates"]
    assert "DIY" in estimates
    assert "Service" in estimates
    assert "comparison" in estimates
    
    # Verify DIY section
    assert "cost_range" in estimates["DIY"]
    assert "$" in estimates["DIY"]["cost_range"]
    
    # Verify Service section
    assert "cost_range" in estimates["Service"]
    assert "$" in estimates["Service"]["cost_range"]
```

## Integration Tests

### Full Analysis Workflow

#### Test: Complete Analysis with All Agents

```python
def test_full_analysis_workflow():
    """Test complete analysis workflow with all agents"""
    input_data = {
        "user_query": "My kitchen faucet is leaking",
        "analysis_optional_agents": ["coverage", "diy", "service", "cost"]
    }
    
    result = analysis_agent.run(input_data)
    
    # Verify structure
    assert "analysis" in result
    assert "title" in result["analysis"]
    
    # Verify triage
    assert "triageResult" in result["analysis"]
    assert "diagnosis" in result["analysis"]["triageResult"]
    
    # Verify optional agents
    assert "coverageResult" in result["analysis"]
    assert "diyResults" in result["analysis"]
    assert "serviceResults" in result["analysis"]
    assert "costEstimationResults" in result["analysis"]
```

#### Test: Partial Agent Selection

```python
def test_partial_agent_selection():
    """Test analysis with only selected agents"""
    input_data = {
        "user_query": "My kitchen faucet is leaking",
        "analysis_optional_agents": ["diy", "cost"]
    }
    
    result = analysis_agent.run(input_data)
    
    # Should have triage (mandatory)
    assert "triageResult" in result["analysis"]
    
    # Should have selected agents
    assert "diyResults" in result["analysis"]
    assert "costEstimationResults" in result["analysis"]
    
    # Should NOT have unselected agents
    assert "coverageResult" not in result["analysis"]
    assert "serviceResults" not in result["analysis"]
```

#### Test: Clarification Stops Optional Agents

```python
def test_clarification_stops_optional_agents():
    """Test that clarification prevents optional agents from running"""
    input_data = {
        "user_query": "Something is wrong",
        "analysis_optional_agents": ["coverage", "diy", "service", "cost"]
    }
    
    result = analysis_agent.run(input_data)
    
    # Should have triage with clarification
    assert "triageResult" in result["analysis"]
    assert result["analysis"]["triageResult"].get("needs_clarification") == True
    
    # Should NOT have optional agents
    assert "coverageResult" not in result["analysis"]
    assert "diyResults" not in result["analysis"]
    assert "serviceResults" not in result["analysis"]
    assert "costEstimationResults" not in result["analysis"]
```

### API Integration Tests

#### Test: SerpAPI Integration

```python
@pytest.mark.integration
def test_serpapi_integration():
    """Test real SerpAPI integration"""
    result = serpapi_search(
        query="plumber",
        location="San Francisco, CA"
    )
    
    assert isinstance(result, list)
    if len(result) > 0:
        assert "name" in result[0]
        assert "address" in result[0] or "phone" in result[0]
```

#### Test: SerpAPI Integration

```python
@pytest.mark.integration
def test_yelp_integration():
    """Test real SerpAPI integration"""
    result = serpapi_search(
        query="electrician",
        location="San Francisco, CA",
        radius=80467  # 50 miles
    )
    
    assert isinstance(result, list)
    if len(result) > 0:
        assert "name" in result[0]
        assert "rating" in result[0]
        assert "reviews" in result[0]
```

#### Test: YouTube API Integration

```python
@pytest.mark.integration
def test_youtube_integration():
    """Test real YouTube API integration"""
    result = youtube_search(
        query="how to fix leaking faucet"
    )
    
    assert isinstance(result, list)
    if len(result) > 0:
        assert "title" in result[0]
        assert "url" in result[0]
        assert "youtube.com" in result[0]["url"]
```

#### Test: Vertex AI RAG Integration

```python
@pytest.mark.integration
def test_rag_integration():
    """Test real Vertex AI RAG integration"""
    result = ask_user_docs_retrieval(
        query="warranty information",
        user_id="test_user_123"
    )
    
    assert isinstance(result, str)
    # May return "no information found" if test corpus is empty
```

## End-to-End Tests

### Test: Complete User Journey

```python
@pytest.mark.e2e
def test_complete_user_journey():
    """Test complete user journey from upload to response"""
    # Step 1: Upload image
    with open("test_data/faucet_leak.jpg", "rb") as f:
        upload_response = client.post(
            "/api/agent/upload",
            files={"file": f},
            headers={"Authorization": f"Bearer {test_token}"}
        )
    assert upload_response.status_code == 200
    file_uri = upload_response.json()["file_uri"]
    
    # Step 2: Query agent
    query_response = client.post(
        "/api/agent/query",
        json={
            "user_query": "What's wrong with this?",
            "diagnosis_uris": [file_uri]
        },
        headers={"Authorization": f"Bearer {test_token}"}
    )
    assert query_response.status_code == 200
    
    # Step 3: Verify response
    result = query_response.json()
    assert result["status"] == "success"
    assert "response" in result
    assert "markdown" in result["response"]
    assert "json" in result["response"]
    
    # Step 4: Verify response structure
    analysis = result["response"]["json"]["analysis"]
    assert "title" in analysis
    assert "triageResult" in analysis
```

### Test: Telegram Bot Integration

```python
@pytest.mark.e2e
async def test_telegram_bot_integration():
    """Test Telegram bot handling photo message"""
    # Simulate Telegram photo message
    message = types.Message(
        message_id=123,
        from_user=types.User(id=456, is_bot=False, first_name="Test"),
        chat=types.Chat(id=789, type="private"),
        date=datetime.now(),
        photo=[
            types.PhotoSize(
                file_id="test_file_id",
                file_unique_id="unique",
                width=800,
                height=600,
                file_size=50000
            )
        ],
        caption="What's wrong with this faucet?"
    )
    
    # Process message
    response = await telegram_handler.handle_photo_message(message)
    
    # Verify response
    assert response is not None
    assert len(response) > 0
    assert "faucet" in response.lower()
```

### Test: Web App Integration

```python
@pytest.mark.e2e
def test_webapp_integration():
    """Test web app query flow"""
    # Simulate web app request
    response = client.post(
        "/api/agent/query",
        json={
            "user_query": "My kitchen faucet is leaking at the base",
            "property_address": "123 Main St, San Francisco, CA",
            "location_coordinates": {"lat": 37.7749, "lng": -122.4194},
            "analysis_optional_agents": ["coverage", "diy", "service", "cost"]
        },
        headers={"Authorization": f"Bearer {test_token}"}
    )
    
    assert response.status_code == 200
    result = response.json()
    
    # Verify dual format response
    assert "markdown" in result["response"]
    assert "json" in result["response"]
    
    # Verify JSON structure for web app parsing
    analysis = result["response"]["json"]["analysis"]
    assert all(key in analysis for key in [
        "title", "triageResult", "coverageResult",
        "diyResults", "serviceResults", "costEstimationResults"
    ])
```

## Performance Tests

### Load Testing

```python
@pytest.mark.performance
def test_load_concurrent_requests():
    """Test handling concurrent requests"""
    import concurrent.futures
    
    def make_request():
        return client.post(
            "/api/agent/query",
            json={"user_query": "fix leaking faucet"},
            headers={"Authorization": f"Bearer {test_token}"}
        )
    
    # Send 50 concurrent requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(make_request) for _ in range(50)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    
    # Verify all requests succeeded
    success_count = sum(1 for r in results if r.status_code == 200)
    assert success_count >= 45  # Allow 10% failure rate
```

### Response Time Testing

```python
@pytest.mark.performance
def test_response_times():
    """Test response times for different query types"""
    import time
    
    # Test 1: Text-only triage
    start = time.time()
    response = client.post(
        "/api/agent/query",
        json={"user_query": "My faucet is leaking"},
        headers={"Authorization": f"Bearer {test_token}"}
    )
    text_only_time = time.time() - start
    
    assert response.status_code == 200
    assert text_only_time < 10  # Should complete in under 10 seconds
    
    # Test 2: Full analysis
    start = time.time()
    response = client.post(
        "/api/agent/query",
        json={
            "user_query": "My faucet is leaking",
            "analysis_optional_agents": ["coverage", "diy", "service", "cost"]
        },
        headers={"Authorization": f"Bearer {test_token}"}
    )
    full_analysis_time = time.time() - start
    
    assert response.status_code == 200
    assert full_analysis_time < 30  # Should complete in under 30 seconds
```

## Test Data

### Sample Queries

```python
SAMPLE_QUERIES = {
    "clear_plumbing": "My kitchen faucet is dripping constantly and there's water pooling at the base",
    "clear_electrical": "The outlet in my bedroom stopped working and won't charge my phone",
    "clear_hvac": "My air conditioner is running but not cooling the house",
    "clear_pest": "I have ants in my kitchen, they're coming from under the sink",
    "unclear": "Something is wrong",
    "vague": "I need help",
    "non_property": "What's the weather today?",
    "casual": "Hello, how are you?"
}
```

### Sample Media Files

```
test_data/
├── faucet_leak.jpg          # Clear image of leaking faucet
├── electrical_outlet.jpg    # Image of electrical outlet
├── hvac_unit.jpg           # Image of HVAC unit
├── pest_infestation.jpg    # Image of pest problem
├── warranty.pdf            # Sample warranty document
├── insurance_policy.pdf    # Sample insurance policy
└── appliance_manual.pdf    # Sample appliance manual
```

## Test Execution

### Running Tests

```bash
# Run all tests
pytest tests/

# Run unit tests only
pytest tests/unit/

# Run integration tests
pytest tests/integration/ -m integration

# Run E2E tests
pytest tests/e2e/ -m e2e

# Run performance tests
pytest tests/performance/ -m performance

# Run with coverage
pytest --cov=gcp/agents/homecare --cov-report=html
```

### Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test Analysis Agent

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio
      
      - name: Run unit tests
        run: pytest tests/unit/ --cov --cov-report=xml
      
      - name: Run integration tests
        run: pytest tests/integration/ -m integration
        env:
          GOOGLE_CLOUD_PROJECT: ${{ secrets.GCP_PROJECT }}
          SERPAPI_KEY: ${{ secrets.SERPAPI_KEY }}
          : ${{ secrets. }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Test Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| Triage Agent | 90% |
| Coverage Agent | 85% |
| DIY Agent | 85% |
| Service Agent | 85% |
| Cost Agent | 85% |
| Shopping Agent | 85% |
| Analysis Orchestrator | 95% |
| API Integration | 80% |
| **Overall** | **85%** |

## Validation Checklist

### Before Release

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] E2E tests passing for all client types
- [ ] Performance benchmarks met
- [ ] Test coverage above 85%
- [ ] No critical security vulnerabilities
- [ ] API rate limits tested
- [ ] Error handling validated
- [ ] Documentation updated
- [ ] User acceptance testing completed

### Manual Testing Scenarios

1. **Multimodal Analysis**
   - Upload various image types
   - Upload video files
   - Upload PDF documents
   - Verify accurate diagnosis

2. **Text-Only Triage**
   - Test clear queries
   - Test unclear queries
   - Test clarification loop
   - Test non-property queries

3. **Location-Based Services**
   - Test with coordinates
   - Test with address only
   - Test with no location
   - Verify distance calculations

4. **Coverage Retrieval**
   - Test with warranty documents
   - Test with insurance policies
   - Test with no documents
   - Verify accurate extraction

5. **DIY Guidance**
   - Verify step quality
   - Check video relevance
   - Validate product recommendations
   - Test various repair types

6. **Service Provider Search**
   - Verify provider quality
   - Check distance accuracy
   - Validate contact information
   - Test fallback mechanisms

7. **Cost Estimates**
   - Verify cost ranges
   - Check DIY vs Professional comparison
   - Validate recommendations
   - Test various repair types

## Bug Tracking

### Known Issues

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| BUG-001 | SerpAPI timeout on rare searches | Low | Open |
| BUG-002 | YouTube quota exceeded handling | Medium | Fixed |
| BUG-003 | RAG retrieval slow for large docs | Low | Open |

### Issue Template

```markdown
## Bug Report

**Description**: Brief description of the issue

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happens

**Environment**:
- Agent Version: 
- Client Type: 
- User ID: 

**Logs**: Relevant log entries

**Screenshots**: If applicable
```
