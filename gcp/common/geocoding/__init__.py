"""
Geocoding utilities for converting addresses to coordinates.

Provides:
- Google Maps Geocoding API integration
- Address to lat/lng conversion
- Error handling and fallback mechanisms
"""

from .client import GeocodingClient, GeocodingError
from .config import GeocodingConfig
from .models import GeocodeRequest, GeocodeResponse, Location, Geometry

__all__ = [
    "GeocodingClient",
    "GeocodingError",
    "GeocodingConfig",
    "GeocodeRequest",
    "GeocodeResponse",
    "Location",
    "Geometry",
]

