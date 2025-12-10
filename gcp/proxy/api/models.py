"""
Data Models

Pydantic models for request/response validation.
"""

from typing import List, Optional, Literal, Dict
from pydantic import BaseModel, Field
from enum import Enum


class AgentRequest(BaseModel):
    """Request model for agent queries."""
    
    user_id: str = Field(description="User identifier")
    session_id: Optional[str] = Field(default=None, description="Session identifier")
    user_query: str = Field(description="User query text")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="Context document URIs")
    diagnosis_uris: Optional[List[str]] = Field(default=None, description="Diagnosis document URIs")
    property_address: Optional[str] = Field(default=None, description="Property address")
    analysis_optional_agents: Optional[List[str]] = Field(default=None, description="Optional agents for analysis")
    location_type: Optional[Literal["address", "location"]] = Field(default=None, description="Location type")
    location_coordinates: Optional[Dict[str, float]] = Field(
        default=None, 
        description="Location coordinates as {'lat': float, 'lng': float}"
    )
    location_radius: Optional[int] = Field(default=None, description="Location radius in miles (10-100)")


class DocumentType(str, Enum):
    """Document type enumeration."""
    
    DEED = "DEED"
    INSURANCE_POLICY = "INSURANCE_POLICY"
    UTILITY_BILL = "UTILITY_BILL"
    INSPECTION_REPORT = "INSPECTION_REPORT"
    MORTGAGE_STATEMENT = "MORTGAGE_STATEMENT"
    OTHER = "OTHER"


class KeyEntity(BaseModel):
    """Key entity extracted from document."""
    
    name: str = Field(description="Entity name")
    value: str = Field(description="Entity value")


class ExtractDocInfoRequest(BaseModel):
    """Request model for document analysis."""
    
    docUrl: str = Field(description="Document URL (GCS or HTTPS)")
    contentType: str = Field(description="Document content type (MIME type)")


class ExtractDocInfoResponse(BaseModel):
    """Response model for document analysis."""
    
    documentType: DocumentType = Field(description="Classified document type")
    propertyAddress: str = Field(description="Extracted and normalized property address")
    keyEntities: List[KeyEntity] = Field(description="Key entities extracted from document")
    summary: str = Field(description="Document summary")
