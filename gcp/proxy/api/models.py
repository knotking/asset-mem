from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum

class LocationData(BaseModel):
    """Location data with coordinates and search radius"""
    latitude: float = Field(..., description="Latitude coordinate")
    longitude: float = Field(..., description="Longitude coordinate")
    radius_miles: int = Field(default=50, ge=10, le=100, description="Search radius in miles (10-100)")

class AgentRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    user_query: str
    context_doc_uris: Optional[List[str]] = None
    diagnosis_uris: Optional[List[str]] = None
    property_address: Optional[str] = None
    location_data: Optional[LocationData] = None
    analysis_optional_agents: Optional[List[str]] = None

class DocumentType(str, Enum):
    DEED = "DEED"
    INSURANCE_POLICY = "INSURANCE_POLICY"
    UTILITY_BILL = "UTILITY_BILL"
    INSPECTION_REPORT = "INSPECTION_REPORT"
    MORTGAGE_STATEMENT = "MORTGAGE_STATEMENT"
    OTHER = "OTHER"

class KeyEntity(BaseModel):
    name: str
    value: str

class ExtractDocInfoRequest(BaseModel):
    docUrl: str
    contentType: str

class ExtractDocInfoResponse(BaseModel):
    documentType: DocumentType
    propertyAddress: str
    keyEntities: List[KeyEntity]
    summary: str
