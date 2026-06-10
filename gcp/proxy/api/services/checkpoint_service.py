"""
Checkpoint Service

Handles checkpoint related operations:
1. Publishing checkpoint analysis requests to Pub/Sub for async processing.
2. Comparing two checkpoints using Gemini AI.
"""

import json
import logging
import os
import time
from typing import Any, Dict, Optional
from google.cloud import firestore
from google.cloud import pubsub_v1
from google import genai
from google.genai import types

from common.observability.logging_context import (
    get_correlation_id,
    pubsub_payload_with_correlation,
)
from schemas.checkpoint import AnalyzeCheckpointRequest, CheckpointComparisonResponse

logger = logging.getLogger(__name__)

# Configuration
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
CHECKPOINT_ANALYSIS_TOPIC = os.environ.get("CHECKPOINT_ANALYSIS_TOPIC", "checkpoint-analysis-topic")
CHECKPOINT_METRICS_TOPIC = os.environ.get("CHECKPOINT_METRICS_TOPIC", "checkpoint-metrics-topic")

if not PROJECT_ID:
    logger.warning("GCP_PROJECT_ID not set, checkpoint analysis publishing may fail")

# Initialize Google Gen AI Client (lazy init)
genai_client = None

def _initialize_genai_client():
    """Initialize the Gemini client if not already initialized."""
    global genai_client
    if genai_client is None:
        try:
            genai_client = genai.Client(vertexai=True, project=PROJECT_ID, location="global")
            logger.info(
                "Google Gen AI SDK initialized for checkpoint comparison (project=%s, location=global)",
                PROJECT_ID,
            )
        except Exception as e:
            logger.exception("Failed to initialize Google Gen AI SDK: %s", e)
            genai_client = None

def load_checkpoint_analysis_enqueue_context(
    db: firestore.Client,
    user_id: str,
) -> Dict[str, Any]:
    """
    Load worker context at enqueue time to avoid extra Firestore reads in the worker.

    Currently includes checkpoint comparison preferences from users/{userId}/preferences/user.
    """
    context: Dict[str, Any] = {}
    try:
        prefs_doc = (
            db.collection("users")
            .document(user_id)
            .collection("preferences")
            .document("user")
            .get()
        )
        if prefs_doc.exists:
            prefs = prefs_doc.to_dict() or {}
            comparison = prefs.get("checkpointComparison")
            if isinstance(comparison, dict):
                context["checkpointComparison"] = comparison
    except Exception as e:
        logger.warning(
            "Failed to load checkpoint analysis enqueue context user=%s: %s",
            user_id,
            e,
        )
    return context


def publish_checkpoint_analysis(
    request: AnalyzeCheckpointRequest,
    *,
    enqueue_context: Optional[Dict[str, Any]] = None,
) -> str:
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
        
        payload = pubsub_payload_with_correlation({
            "imageUrl": request.imageUrl,
            "contentType": request.contentType,
            "location": request.location,
            "checkpointId": request.checkpointId,
            "userId": request.userId,
            "propertyId": request.propertyId,
            "source": "checkpoint-analysis-api",
        })
        if enqueue_context:
            if isinstance(enqueue_context.get("checkpointComparison"), dict):
                payload["checkpointComparison"] = enqueue_context["checkpointComparison"]

        data = json.dumps(payload).encode("utf-8")
        future = publisher.publish(topic_path, data)
        message_id = future.result()

        logger.info(
            "Published checkpoint analysis topic=%s message_id=%s checkpointId=%s propertyId=%s",
            CHECKPOINT_ANALYSIS_TOPIC,
            message_id,
            request.checkpointId,
            request.propertyId,
        )
        logger.debug(
            "Published checkpoint analysis imageUrl_len=%s content_type=%s location_set=%s",
            len(request.imageUrl or ""),
            request.contentType,
            bool((request.location or "").strip()),
        )
        return message_id

    except Exception as e:
        logger.exception("Failed to publish checkpoint analysis to Pub/Sub: %s", e)
        raise


def publish_checkpoint_metrics_rebuild(
    *,
    user_id: str,
    property_id: str,
    reason: str = "checkpoint.deleted",
) -> str | None:
    """Queue a full property metrics re-aggregation (e.g. after checkpoint delete)."""
    if not PROJECT_ID or not CHECKPOINT_METRICS_TOPIC:
        logger.warning(
            "Skipping checkpoint metrics rebuild publish: GCP_PROJECT_ID or CHECKPOINT_METRICS_TOPIC not set"
        )
        return None
    try:
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(PROJECT_ID, CHECKPOINT_METRICS_TOPIC)
        payload = pubsub_payload_with_correlation(
            {
                "userId": user_id,
                "propertyId": property_id,
                "reason": reason,
                "mode": "full",
            }
        )
        message_id = publisher.publish(topic_path, json.dumps(payload).encode("utf-8")).result()
        logger.info(
            "Published checkpoint metrics rebuild topic=%s message_id=%s userId=%s propertyId=%s reason=%s",
            CHECKPOINT_METRICS_TOPIC,
            message_id,
            user_id,
            property_id,
            reason,
        )
        return message_id
    except Exception as e:
        logger.exception("Failed to publish checkpoint metrics rebuild: %s", e)
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

    t0 = time.monotonic()
    cid = get_correlation_id()
    logger.debug(
        "compare_checkpoints start correlation_id=%s image1_len=%d image2_len=%d location_set=%s",
        cid or "-",
        len(image1_url or ""),
        len(image2_url or ""),
        bool((location or "").strip()),
    )

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
        result = CheckpointComparisonResponse(**json_response)
        logger.info(
            "compare_checkpoints gemini_ok duration_ms=%d similarity=%.4f regions=%d semantic_changes=%d",
            int((time.monotonic() - t0) * 1000),
            result.similarityScore,
            len(result.regions),
            len(result.semanticChanges),
        )
        return result

    except Exception as e:
        logger.exception("Error comparing checkpoints in service: %s", e)
        raise
