# Checkpoint Analysis Agent

## Overview

The Checkpoint Analysis Agent is an orchestrator that provides comprehensive recommendations based on checkpoint data. It analyzes property condition information from checkpoints and coordinates specialized sub-agents to deliver coverage information, DIY solutions, service provider recommendations, and cost estimates.

## Purpose

When users want actionable recommendations based on their property checkpoints, this agent:
- Extracts issues and conditions from checkpoint data
- Synthesizes problems into clear problem statements
- Coordinates coverage, DIY, service, and cost agents
- Returns structured recommendations in dual format (Markdown + JSON)

## Architecture

```
Checkpoint Analysis Agent (Orchestrator)
├── Coverage Agent (warranty/insurance info)
├── DIY Agent (repair guides, videos, products)
├── Service Agent (local professionals)
└── Cost Agent (DIY vs professional cost comparison)
```

## Input Schema

```python
{
  "checkpoint_results": str,  # REQUIRED - checkpoint retrieval results
  "user_query": str,  # REQUIRED - original user query
  "checkpoint_optional_agents": List[str],  # REQUIRED - agents to invoke
  "context_doc_uris": Optional[List[str]],  # For coverage checks
  "property_address": Optional[str],  # For location-based services
  "property_id": Optional[str],  # Property reference
  "location_coordinates": Optional[Dict],  # For service searches
  "location_radius": Optional[int]  # Search radius in miles
}
```

### checkpoint_optional_agents

Allowed values: `["coverage", "diy", "service", "cost"]`

- **coverage**: Check warranty/insurance for detected issues
- **diy**: Provide repair guides, videos, and product recommendations
- **service**: Find local professionals for the issues
- **cost**: Generate DIY vs professional cost estimates

Optional branches are executed in parallel and then synthesized into a single final response.

## Workflow

1. **Issue Extraction**
   - Parse checkpoint_results to identify issues, conditions, and problems
   - Extract locations, detected items, and areas of concern
   - Synthesize into clear problem statement

2. **Agent Orchestration**
   - Run optional agent branches in parallel via Python (`CheckpointOptionalParallelAgent`; no LLM hop)
   - Each branch no-ops unless its agent key is present in `checkpoint_optional_agents`
   - Collect branch outputs and synthesize one final response (single LLM synthesis step)

3. **Response Assembly**
   - Combine all results into structured format
   - Include checkpoint summary (count, issues, locations)
   - Return dual format (Markdown + JSON)

## Output Format

### ⚠️ CRITICAL: Dual Format Response (BOTH Required)

The agent **MUST ALWAYS** return both formats. Never return only markdown without JSON.

**Markdown (First):**
```markdown
# Checkpoint Analysis: Kitchen & Bathroom Issues

## Checkpoint Summary
- **Checkpoints Analyzed**: 3
- **Issues Detected**: Water damage, cracked tile, loose cabinet
- **Locations**: Kitchen, Bathroom
- **Overall Condition**: Moderate issues requiring attention

## Coverage Information
[Coverage agent results if requested]

## DIY Solutions
[DIY agent results if requested]

## Local Service Providers
[Service agent results if requested]

## Cost Estimates
[Cost agent results if requested]
```

**JSON (Second - MANDATORY):**
```json
{
  "analysis": {
    "title": "Checkpoint Analysis: Kitchen & Bathroom Issues",
    "checkpointSummary": {
      "checkpointsAnalyzed": 3,
      "issuesDetected": ["Water damage under sink", "Cracked tile", "Loose cabinet door"],
      "overallCondition": "Moderate issues requiring attention",
      "locations": ["Kitchen", "Bathroom"]
    },
    "coverageResult": { /* if coverage agent called */ },
    "diyResults": { /* if diy agent called */ },
    "serviceResults": { /* if service agent called */ },
    "costEstimationResults": { /* if cost agent called */ }
  }
}
```

**Why Both Formats:**
- **Markdown**: For messaging platforms (Telegram, etc.) and human readability
- **JSON**: For webapp and mobile app to render structured dropdowns/accordions
- Without JSON, the web/mobile UI cannot display the interactive dropdown interface

## Usage Example

### Scenario: User wants DIY and cost recommendations for checkpoint issues

**Input:**
```python
{
  "checkpoint_results": "Checkpoint 'Kitchen Inspection' shows water stain under sink...",
  "user_query": "Give me DIY solutions for my kitchen checkpoint issues",
  "checkpoint_optional_agents": ["diy", "cost"],
  "property_address": "123 Main St, San Francisco, CA"
}
```

**Process:**
1. Extract issue: "Water leak under kitchen sink"
2. Call diy_agent with synthesized problem
3. Call cost_agent with synthesized problem
4. Return combined results with checkpoint summary

**Output:**
- Markdown summary with DIY steps and cost comparison
- JSON with structured diyResults and costEstimationResults
- No coverage or service sections (not requested)

## Integration

### Called By
- Checkpoint Agent (when checkpoint_optional_agents is non-empty)

### Calls
- Coverage Agent (if "coverage" in optional agents)
- DIY Agent (if "diy" in optional agents)
- Service Agent (if "service" in optional agents)
- Cost Agent (if "cost" in optional agents)

## Key Features

- **Flexible**: Users choose which analysis aspects they want
- **Comprehensive**: Combines multiple specialized agents
- **Context-Aware**: Uses checkpoint data to tailor recommendations
- **Dual Format**: Supports both messaging platforms and web apps
- **Issue Synthesis**: Intelligently combines multiple checkpoint issues
- **Unified Format**: Uses the same `analysis` root key as the Analysis Agent for consistent parsing across webapp and mobile app
- **Distinguishing Field**: The `checkpointSummary` field identifies checkpoint-based analyses vs regular analysis responses

## Model

- **Primary Model**: Gemini 2.5 Flash
- **Sub-Agents**: Each uses their own configured model

## Error Handling

- Gracefully handles missing optional parameters
- Returns partial results if some agents fail
- Provides clear error messages in response
- Maintains backward compatibility with simple checkpoint queries

## Future Enhancements

- Support for multi-property checkpoint analysis
- Trend analysis across checkpoint history
- Predictive maintenance recommendations
- Integration with property value impact assessments
