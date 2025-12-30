"""
Geocoding Client for address to coordinate conversion.

Provides async methods for:
- Converting addresses to lat/lng coordinates
- Handling geocoding errors gracefully
- Caching results for performance
"""

import asyncio
import logging
from typing import Optional, Dict, Any

from .config import GeocodingConfig
from .models import GeocodeRequest, GeocodeResponse, Location, Geometry

logger = logging.getLogger(__name__)


class GeocodingError(Exception):
    """Base exception for Geocoding client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class GeocodingClient:
    """
    Client for Geocoding API operations.
    
    Supports converting addresses to lat/lng coordinates using Google Maps Geocoding API.
    
    Example:
        config = GeocodingConfig.from_env()
        client = GeocodingClient(config)
        
        # Geocode an address
        response = await client.geocode("1600 Amphitheatre Parkway, Mountain View, CA")
        if response.success:
            print(f"Coordinates: {response.lat}, {response.lng}")
            print(f"Formatted address: {response.formatted_address}")
    """
    
    def __init__(self, config: GeocodingConfig):
        """
        Initialize Geocoding client.
        
        Args:
            config: GeocodingConfig instance
        """
        self.config = config
        self._cache: Dict[str, GeocodeResponse] = {}
    
    async def geocode(
        self,
        address: str,
        region: Optional[str] = None,
        use_cache: bool = True,
    ) -> GeocodeResponse:
        """
        Geocode an address to get lat/lng coordinates.
        
        Args:
            address: Address to geocode
            region: Optional region code for biasing results (e.g., 'us')
            use_cache: Whether to use cached results (default: True)
            
        Returns:
            GeocodeResponse: Geocoding result with coordinates
            
        Example:
            response = await client.geocode("1600 Amphitheatre Parkway, Mountain View, CA")
            if response.success:
                print(f"Lat: {response.lat}, Lng: {response.lng}")
        """
        # Check cache first
        cache_key = f"{address}:{region or ''}"
        if use_cache and cache_key in self._cache:
            logger.debug(f"Returning cached geocoding result for: {address}")
            return self._cache[cache_key]
        
        # Validate config
        if not self.config.api_key:
            logger.error("Geocoding API key not configured")
            return GeocodeResponse(
                address=address,
                success=False,
                error_message="Geocoding API key not configured",
            )
        
        try:
            import aiohttp
            
            # Build request URL
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                "address": address,
                "key": self.config.api_key,
            }
            
            if region:
                params["region"] = region
            
            # Make API request
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=self.config.timeout)
                ) as response:
                    if response.status != 200:
                        error_msg = f"Geocoding API returned status {response.status}"
                        logger.error(error_msg)
                        return GeocodeResponse(
                            address=address,
                            success=False,
                            error_message=error_msg,
                        )
                    
                    data = await response.json()
            
            # Parse response
            status = data.get("status")
            
            if status == "OK" and data.get("results"):
                result = data["results"][0]
                
                # Extract location
                geometry_data = result.get("geometry", {})
                location_data = geometry_data.get("location", {})
                
                if "lat" in location_data and "lng" in location_data:
                    location = Location(
                        lat=location_data["lat"],
                        lng=location_data["lng"],
                    )
                    
                    # Extract geometry
                    geometry = Geometry(
                        location=location,
                        location_type=geometry_data.get("location_type"),
                        viewport=geometry_data.get("viewport"),
                        bounds=geometry_data.get("bounds"),
                    )
                    
                    geocode_response = GeocodeResponse(
                        address=address,
                        location=location,
                        formatted_address=result.get("formatted_address"),
                        geometry=geometry,
                        place_id=result.get("place_id"),
                        success=True,
                    )
                    
                    # Cache the result
                    if use_cache:
                        self._cache[cache_key] = geocode_response
                    
                    logger.info(f"Successfully geocoded address: {address}")
                    return geocode_response
            
            # Handle various error statuses
            error_messages = {
                "ZERO_RESULTS": "No results found for the address",
                "OVER_QUERY_LIMIT": "Geocoding API quota exceeded",
                "REQUEST_DENIED": "Geocoding API request denied",
                "INVALID_REQUEST": "Invalid geocoding request",
                "UNKNOWN_ERROR": "Unknown geocoding error",
            }
            
            error_msg = error_messages.get(status, f"Geocoding failed with status: {status}")
            logger.warning(f"Geocoding failed for address '{address}': {error_msg}")
            
            return GeocodeResponse(
                address=address,
                success=False,
                error_message=error_msg,
            )
            
        except asyncio.TimeoutError:
            error_msg = f"Geocoding request timed out after {self.config.timeout}s"
            logger.error(error_msg)
            return GeocodeResponse(
                address=address,
                success=False,
                error_message=error_msg,
            )
        except Exception as e:
            error_msg = f"Geocoding error: {str(e)}"
            logger.error(error_msg)
            return GeocodeResponse(
                address=address,
                success=False,
                error_message=error_msg,
            )
    
    async def geocode_with_request(
        self,
        request: GeocodeRequest,
        use_cache: bool = True,
    ) -> GeocodeResponse:
        """
        Geocode using a GeocodeRequest object.
        
        Args:
            request: GeocodeRequest instance
            use_cache: Whether to use cached results (default: True)
            
        Returns:
            GeocodeResponse: Geocoding result with coordinates
        """
        return await self.geocode(
            address=request.address,
            region=request.region,
            use_cache=use_cache,
        )
    
    def clear_cache(self):
        """Clear the geocoding cache."""
        self._cache.clear()
        logger.debug("Geocoding cache cleared")
    
    async def close(self):
        """Close the client connection."""
        self.clear_cache()

