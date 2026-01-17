"""
Intelligent checkpoint name generation based on AI analysis results.

This module generates descriptive, concise checkpoint names that highlight
the most important information from AI analysis (issues, condition, location).
"""

from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


def generate_checkpoint_name(
    analysis_result: Dict[str, Any],
    location: Optional[str],
    detected_asset: Optional[str]
) -> str:
    """
    Generate an intelligent checkpoint name based on AI analysis.
    
    Priority order:
    1. Critical/Major issues: "{Issue} in {location}"
    2. Moderate issues: "{Location} with {issue}"
    3. Minor issues: "{Location} - {issue}"
    4. No issues (good condition): "{Condition} {location}"
    5. Fallback: "{Location} checkpoint"
    
    Args:
        analysis_result: Dictionary containing AI analysis results with keys:
            - issues: List of issue objects with 'description' and 'severity'
            - condition_scores: Dict with 'overall' score (0-100)
            - conditions: List of condition strings
            - summary: Brief description
        location: User-provided or detected location/room name
        detected_asset: AI-detected asset name (fallback for location)
        
    Returns:
        A concise, descriptive checkpoint name (max ~50 characters)
    """
    try:
        # Determine the location to use in the name
        final_location = _get_location_name(location, detected_asset)
        
        # Extract issues sorted by severity
        issues = _extract_and_sort_issues(analysis_result.get("issues", []))
        
        # Generate name based on highest priority issue or condition
        if issues:
            return _generate_name_with_issues(issues, final_location)
        else:
            # No issues - use positive condition-based name
            return _generate_name_without_issues(
                analysis_result.get("condition_scores", {}),
                analysis_result.get("conditions", []),
                final_location
            )
            
    except Exception as e:
        logger.warning(f"Error generating checkpoint name: {e}")
        # Fallback to simple naming
        return _fallback_name(location, detected_asset)


def _get_location_name(location: Optional[str], detected_asset: Optional[str]) -> str:
    """Get the best available location name."""
    if location and location.strip():
        return location.strip()
    elif detected_asset and detected_asset.strip():
        return detected_asset.strip()
    else:
        return "Property"


def _extract_and_sort_issues(issues: List[Any]) -> List[Dict[str, str]]:
    """
    Extract and sort issues by severity (critical > major > moderate > minor).
    
    Args:
        issues: List of issue objects or strings
        
    Returns:
        Sorted list of issue dicts with 'description' and 'severity'
    """
    severity_order = {"critical": 0, "major": 1, "moderate": 2, "minor": 3}
    parsed_issues = []
    
    for issue in issues:
        if isinstance(issue, dict):
            description = issue.get("description", "")
            severity = issue.get("severity", "minor").lower()
            if description:
                parsed_issues.append({
                    "description": description,
                    "severity": severity,
                    "order": severity_order.get(severity, 4)
                })
        elif isinstance(issue, str) and issue.strip():
            # Legacy string format - treat as minor
            parsed_issues.append({
                "description": issue.strip(),
                "severity": "minor",
                "order": 3
            })
    
    # Sort by severity (critical first)
    parsed_issues.sort(key=lambda x: x["order"])
    return parsed_issues


def _generate_name_with_issues(
    issues: List[Dict[str, str]], 
    location: str
) -> str:
    """
    Generate name when issues are present.
    
    Format depends on severity:
    - Critical/Major: "{Issue} in {location}"
    - Moderate: "{Location} with {issue}"
    - Minor: "{Location} - {issue}"
    """
    if not issues:
        return _fallback_name(location, None)
    
    top_issue = issues[0]
    severity = top_issue["severity"]
    description = top_issue["description"]
    
    # Shorten the issue description if needed
    short_description = _shorten_issue_description(description)
    
    if severity in ["critical", "major"]:
        # Critical/Major: Highlight the issue prominently
        name = f"{short_description} in {location}"
    elif severity == "moderate":
        # Moderate: Location first, then issue
        name = f"{location} with {short_description}"
    else:  # minor
        # Minor: Location with subtle issue mention
        name = f"{location} - {short_description}"
    
    # Ensure name isn't too long
    return _truncate_name(name)


def _generate_name_without_issues(
    condition_scores: Dict[str, float],
    conditions: List[str],
    location: str
) -> str:
    """
    Generate positive name when no issues are detected.
    
    Uses condition scores and condition keywords to generate names like:
    - "Excellent kitchen" (score 90+)
    - "Well-maintained bathroom" (score 75-89)
    - "Good condition garage" (score 60-74)
    - "Kitchen checkpoint" (fallback)
    """
    # Get overall condition score
    overall_score = condition_scores.get("overall", 0)
    
    # Determine condition adjective based on score
    if overall_score >= 90:
        adjective = "Excellent"
    elif overall_score >= 75:
        adjective = "Well-maintained"
    elif overall_score >= 60:
        adjective = "Good condition"
    else:
        # Score is low but no issues detected - use neutral name
        # Check if any positive conditions are present
        adjective = _get_positive_adjective_from_conditions(conditions)
    
    if adjective:
        name = f"{adjective} {location.lower()}"
    else:
        # Fallback to simple name
        name = f"{location} checkpoint"
    
    return _truncate_name(name)


def _get_positive_adjective_from_conditions(conditions: List[str]) -> Optional[str]:
    """Extract positive adjective from condition keywords."""
    if not conditions:
        return None
    
    # Map condition keywords to adjectives
    positive_keywords = {
        "excellent": "Excellent",
        "good": "Good",
        "clean": "Clean",
        "well-maintained": "Well-maintained",
        "pristine": "Pristine",
        "new": "Like-new"
    }
    
    conditions_lower = [c.lower() for c in conditions if isinstance(c, str)]
    
    for keyword, adjective in positive_keywords.items():
        if any(keyword in c for c in conditions_lower):
            return adjective
    
    return None


def _shorten_issue_description(description: str, max_length: int = 30) -> str:
    """
    Shorten issue description to make it more concise.
    
    Removes common prefixes/suffixes and shortens long descriptions.
    """
    # Remove common redundant prefixes
    prefixes_to_remove = [
        "detected ", "visible ", "apparent ", "possible ",
        "signs of ", "evidence of ", "indication of "
    ]
    
    desc_lower = description.lower()
    shortened = description
    
    for prefix in prefixes_to_remove:
        if desc_lower.startswith(prefix):
            shortened = description[len(prefix):]
            break
    
    # Capitalize first letter
    if shortened:
        shortened = shortened[0].upper() + shortened[1:]
    
    # Truncate if still too long
    if len(shortened) > max_length:
        shortened = shortened[:max_length-3] + "..."
    
    return shortened


def _truncate_name(name: str, max_length: int = 50) -> str:
    """Truncate name to maximum length, adding ellipsis if needed."""
    if len(name) <= max_length:
        return name
    
    # Try to truncate at a word boundary
    truncated = name[:max_length-3]
    last_space = truncated.rfind(' ')
    
    if last_space > max_length * 0.7:  # If we can keep at least 70% of content
        truncated = truncated[:last_space]
    
    return truncated + "..."


def _fallback_name(location: Optional[str], detected_asset: Optional[str]) -> str:
    """Generate simple fallback name when analysis data is insufficient."""
    final_location = _get_location_name(location, detected_asset)
    return f"{final_location} checkpoint"
