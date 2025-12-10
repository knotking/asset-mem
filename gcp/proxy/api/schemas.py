from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator
from enum import Enum
from optional_agents import normalize_analysis_optional_agents

class AgentRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = Field(default="")
    user_query: str = Field(default="Analyse")
    context_doc_uris: List[str] = Field(default_factory=list)
    diagnosis_uris: List[str] = Field(default_factory=list)
    property_address: str = Field(default="")
    analysis_optional_agents: List[str] = Field(default_factory=list)
    location_type: Optional[Literal["address", "location"]] = None
    location_coordinates: Optional[Dict[str, float]] = None  # {"lat": float, "lng": float}
    location_radius: Optional[int] = None  # 10-100 miles

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

class SessionRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None

class UserUploadResultEvent(BaseModel):
    user_id: str
    user_query: str
    gcs_urls: List[str]
    success: bool = Field(default=True)
    error: str = Field(default="")
    source: str = Field(default="unknown")
    result: Dict[str, Any] | str = Field(default_factory=dict)

