import os
import logging
import json
from typing import Dict, Any
from google import genai
from google.genai import types

from schemas.checkpoint import AnalyzeCheckpointRequest, CheckpointAnalysisResponse

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

def analyze_checkpoint(request: AnalyzeCheckpointRequest) -> CheckpointAnalysisResponse:
    try:
        if not client:
            raise Exception("Google Gen AI SDK not initialized")

        logger.info(f"Starting checkpoint analysis for {request.imageUrl}")

        prompt = f"""
            Analyze this image of a property checkpoint.
            Location: {request.location or 'Unknown'}
            
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

        file_part = types.Part.from_uri(
            file_uri=request.imageUrl,
            mime_type=request.contentType
        )

        contents = [prompt, file_part]

        logger.info("Sending checkpoint image to Gemini for analysis...")
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

        return CheckpointAnalysisResponse(
            summary=result_json["summary"],
            conditions=result_json["conditions"],
            detectedItems=result_json["detectedItems"],
            issues=result_json["issues"]
        )

    except Exception as e:
        logger.error(f"Checkpoint analysis failed: {e}", exc_info=True)
        return CheckpointAnalysisResponse(
            summary=f"Analysis failed: {str(e)}",
            conditions=[],
            detectedItems=[],
            issues=[]
        )
