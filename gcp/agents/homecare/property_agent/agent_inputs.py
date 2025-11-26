from pydantic import BaseModel, Field
from typing import List, Optional, Literal

AnalysisOptionalAgent = Literal["coverage", "diy", "service", "cost"]

DEFAULT_ANALYSIS_OPTIONAL_AGENTS: List[AnalysisOptionalAgent] = ["coverage", "diy", "service", "cost"]

class LocationData(BaseModel):
    """Location data with coordinates and search radius for service provider searches"""
    latitude: float = Field(description="Latitude coordinate")
    longitude: float = Field(description="Longitude coordinate")
    radius_miles: int = Field(default=50, ge=10, le=100, description="Search radius in miles (10-100)")

class DiagnosisInput(BaseModel):
    user_query: str = Field(description="The user query.")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="The context document URIs.")
    diagnosis_uris: Optional[List[str]] = Field(default=None, description="The diagnosis document URIs.")
    property_address: Optional[str] = Field(default=None, description="The property address.")
    location_data: Optional[LocationData] = Field(
        default=None, 
        description="Location coordinates with search radius (used when property_address is not available)."
    )
    analysis_optional_agents: Optional[List[AnalysisOptionalAgent]] = Field(
        default=None,
        description=(
            "Optional list of analysis sub-agents to run after triage. "
            "Allowed values: coverage, diy, service, cost. "
            "Defaults to all when missing/null. Empty list [] means only triage runs."
        ),
    )
    
    class Config:
        # Allow extra fields to be ignored, making the schema more flexible
        extra = "ignore"

class DocsInput(BaseModel):
    user_query: str = Field(description="The user query for DocuLink Agent.")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="Context document URIs for DocuLink Agent.")
    property_address: Optional[str] = Field(default=None, description="The property address.")
    location_data: Optional[LocationData] = Field(
        default=None, 
        description="Location coordinates with search radius (used when property_address is not available)."
    )
