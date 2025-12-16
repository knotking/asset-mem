"""
Area/Room Detection Service

Intelligently detects and groups checkpoints by area/room using Gemini Vision AI.
"""

import os
import json
import logging
from typing import List, Dict, Optional, Tuple
from google import genai
from google.genai import types

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
    logger.info(f"Google Gen AI SDK initialized for area detection in {LOCATION}")
except Exception as e:
    logger.error(f"Failed to initialize Google Gen AI SDK: {e}")
    client = None

def detect_room_area(media_url: str, content_type: str) -> Dict[str, any]:
    """
    Detects the room/area type from an image or video using Gemini Vision.
    
    Args:
        media_url: GCS URI of the image or video (gs://bucket/path)
        content_type: MIME type of the media (e.g., "image/jpeg", "video/mp4")
        
    Returns:
        Dictionary with:
        {
            "detectedRoom": str,  # e.g., "Kitchen", "Living Room", "Bathroom", "Bedroom", "Exterior"
            "roomConfidence": float,  # 0.0-1.0 confidence score
            "roomFeatures": List[str],  # Key features that identify the room (e.g., ["stove", "sink", "refrigerator"])
            "areaDescription": str  # More detailed description
        }
    """
    if not client:
        raise Exception("Google Gen AI SDK not initialized")

    is_video = content_type and content_type.startswith("video/")
    media_type = "video" if is_video else "image"
    logger.info(f"Detecting room/area from {media_type}: {media_url}")

    prompt = f"""
        Analyze this property checkpoint {media_type} and identify the room or area type.
        
        Identify the specific room/area (e.g., Kitchen, Living Room, Bedroom, Bathroom, 
        Dining Room, Office, Garage, Exterior Front, Exterior Back, Basement, Attic, etc.).
        
        Provide a structured analysis in JSON format with the following fields:
        - detectedRoom: A concise room/area name (e.g., "Kitchen", "Master Bedroom", "Bathroom", "Exterior Front")
        - roomConfidence: A float between 0.0 and 1.0 indicating confidence in the detection
        - roomFeatures: A list of key features/objects that identify this room (e.g., ["stove", "sink", "refrigerator"] for kitchen)
        - areaDescription: A brief description of the area shown (e.g., "Kitchen with island and modern appliances")
        
        Be specific with room names when possible (e.g., "Master Bedroom" vs "Bedroom", 
        "Guest Bathroom" vs "Main Bathroom"). For exterior shots, specify direction/location 
        (e.g., "Exterior Front", "Exterior Back", "Driveway", "Backyard").
    """

    response_schema = {
        "type": "object",
        "properties": {
            "detectedRoom": {"type": "string"},
            "roomConfidence": {"type": "number"},
            "roomFeatures": {"type": "array", "items": {"type": "string"}},
            "areaDescription": {"type": "string"}
        },
        "required": ["detectedRoom", "roomConfidence", "roomFeatures", "areaDescription"]
    }

    file_part = types.Part.from_uri(
        file_uri=media_url,
        mime_type=content_type
    )

    contents = [prompt, file_part]

    logger.info("Sending image to Gemini for room/area detection...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config={
            "temperature": 0.3,  # Lower temperature for more consistent room detection
            "top_p": 0.95,
            "max_output_tokens": 512,
            "response_mime_type": "application/json",
            "response_schema": response_schema
        }
    )

    result_json = json.loads(response.text)
    logger.info(f"Room detection complete: {result_json.get('detectedRoom')} (confidence: {result_json.get('roomConfidence')})")

    return {
        "detectedRoom": result_json["detectedRoom"],
        "roomConfidence": result_json["roomConfidence"],
        "roomFeatures": result_json["roomFeatures"],
        "areaDescription": result_json["areaDescription"]
    }


def compare_room_similarity(media1_url: str, media2_url: str, 
                           content_type1: str, content_type2: str,
                           room1: Optional[str] = None, 
                           room2: Optional[str] = None) -> Dict[str, any]:
    """
    Compares two images or videos to determine if they show the same room/area.
    
    This is used to group checkpoints from the same area even if the room name
    detection is slightly different (e.g., "Kitchen" vs "Modern Kitchen").
    Supports comparing images to images, videos to videos, or images to videos.
    
    Args:
        media1_url: GCS URI of first media file (image or video)
        media2_url: GCS URI of second media file (image or video)
        content_type1: MIME type of first media (e.g., "image/jpeg", "video/mp4")
        content_type2: MIME type of second media
        room1: Optional detected room name for first media
        room2: Optional detected room name for second media
        
    Returns:
        Dictionary with:
        {
            "isSameArea": bool,
            "similarityScore": float,  # 0.0-1.0
            "reasoning": str  # Explanation of why/why not same area
        }
    """
    if not client:
        raise Exception("Google Gen AI SDK not initialized")

    logger.info(f"Comparing room similarity between {media1_url} and {media2_url}")

    room_context = ""
    if room1 and room2:
        room_context = f"Note: First image was detected as '{room1}', second as '{room2}'. "

    prompt = f"""
        {room_context}Compare these two property checkpoint images/videos to determine if they show 
        the SAME room or area of the property.
        
        Consider:
        1. Room type (Kitchen, Bedroom, Bathroom, etc.)
        2. Layout and furniture arrangement
        3. Visible fixtures and features (sinks, appliances, windows, doors)
        4. Wall color, flooring, architectural details
        5. Overall spatial layout
        
        Provide a structured analysis in JSON format:
        - isSameArea: boolean - true if these images show the same room/area
        - similarityScore: float 0.0-1.0 - how similar the areas are (1.0 = identical room, 
          0.0 = completely different rooms). Use 0.8+ for same room with different angles/lighting.
        - reasoning: string - brief explanation of your decision (e.g., "Same kitchen, different viewing angle" 
          or "Different rooms - first is kitchen with stove visible, second is living room with couch")
    """

    response_schema = {
        "type": "object",
        "properties": {
            "isSameArea": {"type": "boolean"},
            "similarityScore": {"type": "number"},
            "reasoning": {"type": "string"}
        },
        "required": ["isSameArea", "similarityScore", "reasoning"]
    }

    media1_part = types.Part.from_uri(media1_url, mime_type=content_type1)
    media2_part = types.Part.from_uri(media2_url, mime_type=content_type2)

    contents = [prompt, media1_part, media2_part]

    logger.info("Comparing media files for room similarity...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config={
            "temperature": 0.2,  # Lower temperature for more consistent comparisons
            "top_p": 0.95,
            "max_output_tokens": 512,
            "response_mime_type": "application/json",
            "response_schema": response_schema
        }
    )

    result_json = json.loads(response.text)
    logger.info(f"Similarity check: isSameArea={result_json.get('isSameArea')}, score={result_json.get('similarityScore')}")

    return {
        "isSameArea": result_json["isSameArea"],
        "similarityScore": result_json["similarityScore"],
        "reasoning": result_json["reasoning"]
    }


def find_matching_checkpoint(new_media_url: str, new_content_type: str,
                             existing_checkpoints: List[Dict]) -> Optional[Dict]:
    """
    Finds an existing checkpoint that matches the new image/video's area.
    
    Args:
        new_media_url: GCS URI of the new checkpoint media (image or video)
        new_content_type: MIME type of the new media (e.g., "image/jpeg", "video/mp4")
        existing_checkpoints: List of existing checkpoint dicts with at least:
            {
                "id": str,
                "media": [{"gsURI": str, "contentType": str}],
                "detectedRoom": Optional[str],
                "location": Optional[str]
            }
    
    Returns:
        Matching checkpoint dict if found (with similarity score), None otherwise
    """
    if not existing_checkpoints:
        return None

    # First, detect room for new media
    try:
        new_room_detection = detect_room_area(new_media_url, new_content_type)
        new_room = new_room_detection["detectedRoom"]
        logger.info(f"New checkpoint detected as: {new_room}")
    except Exception as e:
        logger.error(f"Failed to detect room for new media: {e}")
        return None

    # Compare with existing checkpoints
    best_match = None
    best_score = 0.0
    SIMILARITY_THRESHOLD = 0.75  # Minimum similarity to consider as same area

    for existing in existing_checkpoints:
        # Skip if no media
        if not existing.get("media") or len(existing["media"]) == 0:
            continue

        existing_media = existing["media"][0]
        existing_room = existing.get("detectedRoom") or existing.get("location")

        try:
            # Compare media files (images or videos)
            similarity_result = compare_room_similarity(
                media1_url=new_media_url,
                media2_url=existing_media.get("gsURI") or existing_media.get("url"),
                content_type1=new_content_type,
                content_type2=existing_media.get("contentType", "image/jpeg"),
                room1=new_room,
                room2=existing_room
            )

            similarity_score = similarity_result["similarityScore"]

            # Also boost score if room names match (even if slightly different wording)
            if existing_room and new_room:
                if existing_room.lower() == new_room.lower():
                    similarity_score = max(similarity_score, 0.9)
                elif existing_room.lower() in new_room.lower() or new_room.lower() in existing_room.lower():
                    similarity_score = max(similarity_score, 0.85)

            if similarity_result["isSameArea"] and similarity_score > best_score:
                best_score = similarity_score
                best_match = {
                    **existing,
                    "matchSimilarity": similarity_score,
                    "matchReasoning": similarity_result["reasoning"],
                    "newRoomDetection": new_room_detection
                }

        except Exception as e:
            logger.warning(f"Failed to compare with checkpoint {existing.get('id')}: {e}")
            continue

    # Only return match if above threshold
    if best_match and best_score >= SIMILARITY_THRESHOLD:
        logger.info(f"Found matching checkpoint: {best_match.get('id')} (similarity: {best_score})")
        return best_match

    logger.info(f"No matching checkpoint found (best score: {best_score})")
    return None

