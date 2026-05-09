"""
Checkpoint Service

Handles checkpoint related operations:
1. Publishing checkpoint analysis requests to Pub/Sub for async processing.
2. Comparing two checkpoints using Gemini AI.
"""

import os
import json
import logging
from typing import Optional
from google.cloud import pubsub_v1
from google import genai
from google.genai import types

from schemas.checkpoint import AnalyzeCheckpointRequest, CheckpointComparisonResponse

logger = logging.getLogger(__name__)

# Configuration
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
CHECKPOINT_ANALYSIS_TOPIC = os.environ.get("CHECKPOINT_ANALYSIS_TOPIC", "checkpoint-analysis-topic")
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")

if not PROJECT_ID:
    logger.warning("GCP_PROJECT_ID not set, checkpoint analysis publishing may fail")

# Initialize Google Gen AI Client (lazy init)
genai_client = None

def _initialize_genai_client():
    """Initialize the Gemini client if not already initialized."""
    global genai_client
    if genai_client is None:
        try:
            genai_client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
            logger.info(f"Google Gen AI SDK initialized for checkpoint comparison in {LOCATION}")
        except Exception as e:
            logger.error(f"Failed to initialize Google Gen AI SDK: {e}")
            genai_client = None

def publish_checkpoint_analysis(request: AnalyzeCheckpointRequest) -> str:
    """
    Publishes a checkpoint analysis request to Pub/Sub for async processing.
    
    Args:
        request: AnalyzeCheckpointRequest with checkpoint details
        
    Returns:
        Message ID from Pub/Sub
    """
    try:
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(PROJECT_ID, CHECKPOINT_ANALYSIS_TOPIC)
        
        payload = {
            "imageUrl": request.imageUrl,
            "contentType": request.contentType,
            "location": request.location,
            "checkpointId": request.checkpointId,
            "userId": request.userId,
            "propertyId": request.propertyId,
            "source": "checkpoint-analysis-api"
        }
        
        data = json.dumps(payload).encode("utf-8")
        future = publisher.publish(topic_path, data)
        message_id = future.result()
        
        logger.info(f"Published checkpoint analysis to {CHECKPOINT_ANALYSIS_TOPIC}: {message_id}")
        return message_id
        
    except Exception as e:
        logger.error(f"Failed to publish checkpoint analysis to Pub/Sub: {e}")
        raise

def compare_checkpoints(
    image1_url: str,
    image2_url: str,
    content_type1: str,
    content_type2: str,
    location: Optional[str] = None
) -> CheckpointComparisonResponse:
    """
    Compare two checkpoint images using Gemini AI to identify differences.
    """
    _initialize_genai_client()
    if not genai_client:
        raise Exception("Google Gen AI SDK not initialized")

    image1_part = types.Part.from_uri(file_uri=image1_url, mime_type=content_type1)
    image2_part = types.Part.from_uri(file_uri=image2_url, mime_type=content_type2)

    prompt = f"""
    Compare these two images of a property checkpoint (Image 1 is 'Before' or 'Previous', Image 2 is 'After' or 'Current').
    Location: {location or 'Unknown'}

    Identify the differences between the two images, focusing on:
    1. Structural changes (damage, repairs).
    2. Item changes (added, removed, moved).
    3. Condition changes (wear and tear, cleaning).

    Provide a structured comparison in JSON format with the following fields:
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
            "similarityScore": {"type": "number", "minimum": 0, "maximum": 1},
            "semanticChanges": {"type": "array", "items": {"type": "string"}},
            "regions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "changeType": {"type": "string", "enum": ["added", "removed", "modified"]},
                        "severity": {"type": "string", "enum": ["minor", "moderate", "major", "critical"]},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "bbox": {
                            "type": "object",
                            "properties": {
                                "x": {"type": "number"},
                                "y": {"type": "number"},
                                "width": {"type": "number"},
                                "height": {"type": "number"},
                            },
                            "required": ["x", "y", "width", "height"],
                        },
                    },
                    "required": ["description", "changeType", "severity", "confidence"],
                },
            },
        },
        "required": ["summary", "similarityScore", "semanticChanges", "regions"],
    }

    try:
        response = genai_client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=[prompt, image1_part, image2_part],
            config={
                "max_output_tokens": 2048,
                "temperature": 0.2,
                "top_p": 1,
                "top_k": 32,
                "response_mime_type": "application/json",
                "response_schema": response_schema,
            },
        )
        
        json_response = json.loads(response.text)
        
        # Validate and parse into Pydantic model
        return CheckpointComparisonResponse(**json_response)

    except Exception as e:
        logger.error(f"Error comparing checkpoints: {e}", exc_info=True)
        raise e
