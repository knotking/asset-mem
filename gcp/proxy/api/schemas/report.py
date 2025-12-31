"""Pydantic schemas for report API endpoints."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class AnalyzeReportRequest(BaseModel):
    """Request to analyze an inspection report."""
    reportUri: str
    contentType: str = "application/pdf"
    reportId: str  # Required for Firestore update
    userId: str  # Required for Firestore update
    propertyId: str  # Required for Firestore update


class ChatWithReportRequest(BaseModel):
    """Request to chat with a report."""
    userQuery: str
    reportId: str
    userId: str
    propertyId: str
    reportContext: Optional[Dict[str, Any]] = None


class ReportIssueResponse(BaseModel):
    """Individual issue in report analysis."""
    id: str
    category: str
    title: str
    description: str
    severity: str
    location: str
    priority: int
    estimatedCost: Optional[float] = None
    pageNumber: Optional[int] = None
    confidence: float


class ReportRecommendationResponse(BaseModel):
    """Individual recommendation in report analysis."""
    id: str
    issue: str
    recommendation: str
    timeframe: str
    estimatedCost: Optional[float] = None
    diyFeasible: bool


class ReportSummaryResponse(BaseModel):
    """Summary of report analysis."""
    summary: str
    overallCondition: str
    keyFindings: List[str]
    totalIssues: int
    criticalIssues: int
    totalEstimatedCost: float


class ChatResponse(BaseModel):
    """Response to a chat query."""
    answer: str
    reportId: str

