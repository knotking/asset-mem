"""
Checkpoint Embedding Service

Generates vector embeddings from checkpoint analysis text for semantic search using Firestore Vector Search.
"""

import os
import logging
from typing import List, Optional, Dict, Any
from google import genai
from google.genai.types import EmbedContentConfig

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
    logger.info(f"Google Gen AI SDK initialized for embeddings (project: {PROJECT_ID}, location: {LOCATION})")
except Exception as e:
    logger.error(f"Failed to initialize Google Gen AI SDK for embeddings: {e}")
    client = None

# Embedding model configuration
EMBEDDING_MODEL = "text-embedding-004"
EMBEDDING_DIMENSION = 768  # Standard dimension for text-embedding-004


def extract_checkpoint_text(checkpoint_data: Dict[str, Any]) -> str:
    """
    Extracts and concatenates relevant text from checkpoint data for embedding generation.
    
    Args:
        checkpoint_data: Dictionary containing checkpoint data including aiAnalysis, location, etc.
        
    Returns:
        Concatenated text string suitable for embedding generation
    """
    text_parts = []
    
    # Extract AI analysis summary
    ai_analysis = checkpoint_data.get("aiAnalysis", {})
    if isinstance(ai_analysis, dict):
        summary = ai_analysis.get("summary", "")
        if summary:
            text_parts.append(f"Summary: {summary}")
        
        # Extract detected items
        detected_items = ai_analysis.get("detectedItems", [])
        if detected_items:
            items_text = ", ".join(detected_items) if isinstance(detected_items, list) else str(detected_items)
            text_parts.append(f"Detected items: {items_text}")
        
        # Extract conditions
        conditions = ai_analysis.get("conditions", [])
        if conditions:
            conditions_text = ", ".join(conditions) if isinstance(conditions, list) else str(conditions)
            text_parts.append(f"Conditions: {conditions_text}")
        
        # Extract issues with descriptions
        issues = ai_analysis.get("issues", [])
        if issues:
            issue_descriptions = []
            for issue in issues:
                if isinstance(issue, dict):
                    # Structured issue format
                    desc = issue.get("description", "")
                    severity = issue.get("severity", "")
                    category = issue.get("category", "")
                    if desc:
                        issue_text = desc
                        if severity:
                            issue_text += f" (severity: {severity})"
                        if category:
                            issue_text += f" (category: {category})"
                        issue_descriptions.append(issue_text)
                elif isinstance(issue, str):
                    # Legacy string format
                    issue_descriptions.append(issue)
            
            if issue_descriptions:
                issues_text = "; ".join(issue_descriptions)
                text_parts.append(f"Issues: {issues_text}")
        
        # Extract detected room information
        detected_room = ai_analysis.get("detectedRoom") or checkpoint_data.get("detectedRoom")
        if detected_room:
            text_parts.append(f"Location: {detected_room}")
        
        room_features = ai_analysis.get("roomFeatures", []) or checkpoint_data.get("roomFeatures", [])
        if room_features and isinstance(room_features, list):
            features_text = ", ".join(room_features)
            text_parts.append(f"Room features: {features_text}")
        
        area_description = ai_analysis.get("areaDescription") or checkpoint_data.get("areaDescription")
        if area_description:
            text_parts.append(f"Area description: {area_description}")
    
    # Add location if available (from top-level checkpoint data)
    location = checkpoint_data.get("location")
    if location and location not in text_parts:
        # Only add if not already included from detectedRoom
        if not any(f"Location: {location}" in part for part in text_parts):
            text_parts.append(f"Location: {location}")
    
    # Join all text parts with newlines
    combined_text = "\n".join(text_parts)
    
    logger.debug(f"Extracted text for embedding (length: {len(combined_text)} chars)")
    return combined_text


def generate_checkpoint_embedding(checkpoint_data: Dict[str, Any]) -> Optional[List[float]]:
    """
    Generates a vector embedding from checkpoint analysis text using Gemini Embeddings API.
    
    Args:
        checkpoint_data: Dictionary containing checkpoint data including aiAnalysis
        
    Returns:
        List of floats representing the embedding vector (768 dimensions), or None if generation fails
    """
    if not client:
        logger.error("Google Gen AI SDK not initialized for embeddings")
        return None
    
    try:
        # Extract text from checkpoint analysis
        text = extract_checkpoint_text(checkpoint_data)
        
        if not text or len(text.strip()) == 0:
            logger.warning("No text extracted from checkpoint data, skipping embedding generation")
            return None
        
        logger.info(f"Generating embedding for checkpoint using model {EMBEDDING_MODEL}")
        
        # Generate embedding using text-embedding-004
        result = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=[text],
            config=EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSION)
        )
        
        # Extract embedding vector from result
        if result and result.embeddings and len(result.embeddings) > 0:
            embedding = result.embeddings[0].values
            if embedding and len(embedding) == EMBEDDING_DIMENSION:
                logger.info(f"Successfully generated embedding (dimension: {len(embedding)})")
                return list(embedding)  # Convert to list of floats
            else:
                logger.error(f"Invalid embedding dimension: {len(embedding) if embedding else 0}, expected {EMBEDDING_DIMENSION}")
                return None
        else:
            logger.error("No embeddings returned from API")
            return None
            
    except Exception as e:
        logger.error(f"Error generating checkpoint embedding: {e}", exc_info=True)
        return None
