# Gemini URL Context - URL Context Support for Gemini API

A comprehensive Gemini API URL Context integration module for extracting and analyzing content from URLs.

## Features

- **URL Context Tool** - Enable URL context tool in generateContent calls
- **Automatic URL Extraction** - Automatically extracts and retrieves content from URLs mentioned in prompts
- **Multi-URL Support** - Process up to 20 URLs per request
- **Combined Tools** - Combine URL context with Google Search for powerful workflows
- **Metadata Tracking** - Track which URLs were successfully retrieved and their status
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

from gemini_url_context import GeminiURLContextConfig, GeminiURLContextClient

config = GeminiURLContextConfig.from_env()
```

### Using Google Cloud Secret Manager

For production deployments, store configuration in GCP Secret Manager:

```bash
# Create secret with JSON config
echo '{"project_id": "...", "location": "...", "use_vertex_ai": true}' | \
  gcloud secrets create gemini-url-context-config --data-file=-
```

Then load in code:

```python
from gemini_url_context import GeminiURLContextConfig, GeminiURLContextClient

config = GeminiURLContextConfig.from_gcp_secret_manager(
    project_id="your-secrets-project-id",
    config_secret="gemini-url-context-config",
)
```

## Usage

### Basic Setup

```python
import asyncio
from gemini_url_context import GeminiURLContextClient, GeminiURLContextConfig

# Load configuration
config = GeminiURLContextConfig.from_env()

# Create client
client = GeminiURLContextClient(config)
```

### Basic URL Context Usage

```python
async def analyze_urls():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Compare the ingredients and cooking times from the recipes at https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592 and https://www.allrecipes.com/recipe/21151/simple-whole-roast-chicken/",
            enable_url_context=True
        )
        print(f"Response: {response.text}")
        print(f"Retrieved URLs: {response.retrieved_urls}")

asyncio.run(analyze_urls())
```

### Extracting Data from URLs

```python
async def extract_data():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Extract the prices, names, and key features from https://example.com/products",
            enable_url_context=True,
            response_mime_type="application/json"
        )
        print(response.text)
        print(f"Successfully retrieved {len(response.retrieved_urls)} URLs")

asyncio.run(extract_data())
```

### Comparing Multiple Documents

```python
async def compare_documents():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Compare these two reports and identify differences: https://example.com/report1.pdf and https://example.com/report2.pdf",
            enable_url_context=True
        )
        print(response.text)
        
        # Check which URLs were successfully retrieved
        if response.url_context_metadata:
            print(f"Successful URLs: {response.url_context_metadata.successful_urls}")
            print(f"Failed URLs: {response.url_context_metadata.failed_urls}")

asyncio.run(compare_documents())
```

### Combining URL Context with Google Search

```python
async def search_and_analyze():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Give me a three day events schedule based on https://example.com/events. Also let me know what needs to be taken care of considering weather and commute.",
            enable_url_context=True,
            enable_google_search=True
        )
        print(response.text)
        print(f"Retrieved URLs: {response.retrieved_urls}")

asyncio.run(search_and_analyze())
```

### Using Configuration Object

```python
from gemini_url_context import GenerateContentConfig

async def with_config():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        config = GenerateContentConfig(
            model="gemini-3.1-flash-lite-preview",
            enable_url_context=True,
            enable_google_search=False,
            temperature=0.7,
            max_output_tokens=2048,
            response_mime_type="application/json"
        )
        
        response = await client.generate_content_with_config(
            contents="Analyze the content at https://example.com/article",
            config=config
        )
        print(response.text)

asyncio.run(with_config())
```

### Checking URL Retrieval Status

```python
async def check_url_status():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Summarize https://example.com/page1 and https://example.com/page2",
            enable_url_context=True
        )
        
        if response.url_context_metadata:
            print(f"Total URLs processed: {len(response.url_context_metadata.url_metadata)}")
            print(f"Successful: {len(response.url_context_metadata.successful_urls)}")
            print(f"Failed: {len(response.url_context_metadata.failed_urls)}")
            print(f"Unsafe (failed safety check): {len(response.url_context_metadata.unsafe_urls)}")
            
            # Check individual URL status
            for meta in response.url_context_metadata.url_metadata:
                print(f"{meta.retrieved_url}: {meta.url_retrieval_status}")

asyncio.run(check_url_status())
```

### Token Usage Tracking

```python
async def track_tokens():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Analyze https://example.com/long-document.pdf",
            enable_url_context=True
        )
        
        # Token usage includes content retrieved from URLs
        if response.usage_metadata:
            print(f"Prompt tokens: {response.prompt_token_count}")
            print(f"Tool use prompt tokens (includes URL content): {response.tool_use_prompt_token_count}")
            print(f"Response tokens: {response.candidates_token_count}")
            print(f"Total tokens: {response.total_token_count}")

asyncio.run(track_tokens())
```

## API Reference

### GeminiURLContextConfig

Configuration container for Gemini URL Context.

| Attribute | Type | Description |
|-----------|------|-------------|
| `project_id` | str | GCP project ID (required for Vertex AI) |
| `location` | str | GCP location (default: 'us-central1') |
| `api_key` | str | Gemini API key (required if not using Vertex AI) |
| `use_vertex_ai` | bool | Whether to use Vertex AI (default: True if project_id is set) |
| `timeout` | float | Request timeout in seconds (default: 60.0) |

### GeminiURLContextClient Methods

#### Core Methods
- `generate_content(contents, model?, enable_url_context?, enable_google_search?, temperature?, max_output_tokens?, response_mime_type?, response_schema?) -> GenerateContentResponse`
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
    enable_url_context: bool = True,        # Enable URL context tool
    enable_google_search: bool = False,     # Enable Google Search tool
    response_mime_type: str = None,         # Response MIME type
    response_schema: Dict = None,           # Response schema for structured output
)
```

### Response Models

#### GenerateContentResponse
```python
response.text                          # Generated text content
response.url_context_metadata          # URLContextMetadata or None
response.model                         # Model used
response.finish_reason                 # Finish reason
response.usage_metadata                 # Token usage metadata

# Convenience properties
response.retrieved_urls                 # List[str] - successfully retrieved URLs
response.has_url_context                # bool - has URL context metadata
response.prompt_token_count             # int - prompt tokens
response.candidates_token_count         # int - response tokens
response.total_token_count              # int - total tokens
response.tool_use_prompt_token_count    # int - includes URL content tokens
```

#### URLContextMetadata
```python
url_context_metadata.url_metadata      # List[URLMetadata] - all URL metadata
url_context_metadata.successful_urls   # List[str] - successfully retrieved URLs
url_context_metadata.failed_urls       # List[str] - failed URLs
url_context_metadata.unsafe_urls       # List[str] - URLs that failed safety check
url_context_metadata.has_successful_urls  # bool - has any successful URLs
```

#### URLMetadata
```python
url_metadata.retrieved_url             # str - The URL
url_metadata.url_retrieval_status      # URLRetrievalStatus - Status enum
```

### Enums

#### URLRetrievalStatus
```python
class URLRetrievalStatus(str, Enum):
    SUCCESS = "URL_RETRIEVAL_STATUS_SUCCESS"
    FAILED = "URL_RETRIEVAL_STATUS_FAILED"
    UNSAFE = "URL_RETRIEVAL_STATUS_UNSAFE"
    UNSPECIFIED = "URL_RETRIEVAL_STATUS_UNSPECIFIED"
```

## Supported Models

Examples in this package use `gemini-3.1-flash-lite-preview`.

See the [official documentation](https://ai.google.dev/gemini-api/docs/url-context) for the complete list.

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
from gemini_url_context import GeminiURLContextClient, GeminiURLContextConfig
from gemini_url_context.client import GeminiURLContextError

async def safe_query():
    try:
        async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
            response = await client.generate_content(
                contents="Analyze https://example.com/page",
                enable_url_context=True
            )
            print(response.text)
    except GeminiURLContextError as e:
        print(f"Gemini URL Context error: {e}")
        print(f"Status code: {e.status_code}")
        print(f"Details: {e.details}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_query())
```

## Limitations

### URL Limits
- Maximum 20 URLs per request
- Maximum 34MB content size per URL

### Supported Content Types
- Text (HTML, JSON, plain text, XML, CSS, JavaScript, CSV, RTF)
- Images (PNG, JPEG, BMP, WebP)
- PDFs

### Unsupported Content Types
- Paywalled content
- YouTube videos (use [video understanding](https://ai.google.dev/gemini-api/docs/video) instead)
- Google Workspace files (Docs, Sheets, etc.)
- Video and audio files

### Pricing
- Content retrieved from URLs counts as input tokens
- Rate limits and pricing depend on the model used
- See [pricing page](https://ai.google.dev/pricing) for details

## Best Practices

### 1. Provide Specific URLs

```python
# Good: Direct URLs to specific content
contents = "Compare https://example.com/recipe1 and https://example.com/recipe2"

# Avoid: Generic URLs that might require navigation
contents = "Check https://example.com and find recipes"
```

### 2. Verify URL Accessibility

```python
# Ensure URLs don't require login or are behind paywalls
# The tool will fail to retrieve inaccessible content
```

### 3. Use Complete URLs

```python
# Good: Full URL with protocol
contents = "Analyze https://www.example.com/page"

# Avoid: Incomplete URLs
contents = "Analyze example.com/page"  # May not work correctly
```

### 4. Combine with Google Search

```python
# Use Google Search to find URLs, then URL context for deep analysis
response = await client.generate_content(
    contents="Find recent articles about AI and summarize the top 3",
    enable_url_context=True,
    enable_google_search=True
)
```

### 5. Monitor Token Usage

```python
# URL content increases input tokens
response = await client.generate_content(...)
if response.tool_use_prompt_token_count:
    print(f"URL content tokens: {response.tool_use_prompt_token_count}")
```

## Troubleshooting

### Common Issues

**Error: "Project ID required for Vertex AI"**
- Ensure `GEMINI_PROJECT_ID` is set
- Or set `GEMINI_USE_VERTEX_AI=false` and provide `GEMINI_API_KEY`

**Error: "API key required when not using Vertex AI"**
- Set `GEMINI_API_KEY` environment variable
- Or use Vertex AI by setting `GEMINI_PROJECT_ID`

**URLs not being retrieved**
- Check that URLs are accessible (no login required, not behind paywall)
- Verify URLs are complete (include https://)
- Check `url_context_metadata` for retrieval status
- Ensure model supports URL context tool

**High token usage**
- URL content counts as input tokens
- Monitor `tool_use_prompt_token_count` to see URL content token usage
- Consider using fewer URLs or shorter documents

**Unsafe URL error**
- URLs must pass content moderation checks
- Check `url_context_metadata.unsafe_urls` for URLs that failed safety checks

## Examples

### Example 1: Recipe Comparison

```python
async def compare_recipes():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Compare the ingredients and cooking times from https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592 and https://www.allrecipes.com/recipe/21151/simple-whole-roast-chicken/",
            enable_url_context=True
        )
        print(response.text)
        print(f"\nRetrieved URLs: {response.retrieved_urls}")

asyncio.run(compare_recipes())
```

### Example 2: Document Analysis

```python
async def analyze_document():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Extract key information from https://example.com/document.pdf including dates, names, and important facts",
            enable_url_context=True,
            response_mime_type="application/json"
        )
        print(response.text)

asyncio.run(analyze_document())
```

### Example 3: Multi-URL Synthesis

```python
async def synthesize_multiple_sources():
    async with GeminiURLContextClient(GeminiURLContextConfig.from_env()) as client:
        urls = [
            "https://example.com/article1",
            "https://example.com/article2",
            "https://example.com/article3"
        ]
        contents = f"Create a comprehensive summary combining information from {' '.join(urls)}"
        
        response = await client.generate_content(
            contents=contents,
            enable_url_context=True
        )
        print(response.text)
        print(f"\nSuccessfully retrieved {len(response.retrieved_urls)} out of {len(urls)} URLs")

asyncio.run(synthesize_multiple_sources())
```

## References

- [Gemini API URL Context Documentation](https://ai.google.dev/gemini-api/docs/url-context)
- [Gemini API URL Context Cookbook](https://ai.google.dev/gemini-api/docs/url-context-cookbook)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/quota)

## License

Internal use only.

