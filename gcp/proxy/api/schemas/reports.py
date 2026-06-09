from typing import Literal, Optional

from pydantic import BaseModel, Field


class ReportDateRangeInput(BaseModel):
    start: str
    end: str


class ReportTemplateInput(BaseModel):
    layoutId: Literal["professional", "classic"] = "professional"
    includeCoverPage: bool = True
    includePhotos: bool = True
    includeIssueTable: bool = True
    includeMetricsChart: bool = True
    includeVisualDiff: bool = True
    includeRecommendations: bool = True
    includeSignatureBlock: bool = False


class ReportPreviewRequest(BaseModel):
    userId: str
    propertyId: str
    mode: Literal["snapshot", "comparison"] = "snapshot"
    purpose: Literal["rental_security", "realtor_visit", "insurance", "custom"] = (
        "realtor_visit"
    )
    snapshotRange: Optional[ReportDateRangeInput] = None
    baselineRange: Optional[ReportDateRangeInput] = None
    comparisonRange: Optional[ReportDateRangeInput] = None


class ReportPreviewHtmlRequest(BaseModel):
    userId: str
    propertyId: str
    title: str = "Property Report"
    mode: Literal["snapshot", "comparison"] = "snapshot"
    purpose: Literal["rental_security", "realtor_visit", "insurance", "custom"] = "realtor_visit"
    snapshotRange: Optional[ReportDateRangeInput] = None
    baselineRange: Optional[ReportDateRangeInput] = None
    comparisonRange: Optional[ReportDateRangeInput] = None
    checkpointIds: Optional[list[str]] = None
    template: ReportTemplateInput = Field(default_factory=ReportTemplateInput)
    customNotes: Optional[str] = None


class ReportStatusRequest(BaseModel):
    userId: str
    propertyId: str
    reportId: str


class GenerateReportRequest(BaseModel):
    userId: str
    propertyId: str
    title: str
    mode: Literal["snapshot", "comparison"] = "snapshot"
    purpose: Literal["rental_security", "realtor_visit", "insurance", "custom"] = "realtor_visit"
    snapshotRange: Optional[ReportDateRangeInput] = None
    baselineRange: Optional[ReportDateRangeInput] = None
    comparisonRange: Optional[ReportDateRangeInput] = None
    checkpointIds: Optional[list[str]] = None
    template: ReportTemplateInput = Field(default_factory=ReportTemplateInput)
    customNotes: Optional[str] = None
    regenerateReportId: Optional[str] = None


class ReportSignedUrlRequest(BaseModel):
    userId: str
    propertyId: str
    reportId: str


class UpdateReportMetadataRequest(BaseModel):
    userId: str
    propertyId: str
    reportId: str
    title: Optional[str] = None
    customNotes: Optional[str] = None
    template: Optional[ReportTemplateInput] = None


class ReportShareRequest(BaseModel):
    userId: str
    propertyId: str
    reportId: str


class PublicReportSignedUrlRequest(BaseModel):
    shareId: str


class ReportRagIndexRequest(BaseModel):
    userId: str
    propertyId: str
    reportId: str
    includeInDocsChat: bool
