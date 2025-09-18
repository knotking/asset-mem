from pydantic import BaseModel, Field
from typing import List, Optional

class DiagnosisInput(BaseModel):
    user_query: str = Field(description="The user query.")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="The context document URIs.")
    diagnosis_uris: Optional[List[str]] = Field(description="The diagnosis document URIs.")
    property_address: Optional[str] = Field(default=None, description="The property address.")

class DocsInput(BaseModel):
    user_query: str = Field(description="The user query for DocuLink Agent.")
    context_doc_uris: Optional[List[str]] = Field(default=None, description="Context document URIs for DocuLink Agent.")
    property_address: Optional[str] = Field(default=None, description="The property address.")
