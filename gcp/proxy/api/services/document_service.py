"""
Document Analysis Module

Uses Google Gen AI SDK (Vertex AI) to extract key information from property documents:
- Document type classification
- Property address extraction and normalization
- Key entities identification
- Document summary generation
"""

import os
import logging
import json
from typing import Dict, Any
from google import genai
from google.genai import types

from schemas.document import (
    ExtractDocInfoRequest, 
    ExtractDocInfoResponse, 
    DocumentType, 
    KeyEntity,
    CheckpointReportAnalysis,
    CheckpointReportIssue,
    CheckpointReportCostEstimates
)

logger = logging.getLogger(__name__)

# Initialize Google Gen AI Client with Vertex AI
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")

try:
    client = genai.Client(
        vertexai=True,
        project=PROJECT_ID,
        location=LOCATION
    )
    logger.info(f"Google Gen AI SDK initialized for project {PROJECT_ID} in {LOCATION}")
except Exception as e:
    logger.error(f"Failed to initialize Google Gen AI SDK: {e}")
    client = None


def _is_checkpoint_report(doc_type: str, summary: str) -> bool:
    """
    Determine if a document is a checkpoint/property analysis report.
    
    This includes home inspection reports, property condition assessments,
    building inspection reports, and any document analyzing property condition.
    
    Args:
        doc_type: The classified document type
        summary: The document summary
    
    Returns:
        True if the document appears to be a checkpoint report
    """
    # Check if explicitly classified as inspection report
    if doc_type == "INSPECTION_REPORT":
        return True
    
    # Check for checkpoint/inspection/analysis keywords in summary
    checkpoint_keywords = [
        "inspection", "analysis", "assessment", "evaluation", "condition report",
        "property condition", "damage", "issues", "defects", "recommendations",
        "home inspection", "building inspection", "property inspection",
        "inspection report", "condition assessment"
    ]
    summary_lower = summary.lower()
    return any(keyword in summary_lower for keyword in checkpoint_keywords)


def _analyze_checkpoint_report(request: ExtractDocInfoRequest) -> CheckpointReportAnalysis:
    """
    Analyze a checkpoint report to extract comprehensive property assessment data.
    
    Args:
        request: ExtractDocInfoRequest containing docUrl and contentType
    
    Returns:
        CheckpointReportAnalysis with extracted assessment data
    """
    try:
        logger.info(f"Analyzing checkpoint report: {request.docUrl}")
        
        prompt = """You are an expert property inspector analyzing a property assessment or home inspection report. Extract comprehensive information about the property's condition.

This could be a home inspection report, building inspection report, property condition assessment, or any similar document evaluating property condition.

Analyze this report and extract:
1. Overall property status: Classify as "excellent", "good", "fair", "poor", or "critical"
   - Consider all issues found and their severity
   - Excellent: No significant issues, well-maintained
   - Good: Minor issues only, generally good condition
   - Fair: Some moderate issues, typical wear and tear
   - Poor: Multiple major issues, significant repairs needed
   - Critical: Safety hazards or structural failures present

2. Status score: Provide a 0-100 score (100 = excellent, 0 = critical condition)
   - Base score on number and severity of issues
   - Deduct more points for critical/major issues

3. All issues/defects/problems found with:
   - Description of the issue (be specific and detailed)
   - Severity: "critical", "major", "moderate", or "minor"
     * Critical: Safety hazards, immediate failures, code violations
     * Major: Significant damage, urgent repairs, expensive fixes
     * Moderate: Notable issues, repair within 1-2 years
     * Minor: Cosmetic issues, low-priority maintenance
   - Category (e.g., structural, electrical, plumbing, roofing, HVAC, foundation, exterior, interior, etc.)
   - Recommendation to address the issue
   - Estimated cost if mentioned in report (as string, e.g., "$500-1000" or "$5,000-8,000")
   - Priority level from 1-5 (1 = highest priority, 5 = lowest)

4. General recommendations (list of strings)
   - Include maintenance recommendations
   - Include suggestions for improvements
   - Include any inspector's notes or advice

5. Overall assessment summary (comprehensive paragraph)
   - Summarize the property's overall condition
   - Highlight key concerns
   - Provide context for the findings

6. Cost estimates (if mentioned in report):
   - Immediate: Costs needed right away (safety issues, critical repairs)
   - Short-term: Costs within 1 year (major issues, important repairs)
   - Long-term: Costs beyond 1 year (moderate issues, future maintenance)

Return as structured JSON following the exact schema below."""

        # Define checkpoint analysis schema
        checkpoint_schema = {
            "type": "object",
            "properties": {
                "propertyStatus": {
                    "type": "string",
                    "enum": ["excellent", "good", "fair", "poor", "critical"]
                },
                "statusScore": {
                    "type": "integer",
                    "description": "Score from 0-100"
                },
                "issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "severity": {
                                "type": "string",
                                "enum": ["critical", "major", "moderate", "minor"]
                            },
                            "category": {"type": "string"},
                            "recommendation": {"type": "string"},
                            "estimatedCost": {"type": "string"},
                            "priority": {"type": "integer"}
                        },
                        "required": ["description", "severity"]
                    }
                },
                "recommendations": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "overallAssessment": {"type": "string"},
                "costEstimates": {
                    "type": "object",
                    "properties": {
                        "immediate": {"type": "string"},
                        "shortTerm": {"type": "string"},
                        "longTerm": {"type": "string"}
                    }
                }
            },
            "required": ["propertyStatus", "statusScore", "issues", "overallAssessment"]
        }
        
        # Create file part
        file_part = types.Part.from_uri(
            file_uri=request.docUrl,
            mime_type=request.contentType
        )
        
        contents = [prompt, file_part]
        
        # Generate analysis
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config={
                "temperature": 0.2,
                "top_p": 0.95,
                "max_output_tokens": 4096,
                "response_mime_type": "application/json",
                "response_schema": checkpoint_schema
            }
        )
        
        result_json = json.loads(response.text)
        logger.info(f"Checkpoint analysis complete: {result_json.get('propertyStatus')} ({result_json.get('statusScore')}/100)")
        
        # Convert to Pydantic models
        issues = []
        for issue_data in result_json.get("issues", []):
            issues.append(CheckpointReportIssue(
                description=issue_data["description"],
                severity=issue_data["severity"],
                category=issue_data.get("category"),
                recommendation=issue_data.get("recommendation"),
                estimatedCost=issue_data.get("estimatedCost"),
                priority=issue_data.get("priority")
            ))
        
        cost_estimates = None
        if "costEstimates" in result_json:
            cost_estimates = CheckpointReportCostEstimates(
                immediate=result_json["costEstimates"].get("immediate"),
                shortTerm=result_json["costEstimates"].get("shortTerm"),
                longTerm=result_json["costEstimates"].get("longTerm")
            )
        
        return CheckpointReportAnalysis(
            propertyStatus=result_json.get("propertyStatus"),
            statusScore=result_json.get("statusScore"),
            issues=issues,
            recommendations=result_json.get("recommendations", []),
            overallAssessment=result_json.get("overallAssessment"),
            costEstimates=cost_estimates
        )
        
    except Exception as e:
        logger.error(f"Checkpoint report analysis failed: {e}", exc_info=True)
        # Return minimal analysis on error
        return CheckpointReportAnalysis(
            propertyStatus="fair",
            statusScore=50,
            issues=[],
            recommendations=[],
            overallAssessment=f"Analysis failed: {str(e)}"
        )


def extract_doc_info(request: ExtractDocInfoRequest) -> ExtractDocInfoResponse:
    """
    Extract structured information from a property document using Gemini.

    This function:
    1. Creates a file part from the document URL (no download needed!)
    2. Sends it to Gemini 2.0 Flash with a structured prompt
    3. Extracts: document type, property address, key entities, and summary
    4. For checkpoint reports, performs additional comprehensive analysis
    5. Returns structured response matching ExtractDocInfoResponse schema

    Args:
        request: ExtractDocInfoRequest containing docUrl and contentType

    Returns:
        ExtractDocInfoResponse with extracted information

    Raises:
        Exception: If document analysis fails
    """
    try:
        if not client:
            raise Exception("Google Gen AI SDK not initialized")

        logger.info(f"Starting document analysis for {request.docUrl}")

        # Define the prompt - matches the TypeScript implementation
        prompt = """You are an expert real estate document analyst. Your task is to extract key information from the provided property document and return it in a structured format.

Analyze the document and provide the following:
1. Classify the documentType into one of: DEED, INSURANCE_POLICY, UTILITY_BILL, INSPECTION_REPORT, MORTGAGE_STATEMENT, CHECKPOINT_REPORT, OTHER
   - Use CHECKPOINT_REPORT for:
     * Home inspection reports
     * Property condition assessments
     * Building inspection reports
     * Property analysis reports
     * Maintenance assessment reports
     * Any report analyzing property condition with issues/recommendations
   - Use INSPECTION_REPORT only for formal pre-purchase home inspections from inspection companies
   - Use DEED for property deeds and title documents
   - Use INSURANCE_POLICY for insurance documents
   - Use UTILITY_BILL for utility bills
   - Use MORTGAGE_STATEMENT for mortgage and loan documents
   - Use OTHER for documents that don't fit the above categories

2. Extract the full propertyAddress. IMPORTANT: Normalize the address to a standard format. For example, convert "St" to "Street" and "Ave" to "Avenue". If not found, return "N/A".

3. Identify 2-3 of the most important keyEntities:
   - For inspection reports: inspection date, inspector name, report number
   - For other documents: policy numbers, loan amounts, account numbers, dates
   
4. Provide a single-sentence summary of the document.

Return your response as a JSON object with this exact structure:
{
  "documentType": "DEED|INSURANCE_POLICY|UTILITY_BILL|INSPECTION_REPORT|MORTGAGE_STATEMENT|CHECKPOINT_REPORT|OTHER",
  "propertyAddress": "123 Main Street, Anytown, CA 12345",
  "keyEntities": [
    {"name": "Entity Name", "value": "Entity Value"}
  ],
  "summary": "One sentence summary of the document"
}

Document:"""

        # Define response schema
        response_schema = {
            "type": "object",
            "properties": {
                "documentType": {
                    "type": "string",
                    "enum": ["DEED", "INSURANCE_POLICY", "UTILITY_BILL", "INSPECTION_REPORT", "MORTGAGE_STATEMENT", "CHECKPOINT_REPORT", "OTHER"]
                },
                "propertyAddress": {
                    "type": "string",
                    "description": "Full normalized address or N/A"
                },
                "keyEntities": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "value": {"type": "string"}
                        },
                        "required": ["name", "value"]
                    }
                },
                "summary": {
                    "type": "string",
                    "description": "One sentence summary"
                }
            },
            "required": ["documentType", "propertyAddress", "keyEntities", "summary"]
        }

        # Create file part directly from URL (no download needed!)
        # The SDK supports both gs:// URIs and public https:// URLs
        file_part = types.Part.from_uri(
            file_uri=request.docUrl,
            mime_type=request.contentType
        )

        # Create contents with prompt and file
        contents = [prompt, file_part]

        # Generate analysis using new SDK
        logger.info("Sending document to Gemini for analysis...")
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config={
                "temperature": 0.1,  # Low temperature for consistent extraction
                "top_p": 0.95,
                "max_output_tokens": 2048,
                "response_mime_type": "application/json",
                "response_schema": response_schema
            }
        )

        # Parse JSON response
        result_json = json.loads(response.text)
        doc_type = result_json.get("documentType")
        logger.info(f"Analysis complete: {doc_type}")

        # Check if this is a checkpoint report
        checkpoint_analysis = None
        if _is_checkpoint_report(doc_type, result_json.get("summary", "")):
            logger.info("Document identified as checkpoint report - performing detailed analysis")
            checkpoint_analysis = _analyze_checkpoint_report(request)
            # Override document type to CHECKPOINT_REPORT if not already set
            if doc_type != "CHECKPOINT_REPORT":
                doc_type = "CHECKPOINT_REPORT"

        # Convert to response model
        return ExtractDocInfoResponse(
            documentType=DocumentType(doc_type),
            propertyAddress=result_json["propertyAddress"],
            keyEntities=[
                KeyEntity(name=entity["name"], value=entity["value"])
                for entity in result_json["keyEntities"]
            ],
            summary=result_json["summary"],
            checkpointAnalysis=checkpoint_analysis
        )

    except Exception as e:
        logger.error(f"Document analysis failed: {e}", exc_info=True)
        # Return fallback response instead of raising
        return ExtractDocInfoResponse(
            documentType=DocumentType.OTHER,
            propertyAddress="N/A",
            keyEntities=[],
            summary=f"Analysis failed: {str(e)}"
        )

