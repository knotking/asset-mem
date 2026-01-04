from typing import List, Optional
from pydantic import BaseModel, Field
from enum import Enum

class DocumentType(str, Enum):
    DEED = "DEED"
    INSURANCE_POLICY = "INSURANCE_POLICY"
    UTILITY_BILL = "UTILITY_BILL"
    INSPECTION_REPORT = "INSPECTION_REPORT"
    MORTGAGE_STATEMENT = "MORTGAGE_STATEMENT"
    CHECKPOINT_REPORT = "CHECKPOINT_REPORT"
    OTHER = "OTHER"

class KeyEntity(BaseModel):
    name: str = Field(description="Name of the entity extracted from the document")
    value: str = Field(description="Value of the entity")

class ExtractDocInfoRequest(BaseModel):
    docUrl: str = Field(description="The GCS URL of the document to analyze")
    contentType: str = Field(description="MIME type of the document")

class CheckpointReportIssue(BaseModel):
    description: str = Field(description="Description of the issue")
    severity: str = Field(description="Severity level: critical, major, moderate, or minor")
    category: Optional[str] = Field(None, description="Category of the issue (e.g., structural, electrical)")
    recommendation: Optional[str] = Field(None, description="Recommendation to address the issue")
    estimatedCost: Optional[str] = Field(None, description="Estimated cost to fix the issue")
    priority: Optional[int] = Field(None, description="Priority level from 1-5")

class CheckpointReportCostEstimates(BaseModel):
    immediate: Optional[str] = Field(None, description="Immediate cost estimates")
    shortTerm: Optional[str] = Field(None, description="Short-term cost estimates")
    longTerm: Optional[str] = Field(None, description="Long-term cost estimates")

class CheckpointReportAnalysis(BaseModel):
    propertyStatus: Optional[str] = Field(None, description="Overall property status: excellent, good, fair, poor, or critical")
    statusScore: Optional[int] = Field(None, description="Property status score from 0-100")
    issues: Optional[List[CheckpointReportIssue]] = Field(None, description="List of issues found in the report")
    recommendations: Optional[List[str]] = Field(None, description="General recommendations")
    overallAssessment: Optional[str] = Field(None, description="Overall assessment summary")
    costEstimates: Optional[CheckpointReportCostEstimates] = Field(None, description="Cost estimates breakdown")

class ExtractDocInfoResponse(BaseModel):
    documentType: DocumentType = Field(description="Classified type of the document")
    propertyAddress: str = Field(description="Address of the property found in the document")
    keyEntities: List[KeyEntity] = Field(description="List of key-value pairs extracted from the document")
    summary: str = Field(description="Summary of the document content")
    checkpointAnalysis: Optional[CheckpointReportAnalysis] = Field(None, description="Checkpoint report analysis (only for CHECKPOINT_REPORT documents)")

