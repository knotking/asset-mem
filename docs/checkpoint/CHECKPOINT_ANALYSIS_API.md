# Checkpoint Analysis API Reference

## Overview

This document provides detailed API reference for the Checkpoint Analysis feature, including request/response formats, parameters, and integration examples.

## Endpoints

### Agent SSE Endpoint

**URL**: `/api/agent/sse`  
**Method**: `POST`  
**Content-Type**: `application/json`  
**Response**: Server-Sent Events (SSE) stream

## Request Schema

### Base Request

```typescript
interface AgentRequest {
  user_id: string;                    // Required: Firebase user ID
  session_id?: string;                // Optional: Agent session ID
  user_query: string;                 // Required: User's question
  property_id?: string;               // Required for checkpoint queries
  primary_agent: 'analysis' | 'checkpoint';  // Required: Agent type
  
  // Checkpoint-specific fields
  checkpoint_ids?: string[];          // Optional: Specific checkpoint IDs
  checkpoint_optional_agents?: CheckpointOptionalAgent[];  // Optional: Analysis agents
  
  // Context fields
  context_doc_uris?: string[];        // Optional: Document URIs for coverage
  diagnosis_uris?: string[];          // Optional: Media URIs for analysis
  property_address?: string;          // Optional: Property address
  
  // Location fields (for service agent)
  location_type?: 'address' | 'location';
  location_coordinates?: {
    lat: number;
    lng: number;
  };
  location_radius?: number;           // Miles, default: 5
  
  // Analysis agent fields
  analysis_optional_agents?: AnalysisOptionalAgent[];
}

type CheckpointOptionalAgent = 'coverage' | 'diy' | 'service' | 'cost';
type AnalysisOptionalAgent = 'coverage' | 'diy' | 'service' | 'cost';
```

### Checkpoint Analysis Request

```typescript
// Simple Query (No Optional Agents)
{
  "user_id": "user123",
  "session_id": "session456",
  "user_query": "What changed in my kitchen?",
  "property_id": "prop789",
  "primary_agent": "checkpoint",
  "checkpoint_ids": ["cp1", "cp2", "cp3"]
}

// Analysis with Optional Agents
{
  "user_id": "user123",
  "session_id": "session456",
  "user_query": "Analyze my bathroom checkpoints and give me DIY solutions",
  "property_id": "prop789",
  "primary_agent": "checkpoint",
  "checkpoint_ids": ["cp4", "cp5"],
  "checkpoint_optional_agents": ["diy", "cost"],
  "context_doc_uris": ["gs://bucket/warranty.pdf"],
  "property_address": "123 Main St, San Francisco, CA"
}

// Full Analysis with Location
{
  "user_id": "user123",
  "session_id": "session456",
  "user_query": "Complete analysis of all property issues",
  "property_id": "prop789",
  "primary_agent": "checkpoint",
  "checkpoint_optional_agents": ["coverage", "diy", "service", "cost"],
  "context_doc_uris": ["gs://bucket/warranty.pdf", "gs://bucket/insurance.pdf"],
  "property_address": "123 Main St, San Francisco, CA",
  "location_type": "location",
  "location_coordinates": {
    "lat": 37.7749,
    "lng": -122.4194
  },
  "location_radius": 10
}
```

## Response Schema

### SSE Stream Format

The response is a Server-Sent Events stream with the following event types:

```
event: agent_step
data: {"name": "checkpoint_agent", "status": "executing"}

event: chunk
data: {"content": "Based on your checkpoints..."}

event: complete
data: {"final_response": "..."}
```

### Response Structure

#### Simple Query Response

```typescript
// Plain text response
"Based on your checkpoints, I found 3 relevant checkpoints:

Checkpoint 'Kitchen Inspection - Jan 2026' from Kitchen:
Water damage detected under sink, loose cabinet door.

Checkpoint 'Kitchen Follow-up - Feb 2026' from Kitchen:
Water damage persists, cabinet door repaired."
```

#### Analysis Response (Dual Format)

**Markdown (First)**:
```markdown
# Kitchen Checkpoint Analysis

## Checkpoint Summary
- **Checkpoints Analyzed**: 3
- **Issues Detected**: Water damage under sink, loose cabinet door, grout discoloration
- **Locations**: Kitchen, Bathroom
- **Overall Condition**: Moderate issues requiring attention

## Coverage Information
Your home warranty covers plumbing repairs under the Premium Plan...

## DIY Solutions

### Repair Steps
1. Turn off water supply to sink
2. Inspect pipe connections for leaks
3. Tighten loose connections with wrench
4. Replace damaged pipes if necessary

### Video Tutorials
- [How to Fix a Leaky Sink](https://youtube.com/watch?v=...)
- [Cabinet Repair Guide](https://youtube.com/watch?v=...)

### Recommended Products
- Pipe Wrench Set - $29.99 (Home Depot)
- Plumber's Tape - $4.99 (Amazon)

## Local Service Providers

### Top Plumbers Near You
1. **ABC Plumbing** - 4.8★ (245 reviews)
   - Distance: 1.2 miles
   - Phone: (555) 123-4567
   
2. **Quick Fix Plumbing** - 4.6★ (189 reviews)
   - Distance: 2.5 miles
   - Phone: (555) 987-6543

## Cost Estimates

### DIY Approach
- **Cost Range**: $50-150
- **Includes**: Materials, basic tools, your time
- **Complexity**: Moderate - requires basic plumbing skills

### Professional Service
- **Cost Range**: $200-500
- **Includes**: Labor, expertise, warranty
- **Complexity**: Simple - professional handles everything

### Comparison
- **DIY Savings**: $150-350 (60-70% savings)
- **Professional Benefits**: Guaranteed work, faster completion, proper diagnosis
```

**JSON (Second)**:
```json
{
  "checkpointAnalysis": {
    "title": "Kitchen Checkpoint Analysis",
    "checkpointSummary": {
      "checkpointsAnalyzed": 3,
      "issuesDetected": [
        "Water damage under sink",
        "Loose cabinet door",
        "Grout discoloration"
      ],
      "overallCondition": "Moderate issues requiring attention",
      "locations": ["Kitchen", "Bathroom"]
    },
    "coverageResult": {
      "warrantyInfo": "Your home warranty covers plumbing repairs...",
      "insuranceInfo": "Standard homeowner's policy may cover water damage..."
    },
    "diyResults": {
      "diySteps": {
        "summary": "Fix leaky sink and repair cabinet",
        "steps": [
          "Turn off water supply to sink",
          "Inspect pipe connections for leaks",
          "Tighten loose connections with wrench",
          "Replace damaged pipes if necessary"
        ]
      },
      "youtubeSearch": {
        "videos": [
          {
            "title": "How to Fix a Leaky Sink",
            "url": "https://youtube.com/watch?v=...",
            "description": "Step-by-step guide to fixing common sink leaks"
          }
        ]
      },
      "recommendedProducts": {
        "products": [
          {
            "vendor": "Home Depot",
            "url": "https://homedepot.com/...",
            "description": "Pipe Wrench Set",
            "price": "$29.99"
          }
        ]
      }
    },
    "serviceResults": {
      "localPros": {
        "serpAPIResults": [
          {
            "name": "ABC Plumbing",
            "rating": 4.8,
            "reviews": 245,
            "distance": "1.2 miles",
            "phone": "(555) 123-4567",
            "address": "456 Oak St, San Francisco, CA"
          }
        ],
        "googleSearchResults": [
          {
            "name": "Quick Fix Plumbing",
            "rating": 4.6,
            "review_count": 189,
            "distance": 2.5,
            "phone": "(555) 987-6543"
          }
        ]
      }
    },
    "costEstimationResults": {
      "costEstimates": {
        "repair_type": "Plumbing leak repair",
        "DIY": {
          "cost_range": "$50-150",
          "includes": ["Materials", "Basic tools", "Your time"],
          "savings": "$150-350 compared to professional",
          "complexity": "Moderate - requires basic plumbing skills"
        },
        "Service": {
          "cost_range": "$200-500",
          "includes": ["Labor", "Expertise", "Warranty"],
          "benefits": "Guaranteed work, faster completion",
          "complexity": "Simple - professional handles everything"
        },
        "comparison": {
          "diy_savings": "60-70% savings",
          "professional_benefits": "Warranty, expertise, time savings",
          "considerations": "DIY requires skills and tools"
        }
      }
    }
  }
}
```

## Request Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | string | Firebase user ID |
| `user_query` | string | User's question or request |
| `property_id` | string | Property ID (required for checkpoint queries) |
| `primary_agent` | string | Must be "checkpoint" for checkpoint analysis |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `session_id` | string | null | Agent session ID for conversation continuity |
| `checkpoint_ids` | string[] | null | Specific checkpoint IDs to analyze |
| `checkpoint_optional_agents` | string[] | [] | Optional analysis agents to invoke |
| `context_doc_uris` | string[] | [] | Document URIs for coverage checks |
| `property_address` | string | null | Property address for location-based services |
| `location_type` | string | "address" | "address" or "location" |
| `location_coordinates` | object | null | {lat, lng} for precise location |
| `location_radius` | number | 5 | Search radius in miles (10-100) |

### checkpoint_optional_agents Values

| Value | Description | Output Section |
|-------|-------------|----------------|
| `"coverage"` | Check warranty/insurance | `coverageResult` |
| `"diy"` | DIY solutions and products | `diyResults` |
| `"service"` | Local service providers | `serviceResults` |
| `"cost"` | Cost estimates | `costEstimationResults` |

**Note**: Agents execute in canonical order: coverage → diy → service → cost

## Response Fields

### checkpointSummary

| Field | Type | Description |
|-------|------|-------------|
| `checkpointsAnalyzed` | number | Number of checkpoints analyzed |
| `issuesDetected` | string[] | List of detected issues |
| `overallCondition` | string | Overall condition assessment |
| `locations` | string[] | Locations/areas analyzed |

### coverageResult

| Field | Type | Description |
|-------|------|-------------|
| `warrantyInfo` | string | Warranty coverage information |
| `insuranceInfo` | string | Insurance coverage information |

### diyResults

| Field | Type | Description |
|-------|------|-------------|
| `diySteps.summary` | string | Summary of DIY approach |
| `diySteps.steps` | string[] | Step-by-step instructions |
| `youtubeSearch.videos` | object[] | Video tutorial links |
| `recommendedProducts.products` | object[] | Product recommendations |

### serviceResults

| Field | Type | Description |
|-------|------|-------------|
| `localPros.serpAPIResults` | object[] | Google search results |
| `localPros.googleSearchResults` | object[] | SerpAPI search results |
| `localPros.googleSearchResults` | object[] | Fallback search results |

### costEstimationResults

| Field | Type | Description |
|-------|------|-------------|
| `costEstimates.repair_type` | string | Type of repair |
| `costEstimates.DIY` | object | DIY cost breakdown |
| `costEstimates.Service` | object | Professional cost breakdown |
| `costEstimates.comparison` | object | Cost comparison |

## Error Responses

### No Checkpoints Found

```json
{
  "error": "no_checkpoints",
  "message": "No matching checkpoints found for your query. Try rephrasing your question or check if you have any checkpoints created."
}
```

### Missing Property ID

```json
{
  "error": "missing_property_id",
  "message": "Property ID is required for checkpoint queries."
}
```

### Invalid Optional Agents

```json
{
  "error": "invalid_optional_agents",
  "message": "Invalid optional agent names. Allowed values: coverage, diy, service, cost",
  "invalid_agents": ["invalid_agent_name"]
}
```

### Analysis Failed

```json
{
  "checkpointAnalysis": {
    "title": "Analysis Partially Completed",
    "checkpointSummary": { /* ... */ },
    "error": "Some optional agents failed to complete",
    "failed_agents": ["service"],
    "diyResults": { /* ... */ },
    "costEstimationResults": { /* ... */ }
  }
}
```

## Integration Examples

### JavaScript/TypeScript (Webapp)

```typescript
async function analyzeCheckpoints(
  checkpointIds: string[],
  optionalAgents: CheckpointOptionalAgent[]
) {
  const response = await fetch('/api/agent/sse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.uid,
      session_id: sessionId,
      user_query: 'Analyze my checkpoints',
      property_id: propertyId,
      primary_agent: 'checkpoint',
      checkpoint_ids: checkpointIds,
      checkpoint_optional_agents: optionalAgents,
      property_address: property.address,
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        if (data.content) {
          // Handle content chunk
          updateMessage(data.content);
        }
      }
    }
  }
}
```

### React Native (Mobile App)

```typescript
import { streamAgentResponse } from '@/lib/api';

async function analyzeCheckpoints(
  checkpointIds: string[],
  optionalAgents: CheckpointOptionalAgent[]
) {
  await streamAgentResponse({
    userId: user.uid,
    agentSessionId: sessionId,
    userQuery: 'Analyze my checkpoints',
    propertyAddress: property.address,
    primaryAgent: 'checkpoint',
    checkpointIds,
    checkpointOptionalAgents: optionalAgents,
    locationData: {
      locationType: 'location',
      locationCoordinates: { lat: 37.7749, lng: -122.4194 },
      locationRadius: 5,
    },
    signal: abortController.signal,
    onChunk: (chunk) => {
      // Handle content chunk
      updateMessage(chunk);
    },
    onAgentStep: (step) => {
      // Handle agent step update
      updateAgentSteps(step);
    },
    onComplete: (finalResponse) => {
      // Handle completion
      saveMessage(finalResponse);
    },
    onError: (error) => {
      // Handle error
      showError(error.message);
    },
  });
}
```

### Python (Backend Testing)

```python
import requests
import json

def analyze_checkpoints(
    user_id: str,
    property_id: str,
    checkpoint_ids: list[str],
    optional_agents: list[str]
):
    url = "https://api.example.com/api/agent/sse"
    
    payload = {
        "user_id": user_id,
        "user_query": "Analyze my checkpoints",
        "property_id": property_id,
        "primary_agent": "checkpoint",
        "checkpoint_ids": checkpoint_ids,
        "checkpoint_optional_agents": optional_agents,
    }
    
    response = requests.post(
        url,
        json=payload,
        stream=True,
        headers={"Content-Type": "application/json"}
    )
    
    for line in response.iter_lines():
        if line:
            decoded_line = line.decode('utf-8')
            if decoded_line.startswith('data: '):
                data = json.loads(decoded_line[6:])
                if 'content' in data:
                    print(data['content'], end='', flush=True)
```

## Rate Limiting

- **Rate Limit**: 60 requests per minute per user
- **Concurrent Requests**: 3 simultaneous requests per user
- **Timeout**: 60 seconds per request

## Best Practices

### 1. Checkpoint Selection
- Limit to 10 checkpoints per analysis for optimal performance
- Select relevant checkpoints based on user query
- Use checkpoint_ids to filter specific checkpoints

### 2. Optional Agent Selection
- Only select agents needed for the user's query
- Full analysis (all agents) takes 20-40 seconds
- Single agent analysis takes 5-10 seconds

### 3. Location Data
- Provide location_coordinates for accurate service searches
- Use appropriate location_radius (5-10 miles typical)
- Include property_address as fallback

### 4. Error Handling
- Implement retry logic for transient failures
- Handle partial results gracefully
- Display user-friendly error messages

### 5. Response Parsing
- Parse both Markdown and JSON formats
- Extract structured data from JSON for programmatic use
- Display Markdown for human-readable output

## Versioning

**Current Version**: 1.0  
**API Stability**: Stable  
**Breaking Changes**: None planned

## Support

For API support or questions:
- Documentation: `/docs/checkpoint/`
- Issues: GitHub Issues
- Email: support@example.com
