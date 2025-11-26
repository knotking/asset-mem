from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum

class AgentRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    user_query: str
    context_doc_uris: Optional[List[str]] = None
    diagnosis_uris: Optional[List[str]] = None
    property_address: Optional[str] = None
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

# Gemini File Search Models

class CreateFileSearchStoreRequest(BaseModel):
    """Request to create a new File Search store."""
    display_name: str = Field(..., description="Human-readable name for the store")

class FileSearchStoreInfo(BaseModel):
    """Information about a File Search store."""
    name: str = Field(..., description="Store ID (fileSearchStores/xxxxx)")
    display_name: str = Field(..., description="Human-readable name")
    create_time: Optional[str] = Field(None, description="Creation timestamp")
    status: Optional[str] = Field(None, description="Store status")

class UploadFileToStoreRequest(BaseModel):
    """Request to upload a file to a File Search store."""
    file_path: str = Field(..., description="Local file path or GCS URI (gs://...)")
    store_name: str = Field(..., description="Target store name (fileSearchStores/xxxxx)")
    display_name: Optional[str] = Field(None, description="Display name for the file")
    user_id: Optional[str] = Field(None, description="User ID to associate with the file")
    wait_for_completion: bool = Field(True, description="Wait for import to complete")
    timeout: int = Field(300, description="Timeout in seconds", ge=30, le=600)

class ImportGCSFileRequest(BaseModel):
    """Request to import a GCS file to a File Search store."""
    gcs_uri: str = Field(..., description="GCS URI (gs://bucket/path)")
    store_name: str = Field(..., description="Target store name")
    display_name: Optional[str] = Field(None, description="Display name for the file")
    user_id: Optional[str] = Field(None, description="User ID to associate with the file")
    mime_type: Optional[str] = Field(None, description="MIME type of the file")
    wait_for_completion: bool = Field(True, description="Wait for completion")

class FileSearchQueryRequest(BaseModel):
    """Request to query File Search stores."""
    query: str = Field(..., description="Search query or question")
    store_names: List[str] = Field(..., description="List of store names to search")
    model: str = Field("gemini-2.5-flash", description="Gemini model to use")
    include_grounding_metadata: bool = Field(True, description="Include citations")
    generation_config: Optional[Dict[str, Any]] = Field(None, description="Optional generation parameters")

class GroundingChunk(BaseModel):
    """Citation/grounding chunk from File Search."""
    type: str = Field(..., description="Type: 'file_search' or 'web'")
    document_name: Optional[str] = Field(None, description="Source document name")
    chunk_text: Optional[str] = Field(None, description="Relevant text chunk")
    page_number: Optional[int] = Field(None, description="Page number in document")
    uri: Optional[str] = Field(None, description="Web URI if applicable")
    title: Optional[str] = Field(None, description="Web title if applicable")

class GroundingSupport(BaseModel):
    """Grounding support linking answer segments to sources."""
    segment: Dict[str, Optional[int]] = Field(..., description="Answer text segment indices")
    grounding_chunk_indices: List[int] = Field(..., description="Referenced chunk indices")
    confidence_scores: List[float] = Field(default_factory=list, description="Confidence scores")

class FileSearchQueryResponse(BaseModel):
    """Response from File Search query."""
    text: str = Field(..., description="Generated answer text")
    model: str = Field(..., description="Model used")
    stores_queried: List[str] = Field(..., description="Stores that were queried")
    grounding_metadata: Optional[Dict[str, Any]] = Field(None, description="Citations and grounding info")

class FileOperationResponse(BaseModel):
    """Response for file upload/import operations."""
    status: str = Field(..., description="Operation status: completed, in_progress, timeout")
    operation_name: Optional[str] = Field(None, description="Operation ID")
    display_name: Optional[str] = Field(None, description="File display name")
    store_name: Optional[str] = Field(None, description="Target store name")
    gcs_uri: Optional[str] = Field(None, description="GCS URI if applicable")
    message: Optional[str] = Field(None, description="Additional message")

class DeleteStoreRequest(BaseModel):
    """Request to delete a File Search store."""
    store_name: str = Field(..., description="Store name to delete (fileSearchStores/xxxxx)")

class OperationStatusRequest(BaseModel):
    """Request to check operation status."""
    operation_name: str = Field(..., description="Operation name/ID")

# User-scoped File Search Models

class UserFileUploadRequest(BaseModel):
    """Request to upload a file for a specific user."""
    user_id: str = Field(..., description="User ID")
    file_path: str = Field(..., description="File path or GCS URI")
    display_name: Optional[str] = Field(None, description="Display name")
    wait_for_completion: bool = Field(True, description="Wait for completion")

class UserGCSImportRequest(BaseModel):
    """Request to import GCS file for a specific user."""
    user_id: str = Field(..., description="User ID")
    gcs_uri: str = Field(..., description="GCS URI (gs://...)")
    display_name: Optional[str] = Field(None, description="Display name")
    mime_type: Optional[str] = Field(None, description="MIME type")
    wait_for_completion: bool = Field(True, description="Wait for completion")

class UserQueryRequest(BaseModel):
    """Request to query a user's documents."""
    user_id: str = Field(..., description="User ID")
    query: str = Field(..., description="Search query")
    model: str = Field("gemini-2.5-flash", description="Gemini model")
    include_grounding_metadata: bool = Field(True, description="Include citations")
