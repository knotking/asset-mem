"""Pydantic schemas for report agent inputs and outputs."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class ReportAnalysisInput(BaseModel):
    """Input schema for analyzing an inspection report."""
    
    report_uri: str = Field(
        description="GCS URI (gs://) of the inspection report PDF or image to analyze"
    )
    user_id: str = Field(
        description="User ID who owns the report"
    )
    property_id: str = Field(
        description="Property ID this report belongs to"
    )
    content_type: str = Field(
        default="application/pdf",
        description="MIME type of the report file"
    )


class ReportChatInput(BaseModel):
    """Input schema for chatting about a report."""
    
    user_query: str = Field(
        description="User's question about the inspection report"
    )
    report_id: str = Field(
        description="ID of the inspection report to query"
    )
    user_id: str = Field(
        description="User ID who owns the report"
    )
    property_id: str = Field(
        description="Property ID this report belongs to"
    )
    report_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Full report analysis data for context"
    )


class ReportMetadata(BaseModel):
    """Extracted metadata from inspection report."""
    
    inspector_name: Optional[str] = None
    inspector_company: Optional[str] = None
    inspector_license: Optional[str] = None
    inspection_date: Optional[str] = None
    property_address: Optional[str] = None
    property_type: Optional[str] = None
    year_built: Optional[str] = None
    square_footage: Optional[str] = None
    report_type: str = "OTHER"
    report_reference: Optional[str] = None
    executive_summary: Optional[str] = None


class ReportIssue(BaseModel):
    """Individual issue found in inspection report."""
    
    id: str = Field(description="Unique identifier for the issue")
    category: str = Field(description="Issue category (Structural, Electrical, etc.)")
    title: str = Field(description="Brief issue title")
    description: str = Field(description="Detailed description")
    severity: str = Field(description="Severity: minor, moderate, major, or critical")
    location: str = Field(description="Location within property")
    priority: int = Field(description="Priority ranking 1-10")
    estimated_cost: Optional[float] = Field(default=None, description="Estimated repair cost")
    page_number: Optional[int] = Field(default=None, description="Page number in report")
    confidence: float = Field(default=0.8, description="Confidence in assessment 0-1")


class ReportRecommendation(BaseModel):
    """Recommendation for addressing an issue."""
    
    id: str = Field(description="Unique identifier")
    issue: str = Field(description="Reference to issue or issue description")
    recommendation: str = Field(description="Recommended action")
    timeframe: str = Field(description="immediate, short_term, long_term, or monitoring")
    estimated_cost: Optional[float] = Field(default=None, description="Estimated cost")
    diy_feasible: bool = Field(description="Can homeowner do this themselves")


class ReportAnalysisOutput(BaseModel):
    """Complete analysis output for an inspection report."""
    
    metadata: ReportMetadata
    summary: str = Field(description="Overall summary of the report")
    overall_condition: str = Field(
        description="excellent, good, fair, poor, or critical"
    )
    issues: List[ReportIssue] = Field(default_factory=list)
    recommendations: List[ReportRecommendation] = Field(default_factory=list)
    key_findings: List[str] = Field(default_factory=list)
    cost_estimates: Optional[Dict[str, float]] = Field(
        default=None,
        description="Cost estimates by timeframe: immediate, short_term, long_term"
    )
    confidence: float = Field(default=0.85, description="Overall confidence in analysis")

