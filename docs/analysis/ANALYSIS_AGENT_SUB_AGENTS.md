# Analysis Agent Sub-Agents

## Overview

The Analysis Agent orchestrates six specialized sub-agents, each responsible for a specific aspect of the property care workflow. This document provides detailed information about each sub-agent, their tools, inputs, outputs, and implementation details.

## Sub-Agent Architecture

```
Analysis Agent (Orchestrator)
├── 1. Triage Agent (Problem Identification)
├── 2. Coverage Agent (Warranty/Insurance)
├── 3. DIY Agent (Self-Repair Guidance)
├── 4. Service Agent (Professional Options)
├── 5. Shopping Agent (Product Recommendations)
└── 6. Cost Agent (Cost Analysis)
```

---

## 1. Triage Agent

### Purpose
Identify and diagnose property-related problems through multimodal analysis or text-only triage. Asks clarification questions when needed.

### Location
`gcp/agents/homecare/property_agent/sub_agents/analysis_agent/agent.py`

### Model
Gemini 2.5 Flash

### Capabilities
- **Multimodal Analysis**: Analyze images, videos, and documents
- **Text-Only Triage**: Derive diagnosis from text descriptions
- **Clarification**: Ask targeted questions when information is insufficient
- **Iterative Refinement**: Continue asking questions until clear diagnosis obtained

### Tools

#### `analyse_multimodal_data(user_query: str, gcs_url: str)`
Analyzes media files using Gemini 2.5 Flash.

**Parameters:**
- `user_query`: User's description of the problem
- `gcs_url`: Google Cloud Storage URI of the media file

**Process:**
1. Initialize Gemini client with Vertex AI configuration
2. Create multimodal request with text and media parts
3. Apply multimodal parsing prompt
4. Extract diagnosis from response
5. Return diagnosis text

**Supported Formats:**
- Images: JPEG, PNG, GIF, WebP
- Videos: MP4, MOV, AVI
- Documents: PDF

**Example:**
```python
result = analyse_multimodal_data(
    user_query="What's wrong with this faucet?",
    gcs_url="gs://bucket/faucet_leak.jpg"
)
# Returns: "Kitchen faucet showing active water leak from base connection..."
```

### Input Schema
```python
class DiagnosisInput(BaseModel):
    user_query: str  # REQUIRED
    diagnosis_uris: Optional[List[str]] = None
    context_doc_uris: Optional[List[str]] = None
    property_address: Optional[str] = None
```

### Output Schema

**With Clear Diagnosis:**
```json
{
  "triageResult": {
    "diagnosis": "Detailed problem description"
  }
}
```

**With Clarification Needed:**
```json
{
  "triageResult": {
    "needs_clarification": true,
    "clarification_questions": [
      "Question 1?",
      "Question 2?",
      "Question 3?"
    ],
    "message": "Optional friendly message"
  }
}
```

### Behavior Modes

#### Mode 1: Multimodal Analysis (diagnosis_uris provided)
1. Extract first URI from diagnosis_uris
2. Call analyse_multimodal_data tool
3. Return diagnosis from analysis

#### Mode 2: Text-Only Triage (diagnosis_uris absent)

**Clear Query:**
- Analyze user_query for specific problem details
- Derive concise diagnosis
- Return diagnosis

**Unclear Query:**
- Identify missing information
- Generate 1-3 targeted clarification questions
- Return clarification request
- Wait for user response
- Re-run triage with updated query
- Repeat until clear diagnosis obtained

**Non-Applicable Query:**
- Detect non-property-related queries
- Return polite redirection message

### Clarification Question Strategy

**Good Clarification Questions:**
- "What type of issue are you experiencing (plumbing, electrical, appliance, etc.)?"
- "Can you describe any visible symptoms or unusual behavior?"
- "When did you first notice this problem?"
- "Is there any water damage, strange noises, or error messages?"
- "Which room or area of the property is affected?"

**Avoid:**
- Yes/no questions (not enough information)
- Too many questions at once (overwhelming)
- Technical jargon (user may not understand)
- Questions about information already provided

### Error Handling
- Media analysis failures return: "Unable to analyse media. Please retry again after sometime."
- Invalid URIs are caught and logged
- Gracefully handles missing optional fields

---

## 2. Coverage Agent

### Purpose
Retrieve warranty and insurance coverage information from user-uploaded documents.

### Location
`gcp/agents/homecare/property_agent/sub_agents/coverage_agent/`

### Model
Gemini 2.5 Flash

### Tools

#### `ask_user_docs_retrieval(query: str)`
Searches user's document corpus using Vertex AI RAG.

**Parameters:**
- `query`: Search query (typically includes diagnosis from triage)

**Process:**
1. Extract user_id from tool context
2. Construct RAG corpus name for user
3. Execute RAG query with similarity threshold
4. Filter by context_doc_uris if provided
5. Extract relevant coverage information
6. Return structured warranty and insurance info

**RAG Configuration:**
- Similarity threshold: 0.3
- Max results: 10
- Vector database: Vertex AI RAG Engine
- Corpus per user: Isolated user document storage

**Example:**
```python
result = ask_user_docs_retrieval(
    query="faucet leak warranty coverage"
)
# Returns warranty and insurance information from user's documents
```

### Input Schema
```python
class DocsInput(BaseModel):
    user_query: str
    context_doc_uris: Optional[List[str]] = None
    property_address: Optional[str] = None
```

### Output Schema
```json
{
  "coverageResult": {
    "warrantyInfo": "Warranty coverage details with terms and conditions",
    "insuranceInfo": "Insurance policy coverage details with deductibles and limits"
  }
}
```

### Coverage Types Detected
- **Manufacturer Warranties**: Product warranties from manufacturers
- **Extended Warranties**: Third-party warranty coverage
- **Homeowner's Insurance**: Property insurance policies
- **Appliance Protection Plans**: Appliance-specific coverage
- **Service Contracts**: Ongoing maintenance agreements

### Document Types Supported
- Warranty certificates (PDF, images)
- Insurance policies (PDF)
- Service contracts (PDF)
- Purchase receipts with warranty info (PDF, images)
- Appliance manuals with warranty sections (PDF)

### Fallback Behavior
If no relevant coverage found:
```json
{
  "coverageResult": {
    "warrantyInfo": "No warranty information found in your documents.",
    "insuranceInfo": "No insurance coverage information found in your documents."
  }
}
```

---

## 3. DIY Agent

### Purpose
Provide comprehensive DIY repair guidance including steps, video tutorials, and product recommendations.

### Location
`gcp/agents/homecare/property_agent/sub_agents/diy_agent/`

### Model
Gemini 2.5 Flash

### Tools

#### `google_search_agent(query: str)`
Searches the web for DIY repair instructions.

**Parameters:**
- `query`: Search query (includes diagnosis from triage)

**Process:**
1. Execute Google Search API call
2. Extract top results
3. Parse repair steps from content
4. Structure as numbered steps
5. Return summary and step-by-step instructions

#### `youtube_search(query: str)`
Finds relevant DIY video tutorials.

**Parameters:**
- `query`: Search query for videos

**Process:**
1. Execute YouTube Data API search
2. Filter for tutorial/how-to videos
3. Extract video metadata (title, URL, description)
4. Rank by relevance and view count
5. Return top 5-10 videos

#### `shopping_agent(query: str, category: str)`
Gets product recommendations for DIY repairs.

**Parameters:**
- `query`: Product search query
- `category`: "DIY" (for DIY-specific products)

**Process:**
1. Search shopping APIs for relevant products
2. Filter by category
3. Extract product details (name, image, vendor, price, reviews)
4. Return structured product list

#### `cost_estimation_diy(repair_type: str)`
Estimates DIY repair costs.

**Parameters:**
- `repair_type`: Type of repair (from diagnosis)

**Returns:**
- Cost range for materials
- Tool requirements
- Time estimate
- Complexity level

### Parallel Execution
The DIY Agent executes all three search tools in parallel for faster results:
```
google_search_agent ─┐
youtube_search ───────┼─→ Consolidate Results
shopping_agent ───────┘
```

### Input Schema
```python
class DiagnosisInput(BaseModel):
    user_query: str
    context_doc_uris: Optional[List[str]] = None
    property_address: Optional[str] = None
```

### Output Schema
```json
{
  "diyResults": {
    "diySteps": {
      "summary": "Brief summary of the repair process",
      "steps": [
        {
          "stepNumber": 1,
          "description": "Step description with details"
        }
      ]
    },
    "youtubeSearch": {
      "videos": [
        {
          "title": "Video title",
          "url": "https://youtube.com/watch?v=...",
          "description": "Video description"
        }
      ]
    },
    "recommendedProducts": {
      "products": [
        {
          "item_name": "Product name",
          "image_url": "https://...",
          "vendor": "Store name",
          "reviews": "4.5 stars (1,234 reviews)",
          "store_url": "https://..."
        }
      ]
    }
  }
}
```

### DIY Complexity Levels
- **Easy**: Basic tools, 1-2 hours, beginner-friendly
- **Moderate**: Some experience needed, 2-4 hours, intermediate tools
- **Difficult**: Advanced skills, 4+ hours, specialized tools
- **Expert**: Professional-level skills, extensive tools, significant time

### Safety Considerations
The DIY Agent includes safety warnings when appropriate:
- Electrical work: "Turn off circuit breaker"
- Plumbing: "Shut off water supply"
- Gas appliances: "Consider professional service"
- Structural work: "Consult with professional"

---

## 4. Service Agent

### Purpose
Find and recommend local professional service providers with ratings, reviews, and contact information.

### Location
`gcp/agents/homecare/property_agent/sub_agents/service_agent/`

### Model
Gemini 2.5 Flash

### Tools

#### `serpapi_search(query: str, location: str)`
Searches for local businesses using SerpAPI.

**Parameters:**
- `query`: Service type (e.g., "plumber", "electrician")
- `location`: Address or coordinates

**Process:**
1. Construct SerpAPI local search query
2. Execute API call
3. Parse local business results
4. Extract business details (name, address, phone, rating, reviews)
5. Calculate distance if coordinates provided
6. Return structured listings

#### `yelpapi_search(query: str, location: str)`
Searches Yelp for local service providers.

**Parameters:**
- `query`: Service type
- `location`: Address or coordinates

**Process:**
1. Construct Yelp Fusion API search
2. Execute API call
3. Parse business results
4. Extract detailed information
5. Include Yelp ratings and review counts
6. Return structured listings

#### `google_search_agent(query: str)`
Fallback search when primary APIs return no results.

**Parameters:**
- `query`: General search query

**Process:**
1. Execute Google Search
2. Parse results for business information
3. Extract contact details from web pages
4. Return parsed provider list

#### `cost_estimation(service_type: str)`
Estimates professional service costs.

**Parameters:**
- `service_type`: Type of service (from diagnosis)

**Returns:**
- Cost range for professional service
- What's included (labor, materials, warranty)
- Benefits of professional service

### Parallel Execution
```
serpapi_search ─┐
yelpapi_search ─┼─→ Consolidate Results → Filter/Sort → Top 10
                │
google_search ──┘ (fallback if others fail)
```

### Location Handling

#### Priority 1: Coordinates + Radius (Preferred)
```python
location_coordinates = {"lat": 37.7749, "lng": -122.4194}
location_radius = 5  # miles

# Enables:
# - Precise distance calculations
# - Accurate radius filtering
# - Distance-based sorting
```

#### Priority 2: Address Only
```python
property_address = "123 Main St, San Francisco, CA"

# Enables:
# - Location-based search
# - Less precise filtering
# - API-dependent distance estimates
```

#### Priority 3: "Near Me" Fallback
```python
location = "near me"

# Results:
# - Generic location-based results
# - No distance filtering
# - May not be truly local
```

### Input Schema
```python
class DiagnosisInput(BaseModel):
    user_query: str
    context_doc_uris: Optional[List[str]] = None
    property_address: Optional[str] = None
    location_coordinates: Optional[Dict[str, float]] = None
    location_radius: Optional[int] = 5  # default 5 miles
```

### Output Schema
```json
{
  "serviceResults": {
    "localPros": {
      "serpAPIResults": [
        {
          "name": "Business name",
          "address": "Full address",
          "phone": "(555) 123-4567",
          "rating": 4.8,
          "reviews": 156,
          "distance": "2.3 miles",
          "website": "https://..."
        }
      ],
      "yelpAPIResults": [
        {
          "name": "Business name",
          "address": "Full address",
          "phone": "(555) 987-6543",
          "rating": 4.6,
          "reviews": 203,
          "distance": "3.1 miles",
          "url": "https://yelp.com/biz/..."
        }
      ],
      "googleSearchResults": []
    }
  }
}
```

### Result Filtering and Ranking

**Filtering Criteria:**
- Within specified radius (when coordinates provided)
- Has valid contact information
- Has rating (preferred) or reviews
- Currently operating (not permanently closed)

**Ranking Factors:**
1. Distance (closest first when coordinates available)
2. Rating (higher ratings preferred)
3. Review count (more reviews = more reliable)
4. Completeness of information

**Result Limit:**
- Top 10 providers returned
- Balanced between SerpAPI and Yelp sources
- Duplicates removed (same business from multiple sources)

### Service Provider Types
- Plumbers
- Electricians
- HVAC technicians
- Appliance repair
- Pest control
- Contractors
- Handyman services
- Specialized trades (roofing, flooring, etc.)

---

## 5. Shopping Agent

### Purpose
Provide product recommendations for property-related repairs and maintenance. Reusable across different contexts.

### Location
`gcp/agents/homecare/property_agent/sub_agents/shopping_agent/`

### Model
Gemini 2.5 Flash

### Tools

#### `product_recommendations(query: str, category: str)`
Searches for relevant products.

**Parameters:**
- `query`: Product search query
- `category`: Product category (e.g., "DIY", "Professional", "Maintenance")

**Process:**
1. Execute shopping API searches
2. Filter by category
3. Extract product details
4. Rank by relevance, rating, and popularity
5. Return structured product list

**Shopping APIs Used:**
- Google Shopping API
- Amazon Product API (via SerpAPI)
- Home Depot API
- Lowe's API

### Input Schema
```python
query: str  # Product search query
category: str  # Product category
```

### Output Schema
```json
{
  "products": [
    {
      "item_name": "Product name",
      "image_url": "https://product-image.jpg",
      "vendor": "Store/Manufacturer name",
      "reviews": "4.5 stars (1,234 reviews)",
      "store_url": "https://store.com/product",
      "price": "$29.99",
      "availability": "In stock"
    }
  ]
}
```

### Product Categories
- **DIY**: Tools and materials for self-repair
- **Professional**: Professional-grade equipment
- **Maintenance**: Ongoing maintenance products
- **Replacement**: Replacement parts and components
- **Safety**: Safety equipment and gear

### Product Ranking Factors
1. Relevance to query
2. Customer ratings
3. Number of reviews
4. Price competitiveness
5. Availability
6. Brand reputation

### Usage Contexts
- **DIY Agent**: Calls with category "DIY" for repair materials
- **Maintenance Queries**: Calls with category "Maintenance"
- **Direct Product Requests**: Handles standalone product queries

---

## 6. Cost Agent

### Purpose
Provide structured cost estimates comparing DIY and professional service options.

### Location
`gcp/agents/homecare/property_agent/sub_agents/cost_agent/`

### Model
Gemini 2.5 Flash

### Tools

#### `cost_estimation(repair_type: str)`
Generates comprehensive cost comparison.

**Parameters:**
- `repair_type`: Type of repair (from diagnosis)

**Process:**
1. Analyze repair type complexity
2. Research typical DIY costs (materials, tools)
3. Research typical professional costs (labor, materials)
4. Calculate cost ranges
5. Generate savings analysis
6. Provide decision factors
7. Return structured comparison

#### `cost_estimation_diy(repair_type: str)`
Generates DIY-specific cost details.

**Parameters:**
- `repair_type`: Type of repair

**Returns:**
- Detailed DIY cost breakdown
- Tool requirements and costs
- Material costs
- Time investment
- Skill level required

### Input Schema
```python
class DiagnosisInput(BaseModel):
    user_query: str
    context_doc_uris: Optional[List[str]] = None
    property_address: Optional[str] = None
```

### Output Schema
```json
{
  "costEstimationResults": {
    "costEstimates": {
      "repair_type": "Specific repair type",
      "DIY": {
        "cost_range": "$10-50",
        "includes": [
          "Materials and parts",
          "Basic tools (if needed)",
          "Your time (2-3 hours)"
        ],
        "savings": "Save $150-250 compared to professional",
        "complexity": "Moderate - requires basic plumbing knowledge"
      },
      "Service": {
        "cost_range": "$200-300",
        "includes": [
          "Professional labor",
          "Expert diagnosis",
          "All parts and materials",
          "Service warranty (90 days)"
        ],
        "benefits": "Guaranteed fix, no risk of mistakes, warranty coverage",
        "complexity": "Professional eliminates DIY risk"
      },
      "comparison": {
        "diy_savings": "Up to 75% cost savings",
        "professional_benefits": "Warranty, expertise, time savings, no risk",
        "considerations": "DIY suitable if you have basic plumbing skills and tools. Professional recommended if unsure or for complex issues."
      }
    }
  }
}
```

### Cost Estimation Methodology

**DIY Cost Factors:**
- Material costs (parts, supplies)
- Tool costs (if not already owned)
- Time investment (hourly value)
- Potential mistake costs
- Learning curve

**Professional Cost Factors:**
- Labor rates (regional variations)
- Material markup
- Service call fees
- Warranty value
- Expertise premium

**Regional Adjustments:**
- Urban vs rural pricing
- Regional labor rates
- Local market conditions
- Seasonal variations

### Decision Factors Provided

**Favor DIY When:**
- Simple, straightforward repair
- User has necessary skills
- Tools already available
- Significant cost savings
- Low risk of mistakes

**Favor Professional When:**
- Complex or dangerous work
- Specialized tools required
- Warranty considerations
- Time constraints
- Risk of expensive mistakes
- Permits or inspections needed

### Cost Ranges by Repair Type

**Plumbing:**
- DIY: $10-100 (parts)
- Professional: $150-500 (service call + labor)

**Electrical:**
- DIY: $20-150 (parts, if allowed)
- Professional: $200-800 (licensed electrician)

**HVAC:**
- DIY: $50-300 (filters, minor parts)
- Professional: $300-2,000 (diagnosis + repair)

**Appliance:**
- DIY: $30-200 (replacement parts)
- Professional: $150-500 (service + parts)

**Pest Control:**
- DIY: $20-100 (treatments, traps)
- Professional: $150-500 (initial treatment + follow-up)

---

## Sub-Agent Communication

### Context Passing
All sub-agents receive the triage diagnosis as context:
```python
# Triage produces diagnosis
diagnosis = "Kitchen faucet leak at base connection"

# Diagnosis passed to each optional agent
coverage_agent(query=f"{user_query} - Diagnosis: {diagnosis}")
diy_agent(query=f"{user_query} - Diagnosis: {diagnosis}")
service_agent(query=f"{user_query} - Diagnosis: {diagnosis}")
cost_agent(query=f"{user_query} - Diagnosis: {diagnosis}")
```

### State Management
- `tool_context.state["user_id"]`: User identifier for document access
- `tool_context._invocation_context.session`: Session information
- Shared context across all sub-agents in single analysis

### Error Propagation
- Sub-agent failures don't stop other agents
- Partial results returned when some agents fail
- Error messages included in response for failed agents

## Performance Optimization

### Parallel Execution
- DIY Agent: 3 tools in parallel
- Service Agent: 2-3 tools in parallel
- Independent agents can run concurrently (future enhancement)

### Caching
- Product recommendations: 1 hour TTL
- Service provider listings: 5 minutes TTL
- Cost estimates: 24 hours TTL (by repair type)

### Rate Limiting
- YouTube API: 10,000 queries/day
- Yelp API: 5,000 queries/day
- SerpAPI: Based on subscription tier
- Google Search: Based on API quota

### Timeout Handling
- Individual tool timeout: 30 seconds
- Agent timeout: 60 seconds
- Graceful degradation on timeout

## Testing and Validation

### Unit Tests
Each sub-agent has unit tests for:
- Tool functionality
- Input validation
- Output formatting
- Error handling

### Integration Tests
- End-to-end workflow tests
- Multi-agent coordination
- Error recovery scenarios
- Performance benchmarks

### Test Data
- Sample media files for triage
- Mock API responses
- Test user documents
- Various query types

