"""
Pydantic models for Geocoding service.

Supports:
- Geocoding request/response models
- Location and geometry data structures
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class Location(BaseModel):
    """Geographic coordinates."""
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")


class Geometry(BaseModel):
    """Geometry information for a geocoded location."""
    location: Location = Field(..., description="Lat/lng coordinates")
    location_type: Optional[str] = Field(None, description="Type of location (ROOFTOP, RANGE_INTERPOLATED, etc.)")
    viewport: Optional[Dict[str, Any]] = Field(None, description="Recommended viewport for displaying result")
    bounds: Optional[Dict[str, Any]] = Field(None, description="Bounding box for the result")


class GeocodeRequest(BaseModel):
    """Request for geocoding an address."""
    address: str = Field(..., description="Address to geocode")
    region: Optional[str] = Field(None, description="Region code for biasing results (e.g., 'us')")
    bounds: Optional[Dict[str, Any]] = Field(None, description="Bounding box to bias results")
    language: Optional[str] = Field(None, description="Language for results (e.g., 'en')")


class GeocodeResponse(BaseModel):
    """Response from geocoding service."""
    address: str = Field(..., description="Original address that was geocoded")
    location: Optional[Location] = Field(None, description="Geocoded coordinates")
    formatted_address: Optional[str] = Field(None, description="Formatted address from geocoding service")
    geometry: Optional[Geometry] = Field(None, description="Full geometry information")
    place_id: Optional[str] = Field(None, description="Google Place ID")
    success: bool = Field(..., description="Whether geocoding was successful")
    error_message: Optional[str] = Field(None, description="Error message if geocoding failed")
    
    @property
    def has_location(self) -> bool:
        """Check if response has valid location coordinates."""
        return self.location is not None
    
    @property
    def lat(self) -> Optional[float]:
        """Get latitude from location."""
        if self.location:
            return self.location.lat
        return None
    
    @property
    def lng(self) -> Optional[float]:
        """Get longitude from location."""
        if self.location:
            return self.location.lng
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with lat/lng."""
        return {
            "address": self.address,
            "formatted_address": self.formatted_address,
            "lat": self.lat,
            "lng": self.lng,
            "success": self.success,
            "error_message": self.error_message,
        }

