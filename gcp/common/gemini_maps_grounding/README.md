# Gemini Maps Grounding - Google Maps Grounding Support for Gemini API

A comprehensive Gemini API Google Maps Grounding integration module for location-aware content generation.

## Features

- **Google Maps Grounding Tool** - Enable Maps Grounding in generateContent calls
- **Location-Aware Queries** - Provide accurate, location-specific responses using Google Maps data
- **Widget Support** - Generate Google Maps widget context tokens for interactive maps
- **Grounding Metadata** - Access Maps citations, place IDs, and review IDs
- **Personalized Recommendations** - Tailor responses based on user-provided locations
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

from gemini_maps_grounding import GeminiMapsGroundingConfig, GeminiMapsGroundingClient

config = GeminiMapsGroundingConfig.from_env()
```

### Using Google Cloud Secret Manager

For production deployments, store configuration in GCP Secret Manager:

```bash
# Create secret with JSON config
echo '{"project_id": "...", "location": "...", "use_vertex_ai": true}' | \
  gcloud secrets create gemini-maps-grounding-config --data-file=-
```

Then load in code:

```python
from gemini_maps_grounding import GeminiMapsGroundingConfig, GeminiMapsGroundingClient

config = GeminiMapsGroundingConfig.from_gcp_secret_manager(
    project_id="your-secrets-project-id",
    config_secret="gemini-maps-grounding-config",
)
```

## Usage

### Basic Setup

```python
import asyncio
from gemini_maps_grounding import GeminiMapsGroundingClient, GeminiMapsGroundingConfig
from gemini_maps_grounding.models import LatLng

# Load configuration
config = GeminiMapsGroundingConfig.from_env()

# Create client
client = GeminiMapsGroundingClient(config)
```

### Basic Maps Grounding Usage

```python
async def find_restaurants():
    async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
        # Los Angeles coordinates
        user_location = LatLng(latitude=34.050481, longitude=-118.248526)

        response = await client.generate_content(
            contents="What are the best Italian restaurants within a 15-minute walk from here?",
            user_location=user_location,
            enable_maps_grounding=True
        )
        print(f"Response: {response.text}")

        # Access Maps citations
        for citation in response.maps_citations:
            print(f"- {citation.title}: {citation.uri}")

asyncio.run(find_restaurants())
```

### Location-Aware Recommendations

```python
async def local_recommendations():
    async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
        # User's location
        location = LatLng(latitude=37.7749, longitude=-122.4194)  # San Francisco

        response = await client.generate_content(
            contents="Find coffee shops near me that are open now",
            user_location=location
        )
        print(response.text)

        if response.has_maps_grounding:
            print(f"\nFound {len(response.maps_citations)} places")

asyncio.run(local_recommendations())
```

### Using Widget Context Token

```python
async def with_widget():
    async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
        location = LatLng(latitude=40.7589, longitude=-73.9851)  # Times Square

        response = await client.generate_content(
            contents="Show me museums near Times Square",
            user_location=location,
            enable_widget=True  # Enable widget context token
        )
        print(response.text)

        # Use widget context token to render interactive map
        if response.has_widget_token:
            print(f"\nWidget Token: {response.google_maps_widget_context_token}")
            # Render widget using the token (see Google Maps widget documentation)

asyncio.run(with_widget())
```

### Accessing Grounding Metadata

```python
async def explore_metadata():
    async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
        response = await client.generate_content(
            contents="What are the top-rated parks in Central Park area?",
            user_location=LatLng(latitude=40.7829, longitude=-73.9654)
        )

        if response.grounding_metadata:
            print("Grounding Metadata:")
            print(f"Retrieval queries: {response.grounding_metadata.retrieval_queries}")

            for chunk in response.grounding_metadata.grounding_chunks or []:
                if chunk.maps:
                    print(f"\nPlace: {chunk.maps.title}")
                    print(f"URI: {chunk.maps.uri}")
                    print(f"Place ID: {chunk.maps.place_id}")
                    if chunk.maps.review_id:
                        print(f"Review ID: {chunk.maps.review_id}")

asyncio.run(explore_metadata())
```

### Using Configuration Object

```python
from gemini_maps_grounding import GenerateContentConfig, LatLng

async def with_config():
    async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
        config = GenerateContentConfig(
            model="gemini-3.1-flash-lite",
            enable_maps_grounding=True,
            enable_widget=True,
            user_location=LatLng(latitude=34.0522, longitude=-118.2437),
            temperature=0.7,
            max_output_tokens=2048
        )

        response = await client.generate_content_with_config(
            contents="Find the best hiking trails near me",
            config=config
        )
        print(response.text)

asyncio.run(with_config())
```

### Queries Without Explicit Location

```python
async def general_query():
    async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
        # Maps Grounding works even without explicit location
        # for general queries about places
        response = await client.generate_content(
            contents="What are the most popular tourist attractions in Paris?",
            enable_maps_grounding=True
            # No user_location needed for general queries
        )
        print(response.text)
        print(f"\nCited {len(response.maps_citations)} places")

asyncio.run(general_query())
```

## API Reference

### GeminiMapsGroundingConfig

Configuration container for Gemini Maps Grounding.

| Attribute       | Type  | Description                                                   |
| --------------- | ----- | ------------------------------------------------------------- |
| `project_id`    | str   | GCP project ID (required for Vertex AI)                       |
| `location`      | str   | GCP location (default: 'us-central1')                         |
| `api_key`       | str   | Gemini API key (required if not using Vertex AI)              |
| `use_vertex_ai` | bool  | Whether to use Vertex AI (default: True if project_id is set) |
| `timeout`       | float | Request timeout in seconds (default: 60.0)                    |

### GeminiMapsGroundingClient Methods

#### Core Methods

- `generate_content(contents, model?, enable_maps_grounding?, enable_widget?, user_location?, temperature?, max_output_tokens?, response_mime_type?, response_schema?) -> GenerateContentResponse`
- `generate_content_with_config(contents, config) -> GenerateContentResponse`

### Request Models

#### GenerateContentConfig

```python
GenerateContentConfig(
    model: str = "gemini-3.1-flash-lite",        # Model to use
    temperature: float = None,              # Temperature (0.0-2.0)
    top_p: float = None,                    # Top-p sampling (0.0-1.0)
    top_k: int = None,                      # Top-k sampling
    max_output_tokens: int = None,          # Max output tokens
    enable_maps_grounding: bool = True,      # Enable Maps Grounding tool
    enable_widget: bool = False,             # Enable widget context token
    user_location: LatLng = None,           # User location for location-aware queries
    response_mime_type: str = None,         # Response MIME type
    response_schema: Dict = None,           # Response schema for structured output
)
```

#### LatLng

```python
LatLng(
    latitude: float,   # Latitude (-90 to 90)
    longitude: float,  # Longitude (-180 to 180)
)
```

### Response Models

#### GenerateContentResponse

```python
response.text                              # Generated text content
response.grounding_metadata                 # GroundingMetadata or None
response.google_maps_widget_context_token  # Widget context token or None
response.model                             # Model used
response.finish_reason                     # Finish reason
response.usage_metadata                    # Token usage metadata

# Convenience properties
response.maps_citations                    # List[MapsChunk] - Maps citations
response.has_maps_grounding                # bool - has Maps grounding
response.has_widget_token                  # bool - has widget token
response.prompt_token_count                # int - prompt tokens
response.candidates_token_count            # int - response tokens
response.total_token_count                 # int - total tokens
```

#### GroundingMetadata

```python
grounding_metadata.grounding_chunks        # List[GroundingChunk] - grounding chunks
grounding_metadata.retrieval_queries       # List[str] - retrieval queries
grounding_metadata.maps_citations          # List[MapsChunk] - Maps citations
grounding_metadata.has_maps_citations      # bool - has Maps citations
```

#### MapsChunk

```python
maps_chunk.title                           # str - Place title
maps_chunk.uri                             # str - Google Maps URI
maps_chunk.place_id                        # str - Google Maps Place ID
maps_chunk.review_id                       # str - Review ID (if from review)
```

## Supported Models

Examples in this package use `gemini-3.1-flash-lite`.

See the [official documentation](https://ai.google.dev/gemini-api/docs/maps-grounding) for the complete list.

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
from gemini_maps_grounding import GeminiMapsGroundingClient, GeminiMapsGroundingConfig
from gemini_maps_grounding.client import GeminiMapsGroundingError

async def safe_query():
    try:
        async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
            response = await client.generate_content(
                contents="Find restaurants near me",
                user_location=LatLng(latitude=34.0522, longitude=-118.2437)
            )
            print(response.text)
    except GeminiMapsGroundingError as e:
        print(f"Gemini Maps Grounding error: {e}")
        print(f"Status code: {e.status_code}")
        print(f"Details: {e.details}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_query())
```

## Pricing and Rate Limits

- **Pricing:** $25 per 1K grounded prompts
- **Free Tier:** Up to 500 requests per day
- **Billing:** Only counts requests that successfully return at least one Google Maps grounded result
- **Rate Limits:** Typically aligns with underlying Gemini model rate limits

For detailed pricing information, see the [Gemini API pricing page](https://ai.google.dev/pricing).

## Limitations

### Geographical Scope

- Globally available

### Model Support

- Only specific Gemini models support Maps Grounding (see Supported Models above)
- **Not available** with Gemini 3 or Gemini 2.0 Flash Lite

### Multimodal Support

- Currently supports text input/output only
- Does not support multimodal inputs/outputs beyond text and contextual map widgets

### Prohibited Territories

Maps Grounding cannot be distributed or marketed in:

- China
- Crimea
- Cuba
- Donetsk People's Republic
- Iran
- Luhansk People's Republic
- North Korea
- Syria
- Vietnam

### Prohibited Activities

- Cannot be used for high-risk activities including emergency response services

## Best Practices

### 1. Provide User Location

```python
# Always include user location when available for best results
response = await client.generate_content(
    contents="Find coffee shops near me",
    user_location=LatLng(latitude=user_lat, longitude=user_lng)
)
```

### 2. Render Google Maps Widget

```python
# Enable widget token to render interactive maps
response = await client.generate_content(
    contents="Show restaurants near me",
    user_location=location,
    enable_widget=True
)

if response.has_widget_token:
    # Render widget using google_maps_widget_context_token
    # See Google Maps widget documentation for implementation
    pass
```

### 3. Inform End-Users

```python
# Clearly inform users that Google Maps data is being used
print("Results powered by Google Maps")
```

### 4. Toggle When Needed

```python
# Only enable Maps Grounding when query has geographical context
has_geo_context = any(keyword in query.lower() for keyword in ["near", "nearby", "location", "where"])

if has_geo_context:
    response = await client.generate_content(
        contents=query,
        enable_maps_grounding=True,
        user_location=user_location
    )
```

### 5. Monitor Latency

```python
import time

start = time.time()
response = await client.generate_content(...)
latency = time.time() - start

# Ensure P95 latency remains within acceptable thresholds
if latency > threshold:
    logger.warning(f"High latency: {latency}s")
```

## Attribution Requirements

When displaying Maps citations, you must:

1. **Attribute to Google Maps** - Include "Google Maps" text attribution
2. **Link to source** - Link to the Google Maps URI provided in citations
3. **Follow styling guidelines** - Use Roboto font, proper sizing, and accessible colors
4. **Include favicon** (optional) - Add Google Maps favicon before attribution text

See the [official documentation](https://ai.google.dev/gemini-api/docs/maps-grounding#attribution) for complete attribution requirements.

## Troubleshooting

### Common Issues

**Error: "Project ID required for Vertex AI"**

- Ensure `GEMINI_PROJECT_ID` is set
- Or set `GEMINI_USE_VERTEX_AI=false` and provide `GEMINI_API_KEY`

**Error: "API key required when not using Vertex AI"**

- Set `GEMINI_API_KEY` environment variable
- Or use Vertex AI by setting `GEMINI_PROJECT_ID`

**No Maps citations in response**

- Ensure query has geographical context
- Check that model supports Maps Grounding
- Verify Maps Grounding is enabled (`enable_maps_grounding=True`)

**Widget token not returned**

- Ensure `enable_widget=True` is set
- Widget tokens are only returned when widget is enabled

**High latency**

- Monitor response times
- Consider caching frequently requested locations
- Optimize query specificity

## Examples

### Example 1: Restaurant Recommendations

```python
async def restaurant_recommendations():
    async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
        location = LatLng(latitude=34.050481, longitude=-118.248526)  # Los Angeles

        response = await client.generate_content(
            contents="What are the best Italian restaurants within a 15-minute walk from here?",
            user_location=location,
            enable_widget=True
        )
        print(response.text)

        print("\nSources:")
        for citation in response.maps_citations:
            print(f"- [{citation.title}]({citation.uri})")

asyncio.run(restaurant_recommendations())
```

### Example 2: Trip Planning

```python
async def plan_trip():
    async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Create a 3-day itinerary for visiting museums and parks in San Francisco",
            user_location=LatLng(latitude=37.7749, longitude=-122.4194)
        )
        print(response.text)

        # Extract place IDs for further processing
        place_ids = [citation.place_id for citation in response.maps_citations if citation.place_id]
        print(f"\nFound {len(place_ids)} places")

asyncio.run(plan_trip())
```

### Example 3: Local Business Search

```python
async def find_businesses():
    async with GeminiMapsGroundingClient(GeminiMapsGroundingConfig.from_env()) as client:
        response = await client.generate_content(
            contents="Find hardware stores near me that are open on Sundays",
            user_location=LatLng(latitude=40.7589, longitude=-73.9851),
            enable_maps_grounding=True
        )

        print(response.text)

        # Access detailed citation information
        if response.grounding_metadata:
            for chunk in response.grounding_metadata.grounding_chunks or []:
                if chunk.maps:
                    print(f"\n{chunk.maps.title}")
                    print(f"  Place ID: {chunk.maps.place_id}")
                    print(f"  Maps URL: {chunk.maps.uri}")

asyncio.run(find_businesses())
```

## References

- [Gemini API Maps Grounding Documentation](https://ai.google.dev/gemini-api/docs/maps-grounding)
- [Google Maps Widget Documentation](https://developers.google.com/maps/documentation/widgets)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/quota)
- [Google Maps Attribution Guidelines](https://ai.google.dev/gemini-api/docs/maps-grounding#attribution)

## License

Internal use only.
