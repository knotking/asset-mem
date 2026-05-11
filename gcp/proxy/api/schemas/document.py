from typing import List
from pydantic import BaseModel, Field
from enum import Enum

class DocumentType(str, Enum):
    DEED = "DEED"
    INSURANCE_POLICY = "INSURANCE_POLICY"
    UTILITY_BILL = "UTILITY_BILL"
    INSPECTION_REPORT = "INSPECTION_REPORT"
    MORTGAGE_STATEMENT = "MORTGAGE_STATEMENT"
    OTHER = "OTHER"

class KeyEntity(BaseModel):
    name: str = Field(description="Name of the entity extracted from the document")
    value: str = Field(description="Value of the entity")

class ExtractDocInfoRequest(BaseModel):
    """Queue document extraction; the worker updates `users/{userId}/docs/{docId}` in Firestore."""

    docId: str = Field(description="Firestore document id under users/{userId}/docs")
    docUrl: str = Field(description="The GCS URL of the document to analyze (gs://...)")
    contentType: str = Field(description="MIME type of the document")
    userId: str = Field(
        description="Firebase Auth UID — required for quota accounting and Firestore path",
    )

class ExtractDocInfoResponse(BaseModel):
    documentType: DocumentType = Field(description="Classified type of the document")
    propertyAddress: str = Field(description="Address of the property found in the document")
    keyEntities: List[KeyEntity] = Field(description="List of key-value pairs extracted from the document")
    summary: str = Field(description="Summary of the document content")

