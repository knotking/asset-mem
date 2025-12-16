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
    Analyzes a checkpoint image or video using Gemini AI, including room/area detection.
    
    Args:
        media_url: GCS URI of the image or video (gs://bucket/path)
        content_type: MIME type of the media (e.g., "image/jpeg", "video/mp4")
        location: Optional location description (if provided, room detection may be skipped)
        
    Returns:
        Dictionary with analysis results:
        {
            "summary": str,
            "conditions": List[str],
            "detectedItems": List[str],
            "issues": List[str],
            "detectedRoom": Optional[str],  # Auto-detected room/area name
            "roomConfidence": Optional[float],  # Confidence score for room detection
            "roomFeatures": Optional[List[str]]  # Key features that identify the room
        }
    """
    if not client:
        raise Exception("Google Gen AI SDK not initialized")

    is_video = content_type and content_type.startswith("video/")
    media_type = "video" if is_video else "image"
    logger.info(f"Starting checkpoint analysis for {media_type}: {media_url}")

    # Detect room/area if location not provided
    detected_room_info = None
    if not location:
        try:
            detected_room_info = detect_room_area(media_url, content_type)
            location = detected_room_info["detectedRoom"]  # Use detected room for analysis prompt
            logger.info(f"Auto-detected room: {location} (confidence: {detected_room_info['roomConfidence']})")
        except Exception as e:
            logger.warning(f"Room detection failed, continuing without it: {e}")

    prompt = f"""
        Analyze this {media_type} of a property checkpoint.
        Location: {location or 'Unknown'}
        
        Provide a structured analysis in JSON format with the following fields:
        - summary: A brief summary of what is seen.
        - conditions: A list of conditions (e.g., "good", "damaged", "wear and tear", "clean", "cluttered").
        - detectedItems: A list of objects or items identified.
        - issues: A list of potential issues or damage detected. If none, return empty list.
    """

    response_schema = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "conditions": {"type": "array", "items": {"type": "string"}},
            "detectedItems": {"type": "array", "items": {"type": "string"}},
            "issues": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["summary", "conditions", "detectedItems", "issues"]
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

    result = {
        "summary": result_json["summary"],
        "conditions": result_json["conditions"],
        "detectedItems": result_json["detectedItems"],
        "issues": result_json["issues"]
    }

    # Add room detection info if available
    if detected_room_info:
        result["detectedRoom"] = detected_room_info["detectedRoom"]
        result["roomConfidence"] = detected_room_info["roomConfidence"]
        result["roomFeatures"] = detected_room_info["roomFeatures"]
        result["areaDescription"] = detected_room_info["areaDescription"]

    return result

