# Performance Optimization Guide for Sub-Agents (Coverage, DIY, Cost, Service)

This guide explains how to improve the speed of sub-agents like coverage, diy, cost, and service through both **Vertex AI deployment configuration** and **code-level optimizations**.

## Current Architecture

The sub-agents are currently executed **sequentially** by the analysis agent:

1. Triage Agent (always runs first)
2. Coverage Agent (if in `analysis_optional_agents`)
3. DIY Agent (if in `analysis_optional_agents`)
4. Service Agent (if in `analysis_optional_agents`)
5. Cost Agent (if in `analysis_optional_agents`)

## Optimization Strategies

### 1. Vertex AI Deployment Configuration (Recommended First Step)

The **Vertex AI Reasoning Engine** (Agent Engine) supports deployment parameters that significantly impact performance:

#### A. Configure `min_instances` to Reduce Cold Starts

**Problem**: Cold starts add ~4.7 seconds of latency when no instances are available.

**Solution**: Set `min_instances` to handle baseline traffic (max: 10).

**Impact**: Reduces cold start latency from 4.7s to ~1.4s.

#### B. Increase `container_concurrency` for Parallel Requests

**Problem**: Default `container_concurrency=9` may underutilize asynchronous workers for ADK-based agents.

**Solution**: Increase to a multiple of 9 (e.g., 36) to allow each instance to handle more concurrent requests.

**Impact**: Reduces maximum latency spikes from 60s to ~7s under load.

#### Implementation

Update `gcp/agents/homecare/deployment/deploy.py` to include deployment parameters in the `config` dictionary:

```python
# Add after line 89 (after display_name definition)
# Create config dictionary with deployment parameters
deployment_config = {
    "min_instances": 10,  # Reduce cold starts (max: 10, default: 1)
    "max_instances": 100,  # Maximum instances (default: 100)
    "container_concurrency": 36,  # For ADK agents, use multiples of 9 (default: 9)
    # Optional: Adjust resource limits if needed
    # "resource_limits": {
    #     "cpu": "4",  # Options: 1, 2, 4, 6, 8
    #     "memory": "8Gi"  # Options: 1Gi, 2Gi, ... 32Gi
    # }
}

# Merge with existing config parameters
config = {
    "requirements": common_requirements,
    "extra_packages": extra_packages,
    "display_name": display_name,
    "env_vars": common_env_vars,
    **deployment_config  # Merge deployment config
}

# Update agent_engines.create() call (around line 110)
remote_app = agent_engines.create(
    app,
    config=config  # Pass config as a dictionary
)

# Update agent_engines.update() call (around line 121)
updated_app = agent_engines.update(
    resource_name=AGENT_ENGINE_ID,
    agent_engine=app,
    config=config  # Pass config as a dictionary
)
```

**Note**: According to the Vertex AI API documentation, these parameters are passed in the `config` dictionary when calling `agent_engines.create()` or `agent_engines.update()`.

### 2. Use Optional Agents Feature (Quick Win)

**Current Behavior**: All optional agents (coverage, diy, service, cost) run by default.

**Optimization**: Use the `analysis_optional_agents` field to skip unnecessary agents.

**Example**: If a user only needs cost estimates, pass:

```python
analysis_optional_agents = ["cost"]  # Skip coverage, diy, service
```

**Implementation**: Already supported! Just pass the desired agents in the request:

- Frontend: Set `analysis_optional_agents` in the API request
- Backend: Already handled in `vertex_service.py` line 154

### 3. Code-Level Parallelization (Advanced)

**Current Limitation**: Sub-agents run sequentially even though they're independent (coverage, diy, service, cost don't depend on each other).

**Potential Solution**: Use `ParallelAgent` from ADK to run independent agents concurrently.

**Note**: This requires careful consideration because:

- The analysis agent orchestrator currently calls agents sequentially via instructions
- Parallel execution would require restructuring the agent logic
- Some agents might have dependencies (e.g., cost agent might benefit from service results)

**Implementation Approach** (if pursuing):

1. Modify `analysis_agent/agent.py` to use `ParallelAgent` for independent sub-agents:

```python
from google.adk.agents import ParallelAgent

# Create a parallel agent group for independent sub-agents
optional_agents_group = ParallelAgent(
    name='optional_agents_group',
    agents=[
        coverage_agent,
        diy_agent,
        service_agent,
        cost_agent
    ]
)

# Then use this group in analysis_agent
analysis_agent = Agent(
    name='analysis_agent',
    model='gemini-2.5-flash',
    description="Orchestrates Triage and optional agents.",
    instruction=analysis_agent_instructions(),
    tools=[
        AgentTool(triage_agent),
        AgentTool(optional_agents_group)  # Runs all in parallel
    ],
    input_schema=DiagnosisInput,
    disallow_transfer_to_parent=True,
    before_tool_callback=before_tool_callback
)
```

**Caveat**: This approach requires updating the agent instructions to handle parallel results and may not work seamlessly with the current sequential instruction-based flow.

### 4. Optimize External API Calls

**Current**: Each agent makes external API calls (SerpAPI, Yelp, YouTube, Google Search, RAG).

**Optimization**: Some agents already parallelize their internal tool calls (e.g., DIY agent runs Google Search + YouTube + Shopping in parallel).

**Recommendation**: Ensure all agents maximize parallel tool execution where possible.

## Recommended Action Plan

### Phase 1: Quick Wins (Do First)

1. ✅ **Configure `min_instances`** in deployment (reduces cold starts)
2. ✅ **Increase `container_concurrency`** (improves concurrent request handling)
3. ✅ **Use `analysis_optional_agents`** to skip unnecessary agents

### Phase 2: Code Optimization (If Needed)

1. Review agent instructions to ensure optimal tool call patterns
2. Consider parallelizing independent sub-agents (requires testing)
3. Optimize external API call patterns within each agent

### Phase 3: Monitoring

1. Monitor latency metrics before/after changes
2. Track cold start frequency
3. Measure sub-agent execution times

## Testing Performance Improvements

After making changes:

1. **Deploy updated agent**:

   ```bash
   cd gcp/agents/homecare
   make update
   ```

2. **Monitor metrics**:
   - Check Vertex AI Console → Agent Engine → Metrics
   - Look for: Request latency, Cold start frequency, Concurrent requests

3. **Load testing**:
   - Send concurrent requests to measure improvements
   - Compare latency before/after changes

## References

- [Vertex AI Agent Engine Optimization Guide](https://docs.cloud.google.com/agent-builder/agent-engine/optimize-runtime)
- [ADK Documentation](https://cloud.google.com/agent-builder/agent-development-kit/overview)
- Current deployment script: `gcp/agents/homecare/deployment/deploy.py`
- Agent orchestration: `gcp/agents/homecare/property_agent/sub_agents/analysis_agent/agent.py`
