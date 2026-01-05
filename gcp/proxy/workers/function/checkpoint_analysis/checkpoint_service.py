"""
Checkpoint Analysis Service

Handles analyzing checkpoint images using Google Gemini AI.
"""

import os
import json
import logging
from google import genai
from google.genai import types
from area_detection import detect_room_area
from prompt_builder import get_asset_category, build_analysis_prompt
from report_parser import parse_inspection_report

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

def analyze_checkpoint_image(media_url: str, content_type: str, location: str = None) -> dict:
    """
    Analyzes a checkpoint image or video using Gemini AI, including asset detection.
    
    Args:
        media_url: GCS URI of the image or video (gs://bucket/path)
        content_type: MIME type of the media (e.g., "image/jpeg", "video/mp4")
        location: Optional location description (if provided, asset detection may be skipped)
        
    Returns:
        Dictionary with analysis results:
        {
            "summary": str,
            "conditions": List[str],
            "detectedItems": List[str],
            "issues": List[str],
            "detectedAsset": Optional[str],  # Auto-detected asset name (room, appliance, vehicle, etc.)
            "assetConfidence": Optional[float],  # Confidence score for asset detection
            "assetFeatures": Optional[List[str]]  # Key features that identify the asset
        }
    """
    if not client:
        raise Exception("Google Gen AI SDK not initialized")

    is_video = content_type and content_type.startswith("video/")
    media_type = "video" if is_video else "image"
    logger.info(f"Starting checkpoint analysis for {media_type}: {media_url}")

    # Detect asset and asset category if location not provided
    detected_asset_info = None
    asset_category = "property"  # Default
    
    if not location:
        try:
            detected_asset_info = detect_room_area(media_url, content_type)
            location = detected_asset_info["detectedAsset"]  # Use detected asset for analysis prompt
            logger.info(f"Auto-detected asset: {location} (confidence: {detected_asset_info['assetConfidence']})")
        except Exception as e:
            logger.warning(f"Asset detection failed, continuing without it: {e}")
    
    # Determine asset category from detected information (platform-agnostic approach)
    if detected_asset_info:
        asset_category = get_asset_category(
            detected_asset_info.get("detectedAsset"),
            detected_asset_info.get("assetFeatures")
        )
        logger.info(f"Detected asset category: {asset_category}")
    elif location:
        # Fallback: use location to determine category if no AI detection
        asset_category = get_asset_category(location)
    
    # Build prompt using platform-extensible prompt builder
    prompt = build_analysis_prompt(
        media_type=media_type,
        location=location,
        asset_category=asset_category,
        detected_asset=detected_asset_info.get("detectedAsset") if detected_asset_info else None
    )

    response_schema = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "conditions": {"type": "array", "items": {"type": "string"}},
            "detectedItems": {"type": "array", "items": {"type": "string"}},
            "issues": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "severity": {"type": "string", "enum": ["minor", "moderate", "major", "critical"]}
                    },
                    "required": ["description", "severity"]
                }
            },
            "condition_scores": {
                "type": "object",
                "description": "Condition scores (0-100) for various components. 100 = perfect, 0 = completely damaged. Include all visible/apparent components.",
                "additionalProperties": {"type": "number", "minimum": 0, "maximum": 100}
            },
            "damage_scores": {
                "type": "object",
                "description": "Damage severity scores (0-100) for various damage types. 0 = none, 100 = severe. Include all detected damage types.",
                "additionalProperties": {"type": "number", "minimum": 0, "maximum": 100}
            },
            "cost_estimates": {
                "type": "object",
                "description": "Cost estimates in USD for repairs and maintenance",
                "properties": {
                    "repairs_immediate": {
                        "type": "number",
                        "minimum": 0,
                        "description": "Estimated immediate repair cost in USD (0 if none needed)"
                    },
                    "maintenance_annual": {
                        "type": "number",
                        "minimum": 0,
                        "description": "Estimated annual maintenance cost in USD"
                    }
                },
                "required": ["repairs_immediate", "maintenance_annual"]
            }
        },
        "required": ["summary", "conditions", "detectedItems", "issues", "condition_scores", "damage_scores", "cost_estimates"]
    }

    media_part = types.Part.from_uri(
        file_uri=media_url,
        mime_type=content_type
    )

    contents = [prompt, media_part]

    logger.info(f"Sending checkpoint {media_type} to Gemini for analysis...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config={
            "temperature": 0.4,
            "top_p": 0.95,
            "max_output_tokens": 2048,
            "response_mime_type": "application/json",
            "response_schema": response_schema
        }
    )

    result_json = json.loads(response.text)
    logger.info("Checkpoint analysis complete")

    # Validate that required structured fields are present (schema should enforce this, but validate anyway)
    if "condition_scores" not in result_json or not result_json["condition_scores"]:
        logger.warning("Gemini did not return condition_scores, using empty dict")
        result_json["condition_scores"] = {}
    
    if "damage_scores" not in result_json or not result_json["damage_scores"]:
        logger.warning("Gemini did not return damage_scores, using empty dict")
        result_json["damage_scores"] = {}
    
    if "cost_estimates" not in result_json:
        logger.warning("Gemini did not return cost_estimates, using defaults")
        result_json["cost_estimates"] = {"repairs_immediate": 0, "maintenance_annual": 0}
    else:
        if "repairs_immediate" not in result_json["cost_estimates"]:
            result_json["cost_estimates"]["repairs_immediate"] = 0
        if "maintenance_annual" not in result_json["cost_estimates"]:
            result_json["cost_estimates"]["maintenance_annual"] = 0

    # Convert issues from objects to list format for backward compatibility
    # while preserving severity information
    issues_list = result_json.get("issues", [])
    if issues_list and isinstance(issues_list[0], dict):
        # New format with severity - keep as objects for structured data
        issues = issues_list
    else:
        # Legacy format (strings) - convert to objects with default severity
        issues = [
            {"description": issue, "severity": "minor"}
            for issue in issues_list
        ] if issues_list else []

    result = {
        "summary": result_json["summary"],
        "conditions": result_json["conditions"],
        "detectedItems": result_json["detectedItems"],
        "issues": issues,
        "condition_scores": result_json.get("condition_scores", {}),
        "damage_scores": result_json.get("damage_scores", {}),
        "cost_estimates": result_json.get("cost_estimates", {
            "repairs_immediate": 0,
            "maintenance_annual": 0
        })
    }

    # Add room detection info if available
    if detected_asset_info:
        result["detectedAsset"] = detected_asset_info["detectedAsset"]
        result["assetConfidence"] = detected_asset_info["assetConfidence"]
        result["assetFeatures"] = detected_asset_info["assetFeatures"]
        result["areaDescription"] = detected_asset_info["areaDescription"]

    return result


def analyze_inspection_report(document_uri: str, content_type: str, asset_type: str = None, location: str = None) -> dict:
    """
    Analyzes an inspection report document using Gemini AI with document understanding.
    
    Args:
        document_uri: GCS URI of the document (gs://bucket/path)
        content_type: MIME type of the document (e.g., "application/pdf", "image/jpeg")
        asset_type: Optional asset type (real_estate, vehicle, appliance, other)
        location: Optional location description
        
    Returns:
        Dictionary with analysis results in the same format as analyze_checkpoint_image:
        {
            "summary": str,
            "conditions": List[str],
            "detectedItems": List[str],
            "issues": List[dict],  # Structured issues with severity
            "reportFindings": dict,  # Report-specific findings
            "condition_scores": dict,
            "damage_scores": dict,
            "cost_estimates": dict,
            "issues_by_severity": dict,
            "inspectorName": Optional[str],
            "inspectionDate": Optional[str]
        }
    """
    if not client:
        raise Exception("Google Gen AI SDK not initialized")

    logger.info(f"Starting inspection report analysis: {document_uri}")

    try:
        # Parse the inspection report using the report parser
        result = parse_inspection_report(document_uri, content_type, asset_type, location)
        
        # Add damage scores based on issues (for consistency with image analysis)
        issues_by_severity = result.get("issues_by_severity", {})
        damage_scores = {
            "structural": 100 - (issues_by_severity.get("critical", 0) * 20 + issues_by_severity.get("major", 0) * 10),
            "surface": 100 - (issues_by_severity.get("moderate", 0) * 10 + issues_by_severity.get("minor", 0) * 5),
            "functional": result.get("condition_scores", {}).get("mechanical", 80)
        }
        
        # Ensure damage scores are within bounds
        for key in damage_scores:
            damage_scores[key] = max(0, min(100, damage_scores[key]))
        
        result["damage_scores"] = damage_scores
        
        # Add cost estimates if not present
        if "cost_estimates" not in result:
            # Estimate costs based on issues
            major_issues = result.get("reportFindings", {}).get("majorIssues", [])
            total_cost = sum(issue.get("estimatedCost", 0) for issue in major_issues if issue.get("estimatedCost"))
            
            result["cost_estimates"] = {
                "repairs_immediate": total_cost if total_cost > 0 else None,
                "maintenance_annual": None
            }
        
        logger.info(f"Successfully analyzed inspection report. Found {len(result.get('issues', []))} issues.")
        
        return result
        
    except Exception as e:
        logger.error(f"Error analyzing inspection report: {e}")
        raise

