from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict

AnalysisOptionalAgent = Literal["coverage", "diy", "service", "cost"]
CheckpointOptionalAgent = Literal["coverage", "diy", "service", "cost"]
PrimaryAgent = Literal["analysis", "checkpoint"]

DEFAULT_ANALYSIS_OPTIONAL_AGENTS: List[AnalysisOptionalAgent] = ["coverage", "diy", "service", "cost"]
DEFAULT_CHECKPOINT_OPTIONAL_AGENTS: List[CheckpointOptionalAgent] = []

class DiagnosisInput(BaseModel):
    user_query: str = Field(description="The user query.")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="The context document URIs.")
    diagnosis_uris: Optional[List[str]] = Field(default=None, description="The diagnosis document URIs.")
    checkpoint_ids: Optional[List[str]] = Field(default=None, description="Checkpoint IDs for checkpoint context (routes to doculink_agent when provided).")
    property_address: Optional[str] = Field(default=None, description="The property address.")
    property_id: Optional[str] = Field(default=None, description="Property ID for property-specific queries (e.g., checkpoint retrieval).")
    primary_agent: Optional[PrimaryAgent] = Field(
        default=None,
        description=(
            "Primary agent selection. When provided, this takes precedence in routing decisions. "
            "Allowed values: 'analysis' routes to analysis_agent, 'checkpoint' routes to doculink_agent for checkpoint queries. "
            "If not provided, routing falls back to legacy logic based on checkpoint_ids and diagnosis_uris."
        ),
    )
    analysis_optional_agents: Optional[List[AnalysisOptionalAgent]] = Field(
        default=None,
        description=(
            "Optional list of analysis sub-agents to run after triage. "
            "Allowed values: coverage, diy, service, cost. Defaults to all when missing or empty."
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
    location_type: Optional[Literal["address", "location"]] = Field(
        default=None,
        description="Location selection type: 'address' uses property_address if available, else location_coordinates; 'location' uses location_coordinates only."
    )
    location_coordinates: Optional[Dict[str, float]] = Field(
        default=None,
        description="Location coordinates as {'lat': float, 'lng': float}."
    )
    location_radius: Optional[int] = Field(
        default=None,
        description="Search radius in miles (10-100). Used for local professional searches."
    )
    
    class Config:
        # Allow extra fields to be ignored, making the schema more flexible
        extra = "ignore"

class DocsInput(BaseModel):
    user_query: str = Field(description="The user query for DocuLink Agent.")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="Context document URIs for DocuLink Agent.")
    checkpoint_ids: Optional[List[str]] = Field(default=None, description="Checkpoint IDs for checkpoint context (triggers checkpoint_agent when provided).")
    property_address: Optional[str] = Field(default=None, description="The property address.")
    property_id: Optional[str] = Field(default=None, description="Property ID for property-specific queries (e.g., checkpoint retrieval).")
    checkpoint_optional_agents: Optional[List[CheckpointOptionalAgent]] = Field(
        default=None,
        description=(
            "Optional list of checkpoint analysis sub-agents to run after checkpoint retrieval. "
            "Allowed values: coverage, diy, service, cost. When provided and non-empty, triggers comprehensive "
            "checkpoint analysis with recommendations."
        ),
    )