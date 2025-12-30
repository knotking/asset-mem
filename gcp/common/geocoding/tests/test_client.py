"""
Tests for Geocoding Client.

Run with: pytest gcp/common/geocoding/tests/test_client.py -v
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from geocoding import GeocodingClient, GeocodingConfig, GeocodeResponse, Location


@pytest.fixture
def geocoding_config():
    """Create a test geocoding config."""
    return GeocodingConfig(
        api_key="test-api-key",
        timeout=10.0,
    )


@pytest.fixture
def geocoding_client(geocoding_config):
    """Create a test geocoding client."""
    return GeocodingClient(geocoding_config)


@pytest.mark.asyncio
async def test_geocode_success(geocoding_client):
    """Test successful geocoding of an address."""
    mock_response = {
        "status": "OK",
        "results": [
            {
                "formatted_address": "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA",
                "geometry": {
                    "location": {"lat": 37.4224764, "lng": -122.0842499},
                    "location_type": "ROOFTOP",
                },
                "place_id": "ChIJ2eUgeAK6j4ARbn5u_wAGqWA",
            }
        ],
    }
    
    with patch("aiohttp.ClientSession") as mock_session:
        mock_get = AsyncMock()
        mock_get.return_value.__aenter__.return_value.status = 200
        mock_get.return_value.__aenter__.return_value.json = AsyncMock(return_value=mock_response)
        mock_session.return_value.__aenter__.return_value.get = mock_get
        
        response = await geocoding_client.geocode("1600 Amphitheatre Parkway, Mountain View, CA")
        
        assert response.success is True
        assert response.lat == 37.4224764
        assert response.lng == -122.0842499
        assert response.formatted_address == "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA"
        assert response.place_id == "ChIJ2eUgeAK6j4ARbn5u_wAGqWA"


@pytest.mark.asyncio
async def test_geocode_zero_results(geocoding_client):
    """Test geocoding with no results found."""
    mock_response = {
        "status": "ZERO_RESULTS",
        "results": [],
    }
    
    with patch("aiohttp.ClientSession") as mock_session:
        mock_get = AsyncMock()
        mock_get.return_value.__aenter__.return_value.status = 200
        mock_get.return_value.__aenter__.return_value.json = AsyncMock(return_value=mock_response)
        mock_session.return_value.__aenter__.return_value.get = mock_get
        
        response = await geocoding_client.geocode("invalid address xyz123")
        
        assert response.success is False
        assert response.error_message == "No results found for the address"
        assert response.lat is None
        assert response.lng is None


@pytest.mark.asyncio
async def test_geocode_api_error(geocoding_client):
    """Test geocoding with API error."""
    with patch("aiohttp.ClientSession") as mock_session:
        mock_get = AsyncMock()
        mock_get.return_value.__aenter__.return_value.status = 500
        mock_get.return_value.__aenter__.return_value.text = AsyncMock(return_value="Internal Server Error")
        mock_session.return_value.__aenter__.return_value.get = mock_get
        
        response = await geocoding_client.geocode("123 Main St")
        
        assert response.success is False
        assert "status 500" in response.error_message


@pytest.mark.asyncio
async def test_geocode_no_api_key():
    """Test geocoding without API key."""
    config = GeocodingConfig(api_key=None)
    client = GeocodingClient(config)
    
    response = await client.geocode("123 Main St")
    
    assert response.success is False
    assert "API key not configured" in response.error_message


@pytest.mark.asyncio
async def test_geocode_caching(geocoding_client):
    """Test that geocoding results are cached."""
    mock_response = {
        "status": "OK",
        "results": [
            {
                "formatted_address": "123 Main St, City, State",
                "geometry": {
                    "location": {"lat": 40.7128, "lng": -74.0060},
                    "location_type": "ROOFTOP",
                },
                "place_id": "test-place-id",
            }
        ],
    }
    
    with patch("aiohttp.ClientSession") as mock_session:
        mock_get = AsyncMock()
        mock_get.return_value.__aenter__.return_value.status = 200
        mock_get.return_value.__aenter__.return_value.json = AsyncMock(return_value=mock_response)
        mock_session.return_value.__aenter__.return_value.get = mock_get
        
        # First call - should hit API
        response1 = await geocoding_client.geocode("123 Main St")
        assert response1.success is True
        assert mock_get.call_count == 1
        
        # Second call - should use cache
        response2 = await geocoding_client.geocode("123 Main St")
        assert response2.success is True
        assert response2.lat == response1.lat
        assert response2.lng == response1.lng
        # Call count should still be 1 (cached)
        assert mock_get.call_count == 1


@pytest.mark.asyncio
async def test_geocode_with_region(geocoding_client):
    """Test geocoding with region biasing."""
    mock_response = {
        "status": "OK",
        "results": [
            {
                "formatted_address": "123 Main St, City, State, USA",
                "geometry": {
                    "location": {"lat": 40.7128, "lng": -74.0060},
                    "location_type": "ROOFTOP",
                },
                "place_id": "test-place-id",
            }
        ],
    }
    
    with patch("aiohttp.ClientSession") as mock_session:
        mock_get = AsyncMock()
        mock_get.return_value.__aenter__.return_value.status = 200
        mock_get.return_value.__aenter__.return_value.json = AsyncMock(return_value=mock_response)
        mock_session.return_value.__aenter__.return_value.get = mock_get
        
        response = await geocoding_client.geocode("123 Main St", region="us")
        
        assert response.success is True
        # Verify region parameter was passed
        call_kwargs = mock_get.call_args[1]
        assert "params" in call_kwargs
        assert call_kwargs["params"]["region"] == "us"


def test_geocode_response_properties():
    """Test GeocodeResponse properties."""
    location = Location(lat=37.4224764, lng=-122.0842499)
    response = GeocodeResponse(
        address="1600 Amphitheatre Parkway",
        location=location,
        formatted_address="1600 Amphitheatre Parkway, Mountain View, CA",
        success=True,
    )
    
    assert response.has_location is True
    assert response.lat == 37.4224764
    assert response.lng == -122.0842499
    
    response_dict = response.to_dict()
    assert response_dict["lat"] == 37.4224764
    assert response_dict["lng"] == -122.0842499
    assert response_dict["success"] is True


def test_geocode_response_no_location():
    """Test GeocodeResponse without location."""
    response = GeocodeResponse(
        address="invalid address",
        success=False,
        error_message="No results found",
    )
    
    assert response.has_location is False
    assert response.lat is None
    assert response.lng is None

