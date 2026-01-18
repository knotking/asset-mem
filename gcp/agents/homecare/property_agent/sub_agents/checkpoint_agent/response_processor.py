"""
Response Processor for Checkpoint Agent

This module validates and enforces dual-format (Markdown + JSON) responses from the checkpoint agent.
It provides fallback JSON generation when the LLM doesn't follow instructions perfectly.
"""

import json
import logging
import re
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime

logger = logging.getLogger(__name__)


def validate_checkpoint_response(response: str) -> Tuple[bool, str, Optional[Dict]]:
    """
    Validates that a checkpoint agent response contains both Markdown and JSON.
    
    Args:
        response: The raw response from the checkpoint agent
        
    Returns:
        Tuple of (is_valid, processed_response, extracted_json)
        - is_valid: True if response has valid dual format
        - processed_response: The response (potentially fixed)
        - extracted_json: Extracted JSON dict or None
    """
    if not response or not response.strip():
        logger.warning("Empty checkpoint response received")
        return False, response, None
    
    # Try to extract JSON from the response
    extracted_json = extract_json_from_response(response)
    
    if extracted_json:
        # Validate that JSON has required checkpoint structure
        if has_checkpoint_structure(extracted_json):
            logger.info("✓ Valid checkpoint response with proper JSON structure")
            return True, response, extracted_json
        else:
            logger.warning("⚠ JSON found but missing checkpoint structure fields")
            return False, response, extracted_json
    else:
        logger.warning("⚠ No valid JSON found in checkpoint response")
        return False, response, None


def extract_json_from_response(response: str) -> Optional[Dict]:
    """
    Extracts JSON from a checkpoint agent response.
    Tries multiple patterns to find JSON code blocks.
    
    Args:
        response: The raw response text
        
    Returns:
        Extracted JSON dict or None if not found
    """
    if not response:
        return None
    
    # Method 1: Look for ```json code block
    json_code_block_pattern = r'```json\s*\n?([\s\S]*?)```'
    match = re.search(json_code_block_pattern, response)
    if match:
        json_str = match.group(1).strip()
        try:
            parsed = json.loads(json_str)
            logger.debug("✓ Extracted JSON from ```json code block")
            return parsed
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON from code block: {e}")
    
    # Method 2: Look for any code block that might be JSON
    any_code_block_pattern = r'```\s*\n?([\s\S]*?)```'
    match = re.search(any_code_block_pattern, response)
    if match:
        code_content = match.group(1).strip()
        if code_content.startswith('{') or code_content.startswith('['):
            try:
                parsed = json.loads(code_content)
                logger.debug("✓ Extracted JSON from generic code block")
                return parsed
            except json.JSONDecodeError:
                pass
    
    # Method 3: Look for JSON object in the text (between { and })
    # Find the last occurrence of a JSON-like structure
    json_pattern = r'\{[\s\S]*"analysis"[\s\S]*\}'
    matches = list(re.finditer(json_pattern, response))
    if matches:
        # Try from the last match backwards
        for match in reversed(matches):
            json_str = match.group(0)
            try:
                parsed = json.loads(json_str)
                logger.debug("✓ Extracted JSON from text pattern")
                return parsed
            except json.JSONDecodeError:
                continue
    
    logger.debug("✗ No JSON found in response")
    return None


def has_checkpoint_structure(json_data: Dict) -> bool:
    """
    Checks if JSON has the required checkpoint response structure.
    
    Args:
        json_data: The parsed JSON dict
        
    Returns:
        True if it has checkpoint structure (checkpointSummary or checkpointDetails)
    """
    if not json_data or not isinstance(json_data, dict):
        return False
    
    # Check nested structure (analysis.*)
    if "analysis" in json_data and isinstance(json_data["analysis"], dict):
        analysis = json_data["analysis"]
        has_checkpoint_fields = (
            "checkpointSummary" in analysis or 
            "checkpointDetails" in analysis
        )
        if has_checkpoint_fields:
            return True
    
    # Check flat structure
    has_checkpoint_fields = (
        "checkpointSummary" in json_data or 
        "checkpointDetails" in json_data
    )
    
    return has_checkpoint_fields


def generate_fallback_json(
    checkpoints: List[Dict],
    user_query: str,
    markdown_response: Optional[str] = None
) -> Dict:
    """
    Generates fallback JSON structure when the agent doesn't return proper JSON.
    
    Args:
        checkpoints: List of checkpoint dicts from ask_checkpoints_retrieval
        user_query: The original user query
        markdown_response: Optional markdown text from agent
        
    Returns:
        A properly structured JSON dict for checkpoint responses
    """
    logger.info(f"Generating fallback JSON for {len(checkpoints)} checkpoints")
    
    # Extract locations from checkpoints
    locations = list(set([
        cp.get("location") for cp in checkpoints 
        if cp.get("location")
    ]))
    
    # Count checkpoints
    checkpoint_count = len(checkpoints)
    
    # Extract issues from all checkpoints
    all_issues = []
    for cp in checkpoints:
        issues = cp.get("issues", [])
        if isinstance(issues, list):
            for issue in issues:
                if isinstance(issue, dict):
                    issue_desc = issue.get("description", "")
                    if issue_desc and issue_desc not in all_issues:
                        all_issues.append(issue_desc)
                elif isinstance(issue, str) and issue not in all_issues:
                    all_issues.append(issue)
    
    # Determine query type based on query content
    query_lower = user_query.lower()
    if any(word in query_lower for word in ["change", "changed", "compare", "difference"]):
        query_type = "comparison"
    elif any(word in query_lower for word in ["trend", "over time", "history"]):
        query_type = "trend"
    elif any(loc.lower() in query_lower for loc in locations if loc):
        query_type = "location-specific"
    else:
        query_type = "single"
    
    # Build checkpoint details
    checkpoint_details = []
    for cp in checkpoints:
        detail = {
            "name": cp.get("checkpointName") or cp.get("location") or "Checkpoint",
            "location": cp.get("location", ""),
            "date": format_date(cp.get("createdAt")),
            "summary": cp.get("summary", ""),
            "detectedItems": cp.get("detectedItems", []),
            "conditions": cp.get("conditions", []),
            "issues": []
        }
        
        # Format issues
        issues = cp.get("issues", [])
        if isinstance(issues, list):
            for issue in issues:
                if isinstance(issue, dict):
                    detail["issues"].append(issue.get("description", ""))
                elif isinstance(issue, str):
                    detail["issues"].append(issue)
        
        checkpoint_details.append(detail)
    
    # Determine date range
    dates = [cp.get("createdAt") for cp in checkpoints if cp.get("createdAt")]
    date_range = ""
    if dates:
        try:
            # Sort dates and get range
            sorted_dates = sorted(dates)
            if len(sorted_dates) >= 2:
                start_date = format_date(sorted_dates[0], short=True)
                end_date = format_date(sorted_dates[-1], short=True)
                date_range = f"{start_date} - {end_date}"
            else:
                date_range = format_date(sorted_dates[0], short=True)
        except Exception as e:
            logger.warning(f"Error formatting date range: {e}")
    
    # Generate title
    if locations:
        title = f"{', '.join(locations[:3])} Checkpoint Query"
    else:
        title = "Checkpoint Query Results"
    
    # Build the JSON structure
    fallback_json = {
        "analysis": {
            "title": title,
            "checkpointSummary": {
                "checkpointsAnalyzed": checkpoint_count,
                "queryType": query_type,
                "locations": locations,
                "dateRange": date_range,
                "issuesDetected": all_issues[:10],  # Limit to 10
                "overallCondition": generate_overall_condition(all_issues)
            },
            "checkpointDetails": checkpoint_details
        }
    }
    
    # Add insights if it's a comparison or trend query
    if query_type in ["comparison", "trend"]:
        fallback_json["analysis"]["insights"] = {
            "changes": "Multiple checkpoints analyzed. Review checkpoint details for specific changes.",
            "patterns": f"{checkpoint_count} checkpoints found across {len(locations)} location(s).",
            "recommendations": "Review the detected issues and conditions for each checkpoint."
        }
    
    logger.info(f"✓ Generated fallback JSON with {checkpoint_count} checkpoints")
    return fallback_json


def format_date(date_value: Any, short: bool = False) -> str:
    """
    Formats a date value into a readable string.
    
    Args:
        date_value: Date value (could be timestamp, datetime, or string)
        short: If True, returns short format (e.g., "Jan 2025")
        
    Returns:
        Formatted date string
    """
    if not date_value:
        return ""
    
    try:
        # Handle Firestore timestamp
        if hasattr(date_value, 'seconds'):
            dt = datetime.fromtimestamp(date_value.seconds)
        # Handle datetime object
        elif isinstance(date_value, datetime):
            dt = date_value
        # Handle string
        elif isinstance(date_value, str):
            # Try parsing ISO format
            dt = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
        else:
            return str(date_value)
        
        if short:
            return dt.strftime("%b %Y")
        else:
            return dt.strftime("%Y-%m-%d")
    except Exception as e:
        logger.debug(f"Error formatting date {date_value}: {e}")
        return str(date_value)


def generate_overall_condition(issues: List[str]) -> str:
    """
    Generates an overall condition assessment based on issues.
    
    Args:
        issues: List of issue descriptions
        
    Returns:
        Overall condition string
    """
    if not issues:
        return "No issues detected"
    elif len(issues) == 1:
        return "Minor issue detected"
    elif len(issues) <= 3:
        return "Some issues requiring attention"
    else:
        return "Multiple issues requiring attention"


def ensure_dual_format_response(
    response: str,
    checkpoints: List[Dict],
    user_query: str
) -> str:
    """
    Ensures the response has both Markdown and JSON.
    If JSON is missing, appends generated fallback JSON.
    
    Args:
        response: The agent's response
        checkpoints: Retrieved checkpoints data
        user_query: Original user query
        
    Returns:
        Response with guaranteed dual format
    """
    is_valid, processed_response, extracted_json = validate_checkpoint_response(response)
    
    if is_valid:
        logger.info("✓ Response already has valid dual format")
        return processed_response
    
    # Generate fallback JSON
    fallback_json = generate_fallback_json(checkpoints, user_query, response)
    
    # If there's no JSON at all, append it
    if not extracted_json:
        logger.warning("⚠ No JSON found - appending fallback JSON to response")
        json_str = json.dumps(fallback_json, indent=2)
        
        # Ensure response ends with newline
        if not response.endswith('\n'):
            response += '\n'
        
        # Append JSON code block
        response += f"\n```json\n{json_str}\n```\n"
        
        logger.info("✓ Appended fallback JSON to response")
        return response
    
    # If JSON exists but is invalid, try to fix it
    if extracted_json and not has_checkpoint_structure(extracted_json):
        logger.warning("⚠ JSON exists but lacks checkpoint structure - replacing with fallback")
        
        # Remove the old JSON code block
        response = re.sub(r'```json\s*\n?[\s\S]*?```', '', response)
        response = re.sub(r'```\s*\n?[\s\S]*?```', '', response)
        
        # Append corrected JSON
        json_str = json.dumps(fallback_json, indent=2)
        if not response.endswith('\n'):
            response += '\n'
        response += f"\n```json\n{json_str}\n```\n"
        
        logger.info("✓ Replaced invalid JSON with fallback")
        return response
    
    return response
