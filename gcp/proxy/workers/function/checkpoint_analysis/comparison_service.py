"""
Comparison Service

Handles comparing checkpoints to detect changes over time.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from google import genai
from google.genai import types
from firebase_admin import firestore
from google.cloud.firestore_v1 import FieldFilter
from prompt_builder import get_asset_category, build_comparison_prompt
from common.token import accumulate_google_genai_generate_response

logger = logging.getLogger(__name__)

# Initialize Google Gen AI Client with Vertex AI
PROJECT_ID = None
client = None

def _initialize_client():
    """Initialize the Gemini client if not already initialized."""
    global client, PROJECT_ID
    if client is None:
        import os
        PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
        
        try:
            client = genai.Client(
                vertexai=True,
                project=PROJECT_ID,
                location="global",
            )
            logger.info(
                "Google Gen AI SDK initialized for comparison (project=%s, location=global)",
                PROJECT_ID,
            )
        except Exception as e:
            logger.error(f"Failed to initialize Google Gen AI SDK for comparison: {e}")
            client = None

def find_previous_checkpoint(
    db: firestore.Client,
    user_id: str,
    property_id: str,
    current_checkpoint_id: str,
    location: Optional[str],
    detected_asset: Optional[str],
    max_age_days: Optional[int] = None,
    user_preferences: Optional[Dict[str, Any]] = None,
    *,
    series_id: Optional[str] = None,
    revision_number: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """
    Finds the most recent previous checkpoint for comparison.

    When series_id is set, prefers the prior capture in the same series
    (revision N-1). Falls back to location-based matching during migration.
    """
    if series_id:
        from common.checkpoint.series import find_previous_capture_in_series

        previous = find_previous_capture_in_series(
            db,
            user_id,
            property_id,
            series_id,
            current_checkpoint_id,
            revision_number=revision_number,
        )
        if previous:
            logger.info(
                "Found previous capture in series %s: %s",
                series_id,
                previous.get("id"),
            )
            return previous
        logger.info(
            "No prior capture in series %s for checkpoint %s",
            series_id,
            current_checkpoint_id,
        )
        return None

    try:
        # Get max_age_days from preferences if not provided
        if max_age_days is None:
            comparison_prefs = user_preferences.get("checkpointComparison", {}) if user_preferences else {}
            max_age_days = comparison_prefs.get("maxAgeDays", 180)
        
        checkpoints_ref = db.collection("users").document(user_id)\
            .collection("properties").document(property_id)\
            .collection("checkpoints")
        
        # Calculate the minimum creation date (max_age_days ago)
        min_date = datetime.utcnow() - timedelta(days=max_age_days)
        
        # Try location-based matching first (most reliable)
        search_locations = []
        if location:
            search_locations.append(location)
        if detected_asset and detected_asset != location:
            search_locations.append(detected_asset)
        
        for search_loc in search_locations:
            if not search_loc:
                continue
                
            # Query by location, excluding current checkpoint, ordered by creation date descending.
            # Use the newer 'filter=' API to avoid positional-args warnings on newer firestore clients.
            query = (
                checkpoints_ref.where(filter=FieldFilter("location", "==", search_loc))
                .where(filter=FieldFilter("createdAt", ">", min_date))
                .order_by("createdAt", direction=firestore.Query.DESCENDING)
                .limit(1)
            )
            
            docs = list(query.stream())
            
            # Filter out current checkpoint
            for doc in docs:
                if doc.id != current_checkpoint_id:
                    checkpoint_data = doc.to_dict()
                    checkpoint_data["id"] = doc.id
                    logger.info(f"Found previous checkpoint by location '{search_loc}': {doc.id}")
                    return checkpoint_data
        
        logger.info(
            "comparison.skipped.no_prior_in_area property=%s checkpoint=%s locations=%s",
            property_id,
            current_checkpoint_id,
            search_locations,
        )
        return None
        
    except Exception as e:
        logger.error(f"Error finding previous checkpoint: {e}", exc_info=True)
        return None

def get_user_preferences(
    db: firestore.Client,
    user_id: str
) -> Optional[Dict[str, Any]]:
    """
    Fetches user preferences from Firestore.
    
    Args:
        db: Firestore client
        user_id: User ID
        
    Returns:
        Dictionary with user preferences, or None if not found
    """
    try:
        preferences_ref = db.collection("users").document(user_id)\
            .collection("preferences").document("user")
        
        preferences_doc = preferences_ref.get()
        if preferences_doc.exists:
            return preferences_doc.to_dict()
        return None
    except Exception as e:
        logger.error(f"Error fetching user preferences: {e}", exc_info=True)
        return None

def should_compare_checkpoints(
    previous_checkpoint: Optional[Dict[str, Any]],
    asset_confidence: Optional[float] = None,
    skip_comparison: bool = False,
    user_preferences: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Determines if comparison should be performed based on preferences and conditions.
    
    Args:
        previous_checkpoint: Previous checkpoint data (None if not found)
        asset_confidence: Confidence score for asset detection (0.0-1.0)
        skip_comparison: Checkpoint-level flag to skip comparison
        user_preferences: User preferences dictionary from Firestore
        
    Returns:
        True if comparison should be performed, False otherwise
    """
    # Check user-level preference (master switch)
    comparison_prefs = {}
    if user_preferences:
        comparison_prefs = user_preferences.get("checkpointComparison", {})
    
    if not comparison_prefs.get("enabled", True):  # Default to True if not set
        logger.info("Comparison disabled by user preference")
        return False
    
    # Check checkpoint-level override
    if skip_comparison:
        logger.info("Comparison skipped by checkpoint flag")
        return False
    
    if not previous_checkpoint:
        logger.info("No previous checkpoint found, skipping comparison")
        return False
    
    # Check if previous checkpoint has media
    media = previous_checkpoint.get("media", [])
    if not media or not media[0].get("gsURI"):
        logger.warning("Previous checkpoint has no media, skipping comparison")
        return False
    
    # Check room confidence threshold from preferences (default: 0.3)
    min_confidence = comparison_prefs.get("minAssetConfidence", 0.3)
    if asset_confidence is not None and asset_confidence < min_confidence:
        logger.info(f"Asset confidence ({asset_confidence}) below threshold ({min_confidence}), skipping comparison")
        return False
    
    return True

def compare_checkpoints(
    image1_url: str,
    image2_url: str,
    content_type1: str,
    content_type2: str,
    location: Optional[str] = None,
    usage_sink: dict | None = None,
) -> Dict[str, Any]:
    """
    Compares two checkpoint images/videos using Gemini AI.
    
    Args:
        image1_url: GCS URI of the first (older) image/video
        image2_url: GCS URI of the second (newer) image/video
        content_type1: MIME type of the first media
        content_type2: MIME type of the second media
        location: Optional location description
        
    Returns:
        Dictionary with comparison results:
        {
            "summary": str,
            "similarityScore": float,
            "semanticChanges": List[str],
            "regions": List[Dict]  # ChangeRegion objects
        }
    """
    _initialize_client()
    
    if not client:
        raise Exception("Google Gen AI SDK not initialized for comparison")
    
    logger.info(f"Comparing checkpoints: {image1_url} vs {image2_url}")
    
    model = "gemini-3.1-flash-lite"
    
    image1_part = types.Part.from_uri(file_uri=image1_url, mime_type=content_type1)
    image2_part = types.Part.from_uri(file_uri=image2_url, mime_type=content_type2)
    
    # Determine asset category (platform-agnostic approach)
    asset_category = get_asset_category(location)
    logger.info(f"Comparison asset category: {asset_category}")
    
    # Build prompt using platform-extensible prompt builder
    prompt_base = build_comparison_prompt(
        location=location,
        asset_category=asset_category,
        detected_asset=location  # Use location as detected_asset for comparison
    )
    
    # Complete the prompt with JSON schema (common to all asset types)
    prompt = f"""{prompt_base}
    - summary: A brief summary of the key differences.
    - similarityScore: A float between 0.0 (completely different) and 1.0 (identical).
    - semanticChanges: A list of strings describing the changes.
    - regions: A list of objects describing specific changes, each with:
        - description: What changed.
        - changeType: 'added', 'removed', or 'modified'.
        - severity: 'minor', 'moderate', 'major', or 'critical'.
        - confidence: A float between 0.0 and 1.0.
        - bbox: Optional bounding box {{x, y, width, height}} (normalized 0-1000) if applicable.
    """
    
    response_schema = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "similarityScore": {"type": "number"},
            "semanticChanges": {"type": "array", "items": {"type": "string"}},
            "regions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "changeType": {"type": "string"},
                        "severity": {"type": "string"},
                        "confidence": {"type": "number"},
                        "bbox": {
                            "type": "object",
                            "properties": {
                                "x": {"type": "number"},
                                "y": {"type": "number"},
                                "width": {"type": "number"},
                                "height": {"type": "number"}
                            }
                        }
                    },
                    "required": ["description", "changeType", "severity", "confidence"]
                }
            }
        },
        "required": ["summary", "similarityScore", "semanticChanges", "regions"]
    }
    
    try:
        response = client.models.generate_content(
            model=model,
            contents=[prompt, image1_part, image2_part],
            config={
                "temperature": 0.2,
                "top_p": 1,
                "top_k": 32,
                "max_output_tokens": 2048,
                "response_mime_type": "application/json",
                "response_schema": response_schema
            }
        )
        if usage_sink is not None:
            accumulate_google_genai_generate_response(usage_sink, response)

        import json
        result_json = json.loads(response.text)
        
        logger.info(f"Comparison complete: similarity={result_json.get('similarityScore', 0.0)}")
        return result_json
        
    except Exception as e:
        logger.error(f"Error comparing checkpoints: {e}", exc_info=True)
        raise

