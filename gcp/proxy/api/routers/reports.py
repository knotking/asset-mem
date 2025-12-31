"""Report API Router

Handles HTTP endpoints for inspection report analysis and chat functionality.
"""

from fastapi import APIRouter, HTTPException, Query
import logging

from schemas.report import (
    AnalyzeReportRequest,
    ChatWithReportRequest,
    ChatResponse,
    ReportSummaryResponse
)
from services.report_service import (
    publish_report_analysis,
    chat_with_report,
    get_report_summary
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/analyze-report")
async def analyze_report_endpoint(request_data: AnalyzeReportRequest):
    """
    Analyze an inspection report using the report agent.
    
    This endpoint publishes the analysis request to Pub/Sub for async processing.
    Returns immediately (202 Accepted). The worker function will process the
    analysis and update Firestore directly. Frontend should listen to Firestore
    changes to see when analysis completes.
    
    Requires: reportId, userId, propertyId for Firestore update.
    """
    logger.info("Report analysis endpoint received a request")
    
    try:
        # Validate required fields
        if not request_data.reportId or not request_data.userId or not request_data.propertyId:
            raise HTTPException(
                status_code=400,
                detail="reportId, userId, and propertyId are required for async processing"
            )
        
        if not request_data.reportUri:
            raise HTTPException(
                status_code=400,
                detail="reportUri is required"
            )
        
        logger.info(f"Publishing report analysis request: reportId={request_data.reportId}")
        
        # Publish to Pub/Sub topic for async processing
        message_id = publish_report_analysis(request_data)
        
        logger.info(f"Report analysis published to Pub/Sub: {message_id}")
        
        return {
            "status": "accepted",
            "message": "Analysis queued for processing",
            "reportId": request_data.reportId,
            "messageId": message_id
        }
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error publishing report analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat-with-report", response_model=ChatResponse)
async def chat_with_report_endpoint(request_data: ChatWithReportRequest):
    """
    Ask questions about a previously analyzed inspection report.
    
    Returns a conversational answer based on the report analysis data.
    The report must have been analyzed before it can be queried.
    """
    logger.info(f"Chat endpoint received query for report {request_data.reportId}")
    
    try:
        if not request_data.userQuery.strip():
            raise HTTPException(
                status_code=400,
                detail="userQuery cannot be empty"
            )
        
        if not all([request_data.reportId, request_data.userId, request_data.propertyId]):
            raise HTTPException(
                status_code=400,
                detail="reportId, userId, and propertyId are required"
            )
        
        # Get answer from report agent
        answer = chat_with_report(request_data)
        
        return ChatResponse(
            answer=answer,
            reportId=request_data.reportId
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat with report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/report-summary/{report_id}", response_model=ReportSummaryResponse)
async def get_report_summary_endpoint(
    report_id: str,
    user_id: str = Query(..., description="User ID who owns the report"),
    property_id: str = Query(..., description="Property ID the report belongs to")
):
    """
    Get a summary of an analyzed inspection report.
    
    Returns key metrics and findings from the report analysis including:
    - Overall summary and condition
    - Key findings
    - Total issues and critical issue count
    - Total estimated repair costs
    """
    logger.info(f"Summary endpoint received request for report {report_id}")
    
    try:
        summary = get_report_summary(
            report_id=report_id,
            user_id=user_id,
            property_id=property_id
        )
        
        if not summary:
            raise HTTPException(
                status_code=404,
                detail=f"Report {report_id} not found or not analyzed yet"
            )
        
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting report summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

