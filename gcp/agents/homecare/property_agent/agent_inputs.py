from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict

AnalysisOptionalAgent = Literal["coverage", "diy", "service", "cost"]

DEFAULT_ANALYSIS_OPTIONAL_AGENTS: List[AnalysisOptionalAgent] = ["coverage", "diy", "service", "cost"]

class DiagnosisInput(BaseModel):
    user_query: str = Field(description="The user query.")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="The context document URIs.")
    diagnosis_uris: Optional[List[str]] = Field(default=None, description="The diagnosis document URIs.")
    property_address: Optional[str] = Field(default=None, description="The property address.")
    analysis_optional_agents: Optional[List[AnalysisOptionalAgent]] = Field(
        default=None,
        description=(
            "Optional list of analysis sub-agents to run after triage. "
            "Allowed values: coverage, diy, service, cost. Defaults to all when missing or empty."
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
    property_address: Optional[str] = Field(default=None, description="The property address.")
