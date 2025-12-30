# Geocoding Service

Geocoding utilities for converting addresses to geographic coordinates (latitude/longitude).

## Features

- **Address to Coordinates**: Convert street addresses to lat/lng coordinates
- **Google Maps Integration**: Uses Google Maps Geocoding API
- **Error Handling**: Graceful error handling with fallback mechanisms
- **Caching**: Built-in response caching for performance
- **Async Support**: Fully asynchronous API

## Installation

```bash
pip install aiohttp pydantic
```

## Configuration

### Environment Variables

```bash
# Required
export GOOGLE_MAPS_API_KEY="your-google-maps-api-key"

# Optional
export GEOCODING_TIMEOUT="10"  # Request timeout in seconds (default: 10)
export GEOCODING_USE_PLACES_API="false"  # Use Places API for enhanced results
```

### From Code

```python
from geocoding import GeocodingConfig, GeocodingClient

# From environment variables
config = GeocodingConfig.from_env()

# Direct configuration
config = GeocodingConfig(
    api_key="your-api-key",
    timeout=10.0,
)

client = GeocodingClient(config)
```

## Usage

### Basic Geocoding

```python
from geocoding import GeocodingConfig, GeocodingClient

config = GeocodingConfig.from_env()
client = GeocodingClient(config)

# Geocode an address
response = await client.geocode("1600 Amphitheatre Parkway, Mountain View, CA")

if response.success:
    print(f"Coordinates: {response.lat}, {response.lng}")
    print(f"Formatted address: {response.formatted_address}")
else:
    print(f"Geocoding failed: {response.error_message}")
```

### With Region Biasing

```python
# Bias results to US region
response = await client.geocode(
    "123 Main St",
    region="us"
)
```

### Using Request Object

```python
from geocoding import GeocodeRequest

request = GeocodeRequest(
    address="1600 Amphitheatre Parkway, Mountain View, CA",
    region="us",
)

response = await client.geocode_with_request(request)
```

### Response Structure

```python
response = await client.geocode("123 Main St, City, State")

# Access coordinates
lat = response.lat  # or response.location.lat
lng = response.lng  # or response.location.lng

# Check success
if response.success:
    print(f"Success! Location: {lat}, {lng}")
else:
    print(f"Error: {response.error_message}")

# Get formatted address
print(response.formatted_address)

# Get full geometry
print(response.geometry.location_type)  # e.g., "ROOFTOP"
```

## Error Handling

The client handles various error scenarios gracefully:

- **No API Key**: Returns error response with appropriate message
- **Invalid Address**: Returns error with "ZERO_RESULTS" status
- **API Quota Exceeded**: Returns error with "OVER_QUERY_LIMIT" status
- **Network Timeout**: Returns error after configured timeout
- **API Errors**: Returns error with status and message

```python
response = await client.geocode("invalid address xyz123")

if not response.success:
    print(f"Error: {response.error_message}")
    # Continue with fallback logic
```

## Caching

The client automatically caches geocoding results:

```python
# First call - makes API request
response1 = await client.geocode("123 Main St")

# Second call - returns cached result
response2 = await client.geocode("123 Main St")

# Disable caching for a specific request
response3 = await client.geocode("123 Main St", use_cache=False)

# Clear cache
client.clear_cache()
```

## Integration Example

```python
async def get_service_providers_near_address(address: str, radius_miles: int = 50):
    """Find service providers near an address."""
    
    # Geocode the address
    geocoding_client = GeocodingClient(GeocodingConfig.from_env())
    geocode_response = await geocoding_client.geocode(address)
    
    if not geocode_response.success:
        # Fallback: use address string directly
        return search_by_address(address)
    
    # Use coordinates for precise radius search
    return search_by_coordinates(
        lat=geocode_response.lat,
        lng=geocode_response.lng,
        radius=radius_miles
    )
```

## API Reference

### GeocodingConfig

Configuration class for the geocoding client.

**Attributes:**
- `api_key`: Google Maps API key
- `timeout`: Request timeout in seconds
- `use_places_api`: Whether to use Places API

**Methods:**
- `from_env()`: Load config from environment variables
- `from_gcp_secret_manager()`: Load config from Secret Manager
- `validate()`: Validate configuration

### GeocodingClient

Client for geocoding operations.

**Methods:**
- `geocode(address, region=None, use_cache=True)`: Geocode an address
- `geocode_with_request(request, use_cache=True)`: Geocode using request object
- `clear_cache()`: Clear the geocoding cache
- `close()`: Close the client

### GeocodeResponse

Response from geocoding operation.

**Attributes:**
- `address`: Original address
- `location`: Location object with lat/lng
- `formatted_address`: Formatted address from API
- `geometry`: Full geometry information
- `place_id`: Google Place ID
- `success`: Whether geocoding succeeded
- `error_message`: Error message if failed

**Properties:**
- `has_location`: Check if response has valid coordinates
- `lat`: Latitude (shortcut)
- `lng`: Longitude (shortcut)

## Testing

```python
import pytest
from geocoding import GeocodingConfig, GeocodingClient

@pytest.mark.asyncio
async def test_geocode_success():
    config = GeocodingConfig(api_key="test-key")
    client = GeocodingClient(config)
    
    response = await client.geocode("1600 Amphitheatre Parkway, Mountain View, CA")
    
    assert response.success
    assert response.lat is not None
    assert response.lng is not None
```

