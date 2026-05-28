from pydantic import BaseModel, Field
from typing import List, Optional, Literal

CheckpointOptionalAgent = Literal["coverage", "diy", "service", "cost"]
PrimaryAgent = Literal["checkpoint", "docs"]
SearchLocationSource = Literal["property_address", "device_gps"]

DEFAULT_CHECKPOINT_OPTIONAL_AGENTS: List[CheckpointOptionalAgent] = []


class SearchLocationCoordinates(BaseModel):
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")


class SearchLocation(BaseModel):
    """Resolved market/geo anchor (single source of truth for local search, cost, DIY)."""

    source: SearchLocationSource = Field(
        ...,
        description="property_address: geocoded property; device_gps: user device location",
    )
    radius_miles: int = Field(
        default=5,
        ge=5,
        le=100,
        description="Search radius in miles for local market queries (5-100)",
    )
    coordinates: SearchLocationCoordinates = Field(
        ...,
        description="Resolved lat/lng",
    )
    label: Optional[str] = Field(
        default=None,
        description="Human-readable label (formatted address or place name)",
    )


class DiagnosisInput(BaseModel):
    user_query: str = Field(description="The user query.")
    correlation_id: Optional[str] = Field(
        default=None,
        description="Client/proxy request correlation id (X-Request-ID) for log tracing.",
    )
    context_doc_uris: Optional[List[str]] = Field(
        default=None, description="The context document URIs."
    )
    checkpoint_ids: Optional[List[str]] = Field(
        default=None,
        description="Checkpoint IDs for checkpoint context (checkpoint retrieval when provided).",
    )
    property_address: Optional[str] = Field(
        default=None,
        description="Property record address (identity/context only, not market geo).",
    )
    property_id: Optional[str] = Field(
        default=None,
        description="Property ID for property-specific queries (e.g., checkpoint retrieval).",
    )
    primary_agent: Optional[PrimaryAgent] = Field(
        default=None,
        description=(
            "Client UI tab hint: 'checkpoint' or 'docs'. Passed to resolve_turn_llm as context "
            "(with checkpoint_ids and checkpoint_optional_agents); the orchestrator still "
            "chooses tools via resolve output, not this field alone."
        ),
    )
    checkpoint_optional_agents: Optional[List[CheckpointOptionalAgent]] = Field(
        default=None,
        description=(
            "Optional list of checkpoint analysis sub-agents to run after checkpoint retrieval. "
            "Allowed values: coverage, diy, service, cost. When provided and non-empty, triggers comprehensive "
            "checkpoint analysis with recommendations. When empty or None, returns simple checkpoint query results."
        ),
    )
    search_location: Optional[SearchLocation] = Field(
        default=None,
        description="Unified search/market location for service, cost, DIY, and shopping.",
    )

    class Config:
        extra = "ignore"


class DocsInput(BaseModel):
    user_query: str = Field(description="The user query for the property agent.")
    correlation_id: Optional[str] = Field(
        default=None,
        description="Client/proxy request correlation id (X-Request-ID) for log tracing.",
    )
    context_doc_uris: Optional[List[str]] = Field(
        default=None, description="Context document URIs for user-docs retrieval."
    )
    checkpoint_ids: Optional[List[str]] = Field(
        default=None,
        description="Checkpoint IDs for checkpoint context (input to run_checkpoint_pipeline when new analysis is needed).",
    )
    property_address: Optional[str] = Field(
        default=None,
        description="Property record address (identity/context only, not market geo).",
    )
    property_id: Optional[str] = Field(
        default=None,
        description="Property ID for property-specific queries (e.g., checkpoint retrieval).",
    )
    search_location: Optional[SearchLocation] = Field(
        default=None,
        description="Unified search/market location for service, cost, DIY, and shopping.",
    )
    checkpoint_retrieval_search_query: Optional[str] = Field(
        default=None,
        description=(
            "Short issue stem from checkpoint retrieval (location + issues). "
            "Checkpoint flows only: primary search phrase for cost/coverage context."
        ),
    )
    checkpoint_service_trade_query: Optional[str] = Field(
        default=None,
        description=(
            "Checkpoint flows only: Maps/google_search query for licensed trade "
            "contractors (from branch search intents)."
        ),
    )
    checkpoint_branch_search_intents: Optional[dict] = Field(
        default=None,
        description=(
            "Checkpoint flows only: branch-specific search intents "
            "(youtube_query, shopping_materials, service_trade_query)."
        ),
    )
    checkpoint_optional_agents: Optional[List[CheckpointOptionalAgent]] = Field(
        default=None,
        description=(
            "Optional list of checkpoint analysis sub-agents to run after checkpoint retrieval. "
            "Allowed values: coverage, diy, service, cost. When provided and non-empty, triggers comprehensive "
            "checkpoint analysis with recommendations."
        ),
    )
