"""Pydantic models for unified search location (single source of truth for market/geo)."""

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

SearchLocationSource = Literal["property_address", "device_gps"]

DEFAULT_SEARCH_RADIUS_MILES = 5
MIN_SEARCH_RADIUS_MILES = 5
MAX_SEARCH_RADIUS_MILES = 100


class SearchLocationCoordinates(BaseModel):
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")


class SearchLocation(BaseModel):
    """Resolved geographic anchor for local pros, cost locality, DIY/shopping searches."""

    source: SearchLocationSource = Field(
        ...,
        description="property_address: geocoded property; device_gps: client coordinates",
    )
    radius_miles: int = Field(
        default=DEFAULT_SEARCH_RADIUS_MILES,
        description="Search radius in miles for local market queries",
    )
    coordinates: SearchLocationCoordinates = Field(
        ...,
        description="Resolved lat/lng (always set after proxy resolution)",
    )
    label: Optional[str] = Field(
        default=None,
        description="Human-readable place label (formatted address or reverse-geocoded)",
    )

    @field_validator("radius_miles")
    @classmethod
    def clamp_radius(cls, v: int) -> int:
        if v < MIN_SEARCH_RADIUS_MILES:
            return MIN_SEARCH_RADIUS_MILES
        if v > MAX_SEARCH_RADIUS_MILES:
            return MAX_SEARCH_RADIUS_MILES
        return v

    def to_agent_dict(self) -> dict:
        return {
            "source": self.source,
            "radius_miles": self.radius_miles,
            "coordinates": {"lat": self.coordinates.lat, "lng": self.coordinates.lng},
            "label": self.label,
        }


class SearchLocationInput(BaseModel):
    """Client-provided search location before proxy resolution."""

    source: SearchLocationSource
    radius_miles: Optional[int] = None
    coordinates: Optional[SearchLocationCoordinates] = None

    class Config:
        extra = "ignore"
