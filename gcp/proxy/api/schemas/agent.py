from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator
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

    @field_validator("radius_miles")
    @classmethod
    def radius_miles_in_range(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v < 5 or v > 100:
            raise ValueError("radius_miles must be between 5 and 100")
        return v


class ChipActionRequest(BaseModel):
    """Structured suggested-action chip tap (deterministic agent routing)."""

    type: Literal["run_branch", "discuss", "replay_analysis"]
    branch: Optional[Literal["coverage", "diy", "service", "cost"]] = Field(
        default=None,
        description="Branch to run (run_branch only)",
    )
    topic: Optional[str] = Field(
        default=None,
        description="Focus topic for discuss chips (e.g. cost, diy)",
    )

    @model_validator(mode="after")
    def run_branch_requires_branch(self) -> "ChipActionRequest":
        if self.type == "run_branch" and not self.branch:
            raise ValueError("chip_action of type run_branch requires a branch")
        return self


class AgentRequest(BaseModel):
    user_id: str = Field(description="Unique identifier for the user")
    session_id: Optional[str] = Field(default="", description="Session ID for the conversation context")
    user_query: str = Field(default="Analyse", description="The query or prompt from the user")
    context_doc_uris: List[str] = Field(default_factory=list, description="List of GCS URIs for context documents")
    context_doc_ids: List[str] = Field(
        default_factory=list,
        description="Firestore doc ids (users/{uid}/docs/{id}) parallel to context_doc_uris for RAG indexing status",
    )
    checkpoint_ids: Optional[List[str]] = Field(default=None, description="Checkpoint IDs for checkpoint context (enables run_checkpoint_pipeline when new analysis is needed)")
    property_address: str = Field(
        default="",
        description="Property record address (identity/context only, not market geo)",
    )
    search_location: Optional[SearchLocationRequest] = Field(
        default=None,
        description="Unified search/market location (resolved server-side for agents)",
    )
    property_id: Optional[str] = Field(default=None, description="Property ID for property-specific queries (e.g., checkpoint retrieval)")
    report_ids: Optional[List[str]] = Field(
        default=None,
        description="Property report IDs for report-mode chat (frozen snapshot retrieval)",
    )
    report_revisions: Optional[dict[str, int]] = Field(
        default=None,
        description="Optional report_id -> revision map when chat references an archived revision",
    )
    primary_agent: Optional[Literal["checkpoint", "docs", "report"]] = Field(
        default=None,
        description="Primary agent selection: checkpoint, docs, or report (saved PDF snapshots)",
    )
    checkpoint_optional_agents: List[str] = Field(default_factory=list, description="List of optional agents to include in checkpoint analysis")
    assistant_message_id: Optional[str] = Field(
        default=None,
        description="Firestore assistant message doc id (clients create before streaming)",
    )
    chat_intent: Optional[Literal["discuss_analysis", "new_analysis", "replay_analysis"]] = Field(
        default=None,
        description="Optional client hint for resolve NLU (discuss_analysis, new_analysis, replay_analysis)",
    )
    chip_action: Optional[ChipActionRequest] = Field(
        default=None,
        description="Structured suggested-action chip tap; routes deterministically (no routing LLM)",
    )
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
    context_doc_ids: List[str] = Field(default_factory=list)
    success: bool = Field(default=True)
    error: str = Field(default="")
    source: str = Field(default="unknown")
    result: Dict[str, Any] | str = Field(default_factory=dict)

