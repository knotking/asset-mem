from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator
from utils.optional_agents import normalize_analysis_optional_agents, normalize_checkpoint_optional_agents

class AgentRequest(BaseModel):
    user_id: str = Field(description="Unique identifier for the user")
    session_id: Optional[str] = Field(default="", description="Session ID for the conversation context")
    user_query: str = Field(default="Analyse", description="The query or prompt from the user")
    context_doc_uris: List[str] = Field(default_factory=list, description="List of GCS URIs for context documents")
    diagnosis_uris: List[str] = Field(default_factory=list, description="List of GCS URIs for diagnosis documents")
    checkpoint_ids: Optional[List[str]] = Field(default=None, description="Checkpoint IDs for checkpoint context (enables checkpoint_agent routing)")
    property_address: str = Field(default="", description="Address of the property being analyzed")
    property_id: Optional[str] = Field(default=None, description="Property ID for property-specific queries (e.g., checkpoint retrieval)")
    analysis_optional_agents: List[str] = Field(default_factory=list, description="List of optional agents to include in analysis")
    checkpoint_optional_agents: List[str] = Field(default_factory=list, description="List of optional agents to include in checkpoint analysis")
    location_type: Optional[Literal["address", "location"]] = Field(default=None, description="Type of location data provided")
    location_coordinates: Optional[Dict[str, float]] = Field(default=None, description="Coordinates {'lat': float, 'lng': float}")
    location_radius: Optional[int] = Field(default=None, description="Search radius in miles (10-100)")

    @field_validator('user_id')
    @classmethod
    def user_id_must_not_be_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("User ID is required")
        return v

    @field_validator('analysis_optional_agents', mode='before')
    @classmethod
    def normalize_agents(cls, v):
        return normalize_analysis_optional_agents(v)

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

