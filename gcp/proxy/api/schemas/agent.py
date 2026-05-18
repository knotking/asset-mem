from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator
from utils.optional_agents import normalize_checkpoint_optional_agents


class SearchLocationCoordinatesRequest(BaseModel):
    lat: float
    lng: float


class SearchLocationRequest(BaseModel):
    """Client search location (resolved to canonical search_location in proxy)."""

    source: Literal["property_address", "device_gps"]
    radius_miles: Optional[int] = Field(default=None, description="Search radius in miles (5-100)")
    coordinates: Optional[SearchLocationCoordinatesRequest] = Field(
        default=None,
        description="Required when source is device_gps",
    )


class AgentRequest(BaseModel):
    user_id: str = Field(description="Unique identifier for the user")
    session_id: Optional[str] = Field(default="", description="Session ID for the conversation context")
    user_query: str = Field(default="Analyse", description="The query or prompt from the user")
    context_doc_uris: List[str] = Field(default_factory=list, description="List of GCS URIs for context documents")
    diagnosis_uris: List[str] = Field(default_factory=list, description="List of GCS URIs for diagnosis documents")
    checkpoint_ids: Optional[List[str]] = Field(default=None, description="Checkpoint IDs for checkpoint context (enables checkpoint_agent routing)")
    property_address: str = Field(
        default="",
        description="Property record address (identity/context only, not market geo)",
    )
    search_location: Optional[SearchLocationRequest] = Field(
        default=None,
        description="Unified search/market location (resolved server-side for agents)",
    )
    property_id: Optional[str] = Field(default=None, description="Property ID for property-specific queries (e.g., checkpoint retrieval)")
    primary_agent: Optional[Literal["checkpoint", "docs"]] = Field(default=None, description="Primary agent selection for explicit routing: 'checkpoint' for checkpoint queries, 'docs' for document queries")
    checkpoint_optional_agents: List[str] = Field(default_factory=list, description="List of optional agents to include in checkpoint analysis")
    # Deprecated: use search_location; kept for backward compatibility during client rollout
    location_type: Optional[Literal["address", "location"]] = Field(
        default=None,
        description="Deprecated. Use search_location.source instead.",
    )
    location_coordinates: Optional[Dict[str, float]] = Field(
        default=None,
        description="Deprecated. Use search_location.coordinates instead.",
    )
    location_radius: Optional[int] = Field(
        default=None,
        description="Deprecated. Use search_location.radius_miles instead.",
    )

    @field_validator('user_id')
    @classmethod
    def user_id_must_not_be_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("User ID is required")
        return v

    @field_validator('checkpoint_optional_agents', mode='before')
    @classmethod
    def normalize_checkpoint_agents(cls, v):
        return normalize_checkpoint_optional_agents(v)

class SessionRequest(BaseModel):
    user_id: str = Field(description="Unique identifier for the user")
    session_id: Optional[str] = Field(default=None, description="Session ID to operate on")

class UserUploadResultEvent(BaseModel):
    user_id: str
    user_query: str
    gcs_urls: List[str]
    success: bool = Field(default=True)
    error: str = Field(default="")
    source: str = Field(default="unknown")
    result: Dict[str, Any] | str = Field(default_factory=dict)

