"""
Report Service

Handles report related operations:
1. Publishing report analysis requests to Pub/Sub for async processing
2. Chatting with analyzed reports using the report agent
3. Retrieving report summaries
"""

import os
import json
import logging
from typing import Optional, Dict, Any
from google.cloud import pubsub_v1
from google.cloud import firestore

from schemas.report import (
    AnalyzeReportRequest,
    ChatWithReportRequest,
    ReportSummaryResponse
)

logger = logging.getLogger(__name__)

# Configuration
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
REPORT_ANALYSIS_TOPIC = os.environ.get("REPORT_ANALYSIS_TOPIC", "report-analysis-topic")

if not PROJECT_ID:
    logger.warning("GCP_PROJECT_ID not set, report analysis publishing may fail")


def publish_report_analysis(request: AnalyzeReportRequest) -> str:
    """
    Publishes a report analysis request to Pub/Sub for async processing.
    
    Args:
        request: AnalyzeReportRequest with report details
    
    Returns:
        Message ID from Pub/Sub
    """
    try:
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(PROJECT_ID, REPORT_ANALYSIS_TOPIC)
        
        payload = {
            "reportUri": request.reportUri,
            "contentType": request.contentType,
            "reportId": request.reportId,
            "userId": request.userId,
            "propertyId": request.propertyId,
            "source": "report-analysis-api"
        }
        
        data = json.dumps(payload).encode("utf-8")
        future = publisher.publish(topic_path, data)
        message_id = future.result()
        
        logger.info(f"Published report analysis to {REPORT_ANALYSIS_TOPIC}: {message_id}")
        return message_id
        
    except Exception as e:
        logger.error(f"Failed to publish report analysis to Pub/Sub: {e}")
        raise


def chat_with_report(request: ChatWithReportRequest) -> str:
    """
    Answer a question about an analyzed report using the report agent.
    
    Args:
        request: ChatWithReportRequest with user query and report details
    
    Returns:
        Answer string from the report agent
    """
    try:
        # Import the report service from the worker (or use the agent directly)
        import sys
        import os
        
        # Add the workers path to access report_service
        workers_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../workers/function/report_analysis"))
        if workers_path not in sys.path:
            sys.path.insert(0, workers_path)
        
        from report_service import chat_with_report as chat_service
        
        answer = chat_service(
            user_query=request.userQuery,
            report_id=request.reportId,
            user_id=request.userId,
            property_id=request.propertyId,
            report_context=request.reportContext
        )
        
        return answer
        
    except Exception as e:
        logger.error(f"Error in chat_with_report: {e}", exc_info=True)
        raise


def get_report_summary(
    report_id: str,
    user_id: str,
    property_id: str
) -> Optional[ReportSummaryResponse]:
    """
    Get a summary of a report from Firestore.
    
    Args:
        report_id: ID of the report
        user_id: User ID
        property_id: Property ID
    
    Returns:
        ReportSummaryResponse or None if not found
    """
    try:
        db = firestore.Client()
        
        report_ref = db.collection("users").document(user_id)\
            .collection("properties").document(property_id)\
            .collection("reports").document(report_id)
        
        report_doc = report_ref.get()
        
        if not report_doc.exists:
            logger.warning(f"Report {report_id} not found")
            return None
        
        report_data = report_doc.to_dict()
        ai_analysis = report_data.get("aiAnalysis", {})
        
        # Calculate summary metrics
        issues = ai_analysis.get("issues", [])
        critical_issues = sum(1 for issue in issues if isinstance(issue, dict) and issue.get("severity") == "critical")
        
        cost_estimates = ai_analysis.get("costEstimates", {})
        total_cost = 0
        if cost_estimates:
            total_cost = (
                cost_estimates.get("immediate", 0) +
                cost_estimates.get("shortTerm", 0) +
                cost_estimates.get("longTerm", 0)
            )
        
        summary = ReportSummaryResponse(
            summary=ai_analysis.get("summary", "No summary available"),
            overallCondition=ai_analysis.get("overallCondition", "unknown"),
            keyFindings=ai_analysis.get("keyFindings", []),
            totalIssues=len(issues),
            criticalIssues=critical_issues,
            totalEstimatedCost=total_cost
        )
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting report summary: {e}", exc_info=True)
        return None

