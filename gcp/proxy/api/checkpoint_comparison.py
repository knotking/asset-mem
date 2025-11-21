import vertexai
from vertexai.generative_models import GenerativeModel, Part
import json
import os
import logging
from schemas.checkpoint import CheckpointComparisonResponse, ChangeRegion

logger = logging.getLogger(__name__)

# Initialize Vertex AI
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")

if PROJECT_ID:
    vertexai.init(project=PROJECT_ID, location=LOCATION)

def compare_checkpoints(
    image1_url: str,
    image2_url: str,
    content_type1: str,
    content_type2: str,
    location: str = None
) -> CheckpointComparisonResponse:
    
    model = GenerativeModel("gemini-2.5-flash")

    image1_part = Part.from_uri(image1_url, mime_type=content_type1)
    image2_part = Part.from_uri(image2_url, mime_type=content_type2)

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

    generation_config = {
        "max_output_tokens": 2048,
        "temperature": 0.2,
        "top_p": 1,
        "top_k": 32,
        "response_mime_type": "application/json",
    }

    try:
        response = model.generate_content(
            [image1_part, image2_part, prompt],
            generation_config=generation_config,
        )
        
        json_response = json.loads(response.text)
        
        # Validate and parse into Pydantic model
        return CheckpointComparisonResponse(**json_response)

    except Exception as e:
        logger.error(f"Error comparing checkpoints: {e}", exc_info=True)
        raise e
