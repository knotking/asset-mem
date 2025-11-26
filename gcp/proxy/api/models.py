from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from enum import Enum

class LocationData(BaseModel):
    latitude: float
    longitude: float
    radius_miles: int = 50  # Default 50 miles radius for service provider search
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None

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
