from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from enum import Enum

# Location radius options in miles
LocationRadius = Literal[10, 25, 50, 75, 100]

class LocationData(BaseModel):
    latitude: float = Field(description="Latitude coordinate")
    longitude: float = Field(description="Longitude coordinate")
    radius: LocationRadius = Field(default=50, description="Search radius in miles (10, 25, 50, 75, or 100)")

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
