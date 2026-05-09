# Gemini Google Search Grounding - Google Search Grounding Support for Gemini API

A comprehensive Gemini API Google Search Grounding integration module for accessing real-time web information and providing citations.

## Features

- **Google Search Grounding Tool** - Enable Google Search Grounding in generateContent calls
- **Real-time Information** - Access up-to-date information beyond the model's knowledge cutoff
- **Automatic Citations** - Get structured citation data linking responses to web sources
- **Search Query Tracking** - See what search queries the model used
- **Combined Tools** - Combine Google Search with URL context for powerful workflows
- **Inline Citations** - Built-in support for adding inline citations to responses
- **Async Support** - Full async/await support for high-performance applications
- **Vertex AI & API Key Auth** - Support for both Vertex AI and API key authentication

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install google-genai pydantic google-cloud-secret-manager
```

## Configuration

### Environment Variables (Vertex AI - Recommended)

Set the following environment variables for Vertex AI:

```bash
# Required
export GEMINI_PROJECT_ID="your-gcp-project-id"
export GEMINI_LOCATION="us-central1"

# Optional
export GEMINI_USE_VERTEX_AI="true"  # Default: true if project_id is set
export GEMINI_TIMEOUT="60"
```

### Environment Variables (API Key)

Alternatively, use API key authentication:

```bash
# Required
export GEMINI_API_KEY="your-api-key"

# Optional
export GEMINI_USE_VERTEX_AI="false"
export GEMINI_TIMEOUT="60"
```

### Using .env File

Create a `.env` file in your project root:

```env
GEMINI_PROJECT_ID=your-gcp-project-id
GEMINI_LOCATION=us-central1
GEMINI_USE_VERTEX_AI=true
```

Then load it in your code:

```python
from dotenv import load_dotenv
load_dotenv()

from gemini_google_search import GeminiGoogleSearchConfig, GeminiGoogleSearchClient

config = GeminiGoogleSearchConfig.from_env()
```

### Using Google Cloud Secret Manager

For production deployments, store configuration in GCP Secret Manager:

```bash
# Create secret with JSON config
echo '{"project_id": "...", "location": "...", "use_vertex_ai": true}' | \
  gcloud secrets create gemini-google-search-config --data-file=-
```

Then load in code:

```python
from gemini_google_search import GeminiGoogleSearchConfig, GeminiGoogleSearchClient

config = GeminiGoogleSearchConfig.from_gcp_secret_manager(
    project_id="your-secrets-project-id",
    config_secret="gemini-google-search-config",
)
```

## Usage

### Basic Setup

```python
import asyncio
from gemini_google_search import GeminiGoogleSearchClient, GeminiGoogleSearchConfig

# Load configuration
config = GeminiGoogleSearchConfig.from_env()

# Create client
client = GeminiGoogleSearchClient(config)
```

### Basic Google Search Grounding Usage

```python
async def search_example():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Who won the euro 2024?",
            enable_google_search=True
        )
        print(f"Response: {response.text}")
        print(f"Search queries used: {response.search_queries}")
        print(f"Citations: {response.web_citations}")

asyncio.run(search_example())
```

### Accessing Citations

```python
async def get_citations():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        response = await client.generate_content(
            contents="What are the latest developments in quantum computing?",
            enable_google_search=True
        )
        
        print(response.text)
        print(f"\nFound {response.citation_count} citations:")
        for i, citation in enumerate(response.web_citations, 1):
            print(f"{i}. {citation.title}: {citation.uri}")

asyncio.run(get_citations())
```

### Adding Inline Citations

```python
async def inline_citations():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        response = await client.generate_content(
            contents="What are the latest AI breakthroughs in 2024?",
            enable_google_search=True
        )
        
        # Get text with inline citations as markdown links
        text_with_citations = response.add_citations_to_text(format_markdown=True)
        print(text_with_citations)
        
        # Or as plain text
        text_plain = response.add_citations_to_text(format_markdown=False)
        print(text_plain)

asyncio.run(inline_citations())
```

### Combining with URL Context

```python
async def combined_tools():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Give me a three day events schedule based on https://example.com/events. Also let me know what needs to be taken care of considering weather and commute.",
            enable_google_search=True,
            enable_url_context=True
        )
        print(response.text)
        print(f"Search queries: {response.search_queries}")

asyncio.run(combined_tools())
```

### Using Configuration Object

```python
from gemini_google_search import GenerateContentConfig

async def with_config():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        config = GenerateContentConfig(
            model="gemini-3.1-flash-lite-preview",
            enable_google_search=True,
            enable_url_context=False,
            temperature=0.7,
            max_output_tokens=2048,
            response_mime_type="application/json"
        )
        
        response = await client.generate_content_with_config(
            contents="What are the top 5 programming languages in 2024?",
            config=config
        )
        print(response.text)

asyncio.run(with_config())
```

### Accessing Grounding Metadata

```python
async def grounding_metadata():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        response = await client.generate_content(
            contents="What happened in the tech industry this week?",
            enable_google_search=True
        )
        
        if response.grounding_metadata:
            print(f"Search queries: {response.grounding_metadata.web_search_queries}")
            print(f"Number of citations: {response.grounding_metadata.citation_count}")
            
            # Access grounding supports (links text segments to sources)
            if response.grounding_metadata.grounding_supports:
                for support in response.grounding_metadata.grounding_supports:
                    print(f"Segment: {support.text}")
                    print(f"  Indices: {support.grounding_chunk_indices}")

asyncio.run(grounding_metadata())
```

### Token Usage Tracking

```python
async def track_tokens():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        response = await client.generate_content(
            contents="What are the latest news about AI?",
            enable_google_search=True
        )
        
        if response.usage_metadata:
            print(f"Prompt tokens: {response.prompt_token_count}")
            print(f"Response tokens: {response.candidates_token_count}")
            print(f"Total tokens: {response.total_token_count}")

asyncio.run(track_tokens())
```

## API Reference

### GeminiGoogleSearchConfig

Configuration container for Gemini Google Search Grounding.

| Attribute | Type | Description |
|-----------|------|-------------|
| `project_id` | str | GCP project ID (required for Vertex AI) |
| `location` | str | GCP location (default: 'us-central1') |
| `api_key` | str | Gemini API key (required if not using Vertex AI) |
| `use_vertex_ai` | bool | Whether to use Vertex AI (default: True if project_id is set) |
| `timeout` | float | Request timeout in seconds (default: 60.0) |

### GeminiGoogleSearchClient Methods

#### Core Methods
- `generate_content(contents, model?, enable_google_search?, enable_url_context?, temperature?, max_output_tokens?, response_mime_type?, response_schema?) -> GenerateContentResponse`
- `generate_content_with_config(contents, config) -> GenerateContentResponse`

### Request Models

#### GenerateContentConfig
```python
GenerateContentConfig(
    model: str = "gemini-3.1-flash-lite-preview",        # Model to use
    temperature: float = None,              # Temperature (0.0-2.0)
    top_p: float = None,                    # Top-p sampling (0.0-1.0)
    top_k: int = None,                      # Top-k sampling
    max_output_tokens: int = None,          # Max output tokens
    enable_google_search: bool = True,      # Enable Google Search tool
    enable_url_context: bool = False,       # Enable URL context tool
    response_mime_type: str = None,         # Response MIME type
    response_schema: Dict = None,          # Response schema for structured output
)
```

### Response Models

#### GenerateContentResponse
```python
response.text                          # Generated text content
response.grounding_metadata            # GroundingMetadata or None
response.model                         # Model used
response.finish_reason                 # Finish reason
response.usage_metadata                # Token usage metadata

# Convenience properties
response.web_citations                 # List[WebChunk] - web citations
response.has_google_search_grounding   # bool - has grounding metadata
response.search_queries                # List[str] - search queries used
response.citation_count                # int - number of citations
response.prompt_token_count            # int - prompt tokens
response.candidates_token_count        # int - response tokens
response.total_token_count             # int - total tokens

# Methods
response.add_citations_to_text(format_markdown=True)  # Add inline citations
```

#### GroundingMetadata
```python
grounding_metadata.web_search_queries      # List[str] - search queries used
grounding_metadata.search_entry_point       # Dict - HTML/CSS for search widget
grounding_metadata.grounding_chunks         # List[GroundingChunk] - web sources
grounding_metadata.grounding_supports       # List[GroundingSupport] - text-to-source links
grounding_metadata.web_citations            # List[WebChunk] - convenience property
grounding_metadata.has_web_citations        # bool - has citations
grounding_metadata.citation_count           # int - number of citations
```

#### WebChunk
```python
web_chunk.uri      # str - Web source URI
web_chunk.title    # str - Web source title
```

#### GroundingSupport
```python
grounding_support.segment                  # Dict - text segment with start/end indices
grounding_support.grounding_chunk_indices  # List[int] - indices into grounding_chunks
grounding_support.start_index              # int - start index of segment
grounding_support.end_index                # int - end index of segment
grounding_support.text                     # str - text of segment
```

## Supported Models

Examples in this package use `gemini-3.1-flash-lite-preview`.

Use the `google_search` tool shown in the examples for current Gemini models.

See the [official documentation](https://ai.google.dev/gemini-api/docs/google-search) for the complete list.

## Authentication

### Vertex AI (Recommended)

For Vertex AI authentication, use Application Default Credentials:

```bash
gcloud auth application-default login
```

Or set service account credentials:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

### API Key

For API key authentication, set the `GEMINI_API_KEY` environment variable:

```bash
export GEMINI_API_KEY="your-api-key"
export GEMINI_USE_VERTEX_AI="false"
```

### Required IAM Roles

For Vertex AI:
- `roles/aiplatform.user` - For using Vertex AI Gemini API

## Error Handling

```python
from gemini_google_search import GeminiGoogleSearchClient, GeminiGoogleSearchConfig
from gemini_google_search.client import GeminiGoogleSearchError

async def safe_query():
    try:
        async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
            response = await client.generate_content(
                contents="What are the latest tech news?",
                enable_google_search=True
            )
            print(response.text)
    except GeminiGoogleSearchError as e:
        print(f"Gemini Google Search error: {e}")
        print(f"Status code: {e.status_code}")
        print(f"Details: {e.details}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_query())
```

## Pricing

When you use Google Search Grounding, your project is billed for each search query that the model decides to execute. If the model executes multiple search queries to answer a single prompt (for example, searching for "UEFA Euro 2024 winner" and "Spain vs England Euro 2024 final score" within the same API call), this counts as multiple billable uses of the tool for that request.

For detailed pricing information, see the [Gemini API pricing page](https://ai.google.dev/pricing).

## Limitations

### Search Query Limits
- The model automatically decides how many search queries to execute
- Each search query is billable
- Rate limits depend on the model used

### Supported Languages
- Google Search Grounding works with all available languages supported by Gemini

### Content Moderation
- Search results are subject to content moderation
- Some sources may be filtered based on safety settings

## Best Practices

### 1. Use for Real-time Information

```python
# Good: Questions about recent events or current information
contents = "What are the latest developments in AI this week?"

# Less ideal: General knowledge questions (model can answer from training)
contents = "What is machine learning?"  # May not need search
```

### 2. Monitor Search Query Usage

```python
# Track how many searches are being performed
response = await client.generate_content(...)
print(f"Search queries used: {response.search_queries}")
# Each query is billable
```

### 3. Combine with URL Context

```python
# Use Google Search to find URLs, then URL context for deep analysis
response = await client.generate_content(
    contents="Find recent articles about AI and summarize the top 3",
    enable_google_search=True,
    enable_url_context=True
)
```

### 4. Display Citations

```python
# Always show citations to build user trust
response = await client.generate_content(...)
text_with_citations = response.add_citations_to_text(format_markdown=True)
# Display in your UI
```

### 5. Handle Cases Without Grounding

```python
response = await client.generate_content(...)
if response.has_google_search_grounding:
    print("Response is grounded in web search")
    print(f"Citations: {response.citation_count}")
else:
    print("Model answered from its own knowledge")
```

## Troubleshooting

### Common Issues

**Error: "Project ID required for Vertex AI"**
- Ensure `GEMINI_PROJECT_ID` is set
- Or set `GEMINI_USE_VERTEX_AI=false` and provide `GEMINI_API_KEY`

**Error: "API key required when not using Vertex AI"**
- Set `GEMINI_API_KEY` environment variable
- Or use Vertex AI by setting `GEMINI_PROJECT_ID`

**No citations in response**
- The model may answer from its own knowledge if it's confident
- Check `response.has_google_search_grounding` to verify grounding was used
- Some queries may not require web search

**High costs**
- Each search query is billable
- Monitor `response.search_queries` to see how many searches were performed
- Consider if the query truly needs real-time information

**Model doesn't use search**
- The model decides when to search based on the prompt
- For questions about recent events or current information, search is more likely
- General knowledge questions may not trigger search

## Examples

### Example 1: Recent Events

```python
async def recent_events():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Who won the euro 2024?",
            enable_google_search=True
        )
        print(response.text)
        print(f"\nSearch queries: {response.search_queries}")
        print(f"Citations: {response.citation_count}")

asyncio.run(recent_events())
```

### Example 2: Current Information

```python
async def current_info():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        response = await client.generate_content(
            contents="What are the latest stock prices for major tech companies?",
            enable_google_search=True
        )
        
        # Display with citations
        text_with_citations = response.add_citations_to_text(format_markdown=True)
        print(text_with_citations)

asyncio.run(current_info())
```

### Example 3: Research with Citations

```python
async def research_with_citations():
    async with GeminiGoogleSearchClient(GeminiGoogleSearchConfig.from_env()) as client:
        response = await client.generate_content(
            contents="What are the latest breakthroughs in quantum computing in 2024?",
            enable_google_search=True
        )
        
        print(response.text)
        print("\n" + "="*50)
        print("Sources:")
        for i, citation in enumerate(response.web_citations, 1):
            print(f"{i}. {citation.title}")
            print(f"   {citation.uri}")

asyncio.run(research_with_citations())
```

## References

- [Gemini API Google Search Grounding Documentation](https://ai.google.dev/gemini-api/docs/google-search)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/quota)

## License

Internal use only.

