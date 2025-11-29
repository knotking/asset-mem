from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel
from enum import Enum

class AgentRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    user_query: str
    context_doc_uris: Optional[List[str]] = None
    diagnosis_uris: Optional[List[str]] = None
    property_address: Optional[str] = None
    analysis_optional_agents: Optional[List[str]] = None
    location_type: Optional[Literal["address", "location"]] = None
    location_coordinates: Optional[Dict[str, float]] = None  # {"lat": float, "lng": float}
    location_radius: Optional[int] = None  # 10-100 miles

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

# Gemini File Search Models
class CreateFileSearchStoreRequest(BaseModel):
    display_name: Optional[str] = None

class FileSearchStoreResponse(BaseModel):
    name: str
    store_id: str
    display_name: Optional[str] = None

class UploadFileRequest(BaseModel):
    file_url: str
    file_search_store_name: str
    display_name: Optional[str] = None
    wait_for_completion: bool = True

class FileSearchDocumentResponse(BaseModel):
    name: str
    document_id: str
    display_name: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    state: Optional[str] = None

class CitationResponse(BaseModel):
    uri: Optional[str] = None
    title: Optional[str] = None
    start_index: Optional[int] = None
    end_index: Optional[int] = None
    license: Optional[str] = None

class GenerateContentRequest(BaseModel):
    contents: str
    file_search_store_names: List[str]
    model: Optional[str] = "gemini-2.5-flash"
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None
    response_mime_type: Optional[str] = None
    response_schema: Optional[Dict[str, Any]] = None

class GenerateContentResponse(BaseModel):
    text: str
    model: Optional[str] = None
    finish_reason: Optional[str] = None
    has_citations: bool = False
    citations: Optional[List[CitationResponse]] = None
    retrieval_queries: Optional[List[str]] = None
