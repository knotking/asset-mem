"""
Inspection Report Parser Module

This module provides functionality to extract structured data from inspection reports
(PDFs, images, Word docs) using Gemini AI with document understanding capabilities.
"""

import logging
from typing import Dict, List, Optional, Any
from google import genai
from google.genai import types
import os

logger = logging.getLogger(__name__)

# Initialize Gemini client
try:
    client = genai.Client(
        api_key=os.getenv("GEMINI_API_KEY"),
        http_options={'api_version': 'v1alpha'}
    )
    logger.info("Google Gen AI SDK initialized successfully for report parsing")
except Exception as e:
    logger.error(f"Failed to initialize Google Gen AI SDK for report parsing: {e}")
    client = None


def parse_inspection_report(
    document_uri: str,
    content_type: str,
    asset_type: Optional[str] = None,
    location: Optional[str] = None
) -> Dict[str, Any]:
    """
    Parse an inspection report document and extract structured findings.
    
    Args:
        document_uri: GCS URI of the document (gs://bucket/path)
        content_type: MIME type of the document (e.g., "application/pdf", "image/jpeg")
        asset_type: Optional asset type hint (real_estate, vehicle, appliance, other)
        location: Optional location description
        
    Returns:
        Dictionary with extracted report data:
        {
            "summary": str,
            "inspectorName": Optional[str],
            "inspectionDate": Optional[str],
            "overallCondition": str,
            "detectedItems": List[str],
            "conditions": List[str],
            "issues": List[dict],  # Structured issues with severity
            "reportFindings": {
                "majorIssues": List[dict],
                "minorIssues": List[dict],
                "recommendations": List[str],
                "overallCondition": str,
                "inspectorNotes": Optional[str]
            },
            "condition_scores": dict,
            "issues_by_severity": dict
        }
    """
    if not client:
        raise Exception("Google Gen AI SDK not initialized")

    logger.info(f"Starting inspection report parsing: {document_uri}")

    # Build asset-specific context
    asset_context = ""
    if asset_type == "real_estate" or asset_type == "home_inspection":
        asset_context = "This is a home/real estate inspection report. Focus on structural, mechanical, and safety issues."
    elif asset_type == "vehicle" or asset_type == "vehicle_inspection":
        asset_context = "This is a vehicle inspection report. Focus on mechanical, safety, and maintenance issues."
    elif asset_type == "appliance" or asset_type == "appliance_maintenance":
        asset_context = "This is an appliance maintenance/inspection report. Focus on functionality and safety issues."
    else:
        asset_context = "This is a general inspection report."

    location_context = f" The inspection covers: {location}." if location else ""

    # Create the analysis prompt
    prompt = f"""You are an expert at analyzing inspection reports. {asset_context}{location_context}

Analyze this inspection report document and extract the following information in a structured format:

1. **Inspector Information**: Extract the inspector's name/company if mentioned.
2. **Inspection Date**: Extract the date of inspection if mentioned (format: YYYY-MM-DD).
3. **Overall Condition**: Provide an overall assessment (Excellent, Good, Fair, Poor, or Critical).
4. **Summary**: Write a concise 2-3 sentence summary of the key findings.
5. **Detected Items**: List the main areas/components that were inspected.
6. **Issues Found**: Extract ALL issues mentioned in the report, categorized by severity:
   - **Critical**: Immediate safety hazards, structural failures, code violations
   - **Major**: Significant defects requiring prompt attention, expensive repairs
   - **Moderate**: Issues that should be addressed soon, moderate cost
   - **Minor**: Small defects, cosmetic issues, low priority items

7. **Recommendations**: Extract any recommendations made by the inspector.
8. **Cost Estimates**: Extract any cost estimates mentioned (if available).
9. **Inspector Notes**: Any additional notes or observations from the inspector.

Return your analysis in this EXACT JSON format:
{{
    "inspectorName": "Name or Company (or null if not found)",
    "inspectionDate": "YYYY-MM-DD (or null if not found)",
    "overallCondition": "Excellent|Good|Fair|Poor|Critical",
    "summary": "Concise summary of key findings",
    "detectedItems": ["item1", "item2", "item3"],
    "conditions": ["condition1", "condition2"],
    "issues": [
        {{
            "description": "Detailed description of the issue",
            "severity": "critical|major|moderate|minor",
            "category": "structural|mechanical|electrical|plumbing|safety|cosmetic|other",
            "estimatedCost": 1500 (number or null),
            "confidence": 0.9
        }}
    ],
    "recommendations": ["recommendation1", "recommendation2"],
    "inspectorNotes": "Additional notes (or null)"
}}

IMPORTANT:
- Be thorough - extract ALL issues mentioned in the report
- Classify severity accurately based on urgency and impact
- Include cost estimates only if explicitly mentioned in the report
- Use null for any fields where information is not found
- Ensure all JSON is properly formatted and valid
"""

    try:
        # Upload the document to Gemini
        file_part = types.Part.from_uri(
            file_uri=document_uri,
            mime_type=content_type
        )

        # Generate content with the document and prompt
        response = client.models.generate_content(
            model='gemini-2.0-flash-exp',
            contents=[file_part, prompt],
            config=types.GenerateContentConfig(
                temperature=0.1,  # Low temperature for consistent extraction
                response_mime_type="application/json"
            )
        )

        # Parse the JSON response
        import json
        result = json.loads(response.text)

        logger.info(f"Successfully parsed inspection report. Found {len(result.get('issues', []))} issues.")

        # Transform the result to match checkpoint analysis format
        transformed_result = transform_report_to_checkpoint_format(result)

        return transformed_result

    except Exception as e:
        logger.error(f"Error parsing inspection report: {e}")
        raise


def transform_report_to_checkpoint_format(report_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform parsed report data into the checkpoint analysis format.
    
    Args:
        report_data: Raw parsed report data from Gemini
        
    Returns:
        Transformed data matching CheckpointAnalysis structure
    """
    issues = report_data.get("issues", [])
    
    # Separate issues by severity for reportFindings
    major_issues = [
        {
            "description": issue["description"],
            "severity": issue["severity"],
            "estimatedCost": issue.get("estimatedCost")
        }
        for issue in issues
        if issue["severity"] in ["critical", "major"]
    ]
    
    minor_issues = [
        {
            "description": issue["description"],
            "severity": issue["severity"]
        }
        for issue in issues
        if issue["severity"] in ["moderate", "minor"]
    ]
    
    # Count issues by severity
    issues_by_severity = {
        "critical": sum(1 for i in issues if i["severity"] == "critical"),
        "major": sum(1 for i in issues if i["severity"] == "major"),
        "moderate": sum(1 for i in issues if i["severity"] == "moderate"),
        "minor": sum(1 for i in issues if i["severity"] == "minor")
    }
    
    # Calculate condition scores based on overall condition
    overall_condition = report_data.get("overallCondition", "Fair")
    condition_score_map = {
        "Excellent": 95,
        "Good": 80,
        "Fair": 65,
        "Poor": 45,
        "Critical": 25
    }
    overall_score = condition_score_map.get(overall_condition, 65)
    
    # Build condition scores
    condition_scores = {
        "overall": overall_score,
        "structural": overall_score,  # Can be refined based on issue categories
        "mechanical": overall_score,
        "cosmetic": overall_score
    }
    
    # Adjust scores based on issue severity
    if issues_by_severity["critical"] > 0:
        condition_scores["overall"] = min(condition_scores["overall"], 30)
    elif issues_by_severity["major"] > 2:
        condition_scores["overall"] = min(condition_scores["overall"], 50)
    
    return {
        "summary": report_data.get("summary", "Inspection report analyzed"),
        "detectedItems": report_data.get("detectedItems", []),
        "conditions": report_data.get("conditions", [overall_condition]),
        "issues": issues,  # Keep structured format
        "issues_by_severity": issues_by_severity,
        "reportFindings": {
            "majorIssues": major_issues,
            "minorIssues": minor_issues,
            "recommendations": report_data.get("recommendations", []),
            "overallCondition": overall_condition,
            "inspectorNotes": report_data.get("inspectorNotes")
        },
        "condition_scores": condition_scores,
        "inspectorName": report_data.get("inspectorName"),
        "inspectionDate": report_data.get("inspectionDate"),
        "aiConfidence": 0.85  # High confidence for document-based analysis
    }

