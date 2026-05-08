# Analysis Agent Workflow

## Overview

This document details the complete workflow of the Analysis Agent, from receiving a user query to returning a comprehensive analysis with actionable recommendations.

## Workflow Phases

### Phase 1: Input Reception and Validation

#### Input Schema
```json
{
  "user_query": "string (REQUIRED)",
  "diagnosis_uris": ["gs://bucket/file.jpg"] (optional),
  "context_doc_uris": ["gs://bucket/warranty.pdf"] (optional),
  "property_address": "123 Main St, City, State" (optional),
  "location_coordinates": {"lat": 37.7749, "lng": -122.4194} (optional),
  "location_radius": 50 (optional, default: 50 miles),
  "property_id": "prop_123" (optional),
  "analysis_optional_agents": ["coverage", "diy", "service", "cost"] (optional)
}
```

#### Field Descriptions

**Required Fields:**
- `user_query`: The user's question or problem description (minimum required field)

**Optional Fields:**
- `diagnosis_uris`: GCS URIs of media files for multimodal analysis (images, videos, documents)
- `context_doc_uris`: GCS URIs of context documents (warranties, manuals, insurance policies)
- `property_address`: Address of the property for location-based services
- `location_coordinates`: GPS coordinates for precise location-based search
- `location_radius`: Search radius in miles for finding local service providers (default: 50)
- `property_id`: Property identifier for property-specific queries
- `analysis_optional_agents`: List of optional agents to run after triage

#### Validation Rules
- `user_query` must be present and non-empty
- All other fields are optional and handled gracefully if missing
- `diagnosis_uris` and `context_doc_uris` must be valid GCS URIs if provided
- `analysis_optional_agents` must contain only valid values: "coverage", "diy", "service", "cost"
- Invalid or empty `analysis_optional_agents` defaults to all agents

### Phase 2: Triage (Mandatory First Step)

The Triage Agent is **always called first** and determines the problem diagnosis.

#### 2.1 Multimodal Triage (when diagnosis_uris provided)

**Process:**
1. Extract first URI from `diagnosis_uris`
2. Call `analyse_multimodal_data(user_query, gcs_url)`
3. Gemini 2.5 Flash analyzes the media file
4. Extract problem description from analysis
5. Return diagnosis in structured format

**Example:**
```
Input: 
- user_query: "What's wrong with this?"
- diagnosis_uris: ["gs://bucket/faucet_leak.jpg"]

Output:
{
  "triageResult": {
    "diagnosis": "Kitchen faucet showing active water leak from base connection. Visible water pooling around faucet base suggests loose connection or worn O-ring seal."
  }
}
```

#### 2.2 Text-Only Triage (when diagnosis_uris absent)

**Process:**
1. Analyze `user_query` for clarity and actionability
2. Determine if query is:
   - **Clear and actionable**: Proceed with diagnosis
   - **Unclear or vague**: Ask clarification questions
   - **Not applicable**: Politely redirect to property-related topics

**Clear Query Example:**
```
Input:
- user_query: "My kitchen faucet is dripping constantly and there's water pooling at the base"

Output:
{
  "triageResult": {
    "diagnosis": "Kitchen faucet with constant dripping and water pooling at base, indicating likely worn O-ring seal or loose base connection."
  }
}
```

**Unclear Query Example:**
```
Input:
- user_query: "Something is wrong"

Output:
{
  "triageResult": {
    "needs_clarification": true,
    "clarification_questions": [
      "What type of issue are you experiencing (plumbing, electrical, appliance, etc.)?",
      "Can you describe any visible symptoms or unusual behavior?",
      "When did you first notice this problem?"
    ],
    "message": "I need a bit more information to help you effectively. Please answer these questions:"
  }
}
```

**Not Applicable Example:**
```
Input:
- user_query: "What's the weather today?"

Output:
{
  "triageResult": {
    "diagnosis": "I specialize in property care including repairs, maintenance, pest control, service recommendations, and product advice. Please provide details about a specific property-related issue or need that you'd like help with."
  }
}
```

#### 2.3 Clarification Loop

When triage needs clarification:

1. **Return clarification questions** to user
2. **Stop processing** - do NOT call optional agents
3. **Wait for user response**
4. **Re-run triage** with updated user_query containing the response
5. **Repeat** until clear diagnosis obtained

**Important:** During clarification, the response contains ONLY the triage result with questions. No coverage, DIY, service, or cost information is provided.

#### 2.4 Triage Guard Clause

After triage completes, check the result:

**Stop Conditions (do NOT proceed to optional agents):**
- `needs_clarification: true` → Return clarification questions and stop
- Empty or None diagnosis → Return triage result and stop
- Diagnosis contains error phrases ("Unable to analyse media", "could not be recognized") → Return triage result and stop
- Diagnosis indicates non-property-related content → Return triage result and stop

**Continue Condition:**
- Valid, actionable diagnosis obtained → Proceed to optional agents

### Phase 3: Optional Agents (Conditional Execution)

Optional agents run **only when triage produces a valid diagnosis**. The `analysis_optional_agents` field determines which agents to run.

#### 3.1 Agent Selection Logic

```python
# Default: all agents if field is missing, null, empty, or invalid
analysis_optional_agents = input.get("analysis_optional_agents") or ["coverage", "diy", "service", "cost"]

# Canonical execution order (always maintained)
canonical_order = ["coverage", "diy", "service", "cost"]

# Execute only selected agents in canonical order
for agent_name in canonical_order:
    if agent_name in analysis_optional_agents:
        execute_agent(agent_name)
```

#### 3.2 Coverage Agent (if "coverage" in optional_agents)

**Purpose:** Retrieve warranty and insurance coverage information

**Process:**
1. Receive diagnosis from triage
2. Call `ask_user_docs_retrieval` with diagnosis as query
3. Search user's uploaded documents (warranties, insurance policies)
4. Filter by `context_doc_uris` if provided
5. Extract relevant coverage information
6. Return structured coverage result

**Input:**
- `user_query`: Original query
- `context_doc_uris`: User documents to search
- `property_address`: Property context
- Diagnosis from triage (used as search context)

**Output:**
```json
{
  "coverageResult": {
    "warrantyInfo": "Faucet covered under manufacturer's 5-year limited warranty. Covers defects in materials and workmanship. Does not cover normal wear and tear or improper installation.",
    "insuranceInfo": "Homeowner's policy covers water damage from plumbing failures. $500 deductible applies. Emergency plumbing repairs covered up to $1,000."
  }
}
```

#### 3.3 DIY Agent (if "diy" in optional_agents)

**Purpose:** Provide DIY repair guidance, videos, and products

**Process:**
1. Receive diagnosis from triage
2. **Parallel execution** of three tools:
   - `google_search_agent`: Search for DIY repair instructions
   - `youtube_search`: Find relevant video tutorials
   - `shopping_agent`: Get product recommendations (category: "DIY")
3. Consolidate results into structured format
4. Return DIY guidance

**Input:**
- `user_query`: Original query with diagnosis context
- `context_doc_uris`: Additional context
- `property_address`: Property context
- Diagnosis from triage (critical for relevance)

**Output:**
```json
{
  "diyResults": {
    "diySteps": {
      "summary": "Fix a leaking faucet by replacing the O-ring seal",
      "steps": [
        {"stepNumber": 1, "description": "Turn off water supply under sink"},
        {"stepNumber": 2, "description": "Remove faucet handle using Allen wrench"},
        {"stepNumber": 3, "description": "Locate and remove worn O-ring"},
        {"stepNumber": 4, "description": "Install new O-ring of same size"},
        {"stepNumber": 5, "description": "Reassemble faucet and test for leaks"}
      ]
    },
    "youtubeSearch": {
      "videos": [
        {
          "title": "How to Fix a Leaky Faucet - Easy DIY Repair",
          "url": "https://youtube.com/watch?v=...",
          "description": "Step-by-step guide to replacing faucet O-rings and stopping leaks"
        }
      ]
    },
    "recommendedProducts": {
      "products": [
        {
          "item_name": "Universal Faucet O-Ring Kit",
          "image_url": "https://...",
          "vendor": "Home Depot",
          "reviews": "4.5 stars (1,234 reviews)",
          "store_url": "https://homedepot.com/..."
        }
      ]
    }
  }
}
```

#### 3.4 Service Agent (if "service" in optional_agents)

**Purpose:** Find local professional service providers

**Process:**
1. Receive diagnosis from triage
2. Determine location strategy (priority order):
   - **Priority 1**: Use `location_coordinates` + `location_radius` (most accurate)
   - **Priority 2**: Use `property_address` (fallback)
   - **Priority 3**: Use "near me" (last resort)
3. **Parallel execution** of search tools:
   - `serpapi_search`: Local business search
   - `serpapi_search`: SerpAPI listings with reviews
4. If both return no results, use `google_search_agent` as fallback
5. Filter results within `location_radius` (default: 50 miles)
6. Sort by distance (closest first) when coordinates available
7. Return top 10 providers

**Input:**
- `user_query`: Original query with diagnosis context
- `context_doc_uris`: Additional context
- `property_address`: Property location
- `location_coordinates`: GPS coordinates (preferred)
- `location_radius`: Search radius in miles
- Diagnosis from triage (used for provider type)

**Output:**
```json
{
  "serviceResults": {
    "localPros": {
      "serpAPIResults": [
        {
          "name": "ABC Plumbing Services",
          "address": "456 Oak St, City, State",
          "phone": "(555) 123-4567",
          "rating": 4.8,
          "reviews": 156,
          "distance": "2.3 miles",
          "website": "https://abcplumbing.com"
        }
      ],
      "googleSearchResults": [
        {
          "name": "Quick Fix Plumbers",
          "address": "789 Elm St, City, State",
          "phone": "(555) 987-6543",
          "rating": 4.6,
          "reviews": 203,
          "distance": "3.1 miles",
          "url": "https://yelp.com/biz/quick-fix-plumbers"
        }
      ],
      "googleSearchResults": []
    }
  }
}
```

**Location Handling Details:**

**With Coordinates (Preferred):**
```
Search query: "plumber near 37.7749,-122.4194"
Radius filter: Within 50 miles
Sort: By distance (ascending)
Result: Accurate distance calculations, precise radius filtering
```

**With Address Only:**
```
Search query: "plumber near 123 Main St, San Francisco, CA"
Radius filter: Best effort by API
Sort: By relevance/rating
Result: Less precise but functional
```

**Fallback (No Location):**
```
Search query: "plumber near me"
Radius filter: Not applicable
Sort: By relevance/rating
Result: Generic results, may not be local
```

#### 3.5 Cost Agent (if "cost" in optional_agents)

**Purpose:** Provide DIY vs Professional cost comparisons

**Process:**
1. Receive diagnosis from triage
2. Call `cost_estimation` for overall cost analysis
3. Generate structured cost comparison
4. Include DIY and Professional cost ranges
5. Provide savings analysis and considerations

**Input:**
- `user_query`: Original query
- `context_doc_uris`: Additional context
- `property_address`: Property context
- Diagnosis from triage (critical for accurate estimates)

**Output:**
```json
{
  "costEstimationResults": {
    "costEstimates": {
      "repair_type": "Faucet O-ring replacement",
      "DIY": {
        "cost_range": "$10-30",
        "includes": ["O-ring kit", "Basic tools (if needed)", "Your time (1-2 hours)"],
        "savings": "Save $150-270 compared to professional service",
        "complexity": "Low - suitable for beginners with basic tools"
      },
      "Service": {
        "cost_range": "$150-300",
        "includes": ["Labor", "Professional expertise", "Parts and materials", "Service warranty"],
        "benefits": "Guaranteed fix, professional warranty, no risk of mistakes",
        "complexity": "Professional service eliminates DIY risk"
      },
      "comparison": {
        "diy_savings": "Up to 90% cost savings for simple repairs",
        "professional_benefits": "Warranty coverage, expert diagnosis, time savings",
        "considerations": "DIY suitable for simple repairs; professional recommended for complex plumbing issues"
      }
    }
  }
}
```

### Phase 4: Response Assembly

#### 4.1 Title Generation

Generate a concise, user-friendly title from the triage diagnosis:

**Rules:**
- Derive from triage diagnosis text
- Keep concise (5-10 words)
- Action-oriented when possible
- Reflect clarification state if applicable

**Examples:**
- Clear diagnosis: "Fix Kitchen Faucet Leak"
- Clarification needed: "Need More Details: Plumbing Issue"
- Service request: "Find Local Plumber"
- Product request: "Best Vacuum for Pet Hair"

#### 4.2 Dual Format Response

**Format 1: Markdown (for Telegram)**

```markdown
# Fix Kitchen Faucet Leak

## Problem Diagnosis
Your kitchen faucet has a leak at the base connection, likely due to a worn O-ring seal.

## Coverage Information
✅ **Warranty**: Covered under manufacturer's 5-year warranty
✅ **Insurance**: Plumbing repairs covered (subject to $500 deductible)

## DIY Solution
**Estimated Cost**: $10-30 | **Time**: 1-2 hours | **Difficulty**: Easy

### Steps:
1. Turn off water supply under sink
2. Remove faucet handle using Allen wrench
3. Locate and remove worn O-ring
4. Install new O-ring of same size
5. Reassemble faucet and test

### Video Tutorial:
🎥 [How to Fix a Leaky Faucet](https://youtube.com/watch?v=...)

### Recommended Products:
🛒 [Universal Faucet O-Ring Kit](https://homedepot.com/...) - $12.99

## Professional Service Options
📍 **Within 50 miles of your location**

1. **ABC Plumbing Services** ⭐ 4.8 (156 reviews)
   - 📞 (555) 123-4567
   - 📍 2.3 miles away
   - 🌐 [Website](https://abcplumbing.com)

2. **Quick Fix Plumbers** ⭐ 4.6 (203 reviews)
   - 📞 (555) 987-6543
   - 📍 3.1 miles away
   - 🌐 [SerpAPI Page](https://yelp.com/biz/quick-fix-plumbers)

## Cost Comparison
💰 **DIY**: $10-30 (Save up to 90%)
💰 **Professional**: $150-300 (Includes warranty)

**Recommendation**: This is a simple repair suitable for DIY. Professional service recommended if you're uncomfortable with plumbing work.
```

**Format 2: JSON (for Web App)**

```json
{
  "analysis": {
    "title": "Fix Kitchen Faucet Leak",
    "triageResult": {
      "diagnosis": "Kitchen faucet showing active water leak from base connection. Visible water pooling around faucet base suggests loose connection or worn O-ring seal."
    },
    "coverageResult": {
      "warrantyInfo": "Faucet covered under manufacturer's 5-year limited warranty...",
      "insuranceInfo": "Homeowner's policy covers water damage from plumbing failures..."
    },
    "diyResults": { /* ... */ },
    "serviceResults": { /* ... */ },
    "costEstimationResults": { /* ... */ }
  }
}
```

#### 4.3 Response Variations

**Clarification Response:**
```markdown
# Need More Information

I need a bit more information to help you effectively:

1. What type of issue are you experiencing (plumbing, electrical, appliance, etc.)?
2. Can you describe any visible symptoms or unusual behavior?
3. When did you first notice this problem?

Please provide these details so I can give you specific recommendations.
```

```json
{
  "analysis": {
    "title": "Need More Information",
    "triageResult": {
      "needs_clarification": true,
      "clarification_questions": [
        "What type of issue are you experiencing?",
        "Can you describe any visible symptoms?",
        "When did you first notice this problem?"
      ],
      "message": "I need a bit more information to help you effectively."
    }
  }
}
```

**Partial Agent Response:**
```json
{
  "analysis": {
    "title": "Fix Kitchen Faucet Leak",
    "triageResult": { /* ... */ },
    "diyResults": { /* ... */ },
    "serviceResults": { /* ... */ }
    // Note: coverage and cost agents not included (not in analysis_optional_agents)
  }
}
```

### Phase 5: Error Handling

#### 5.1 Triage Failures

**Scenario**: Multimodal analysis fails
```json
{
  "analysis": {
    "title": "Unable to Analyze Media",
    "triageResult": {
      "diagnosis": "Unable to analyse media. Please retry again after sometime."
    }
  }
}
```

**Scenario**: Non-property-related content
```json
{
  "analysis": {
    "title": "Property Care Assistance",
    "triageResult": {
      "diagnosis": "I specialize in property care including repairs, maintenance, pest control, service recommendations, and product advice. Please provide details about a specific property-related issue."
    }
  }
}
```

#### 5.2 Optional Agent Failures

**Graceful Degradation**: If an optional agent fails, continue with other agents and return partial results.

**Example**: Service agent fails, but DIY and cost agents succeed
```json
{
  "analysis": {
    "title": "Fix Kitchen Faucet Leak",
    "triageResult": { /* ... */ },
    "diyResults": { /* ... */ },
    "serviceResults": {
      "localPros": {
        "serpAPIResults": [],
        "googleSearchResults": [],
        "googleSearchResults": []
      }
    },
    "costEstimationResults": { /* ... */ }
  }
}
```

#### 5.3 Retry Logic

- **Transient Failures**: Automatic retry with exponential backoff
- **API Rate Limits**: Queue request for later processing
- **Invalid Input**: Return clear error message to user

## Workflow Timing

**Typical Execution Times:**

| Phase | Time (seconds) | Notes |
|-------|----------------|-------|
| Input Validation | 0.1 | Instant |
| Triage (text-only) | 2-5 | Fast |
| Triage (multimodal) | 5-10 | Depends on media size |
| Coverage Agent | 3-5 | RAG retrieval |
| DIY Agent | 8-12 | Parallel API calls |
| Service Agent | 8-12 | Parallel API calls |
| Cost Agent | 3-5 | Estimation logic |
| Response Assembly | 1-2 | JSON formatting |
| **Total (full workflow)** | **15-30** | All agents |
| **Total (clarification)** | **2-5** | Triage only |

## Workflow Optimization

### Parallel Execution
- DIY Agent: Google Search + YouTube + Shopping run in parallel
- Service Agent: SerpAPI + SerpAPI run in parallel
- Coverage and Cost agents run independently

### Caching Strategies
- Cache diagnosis for repeated queries
- Cache service provider results (5-minute TTL)
- Cache product recommendations (1-hour TTL)

### Resource Management
- Connection pooling for API calls
- Request batching where possible
- Graceful timeout handling

## Monitoring and Observability

### Key Metrics
- Triage success rate
- Clarification loop iterations
- Agent execution times
- API failure rates
- Response completeness

### Logging
- Input parameters (sanitized)
- Agent execution flow
- API call results
- Error conditions
- Response times

### Alerts
- High triage failure rate
- API quota exhaustion
- Slow response times
- Repeated clarification loops

