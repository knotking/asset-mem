from pydantic import BaseModel, Field
from typing import List, Optional, Literal

AnalysisOptionalAgent = Literal["coverage", "diy", "service", "cost"]

DEFAULT_ANALYSIS_OPTIONAL_AGENTS: List[AnalysisOptionalAgent] = ["coverage", "diy", "service", "cost"]

class DiagnosisInput(BaseModel):
    user_query: str = Field(description="The user query.")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="The context document URIs.")
    diagnosis_uris: Optional[List[str]] = Field(default=None, description="The diagnosis document URIs.")
    property_address: Optional[str] = Field(default=None, description="The property address.")
    location_latitude: Optional[float] = Field(default=None, description="The latitude of the current location.")
    location_longitude: Optional[float] = Field(default=None, description="The longitude of the current location.")
    location_radius_miles: Optional[float] = Field(default=None, ge=10, le=100, description="The search radius in miles (10-100 miles).")
    analysis_optional_agents: Optional[List[AnalysisOptionalAgent]] = Field(
        default=None,
        description=(
            "Optional list of analysis sub-agents to run after triage. "
            "Allowed values: coverage, diy, service, cost. Defaults to all when missing or empty."
        ),
    )
    
    class Config:
        # Allow extra fields to be ignored, making the schema more flexible
        extra = "ignore"

class DocsInput(BaseModel):
    user_query: str = Field(description="The user query for DocuLink Agent.")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="Context document URIs for DocuLink Agent.")
    property_address: Optional[str] = Field(default=None, description="The property address.")
