"""
Firestore Vector Search Utility

Performs KNN (K-Nearest Neighbor) vector searches on checkpoint embeddings stored in Firestore.
"""

import os
import logging
from typing import Any, Dict, List, Optional
from google import genai
from google.genai.types import EmbedContentConfig

from agent_framework.observability.log_redaction import safe_text_preview

logger = logging.getLogger(__name__)

# Initialize Google Gen AI Client for embedding generation
PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")

embedding_client: genai.Client | None
try:
    embedding_client = genai.Client(
        vertexai=True, project=PROJECT_ID, location=LOCATION
    )
    logger.info(
        f"Google Gen AI SDK initialized for query embeddings (project: {PROJECT_ID}, location: {LOCATION})"
    )
except Exception as e:
    logger.exception(
        "Failed to initialize Google Gen AI SDK for query embeddings: %s", e
    )
    embedding_client = None

# Embedding model configuration
EMBEDDING_MODEL = "text-embedding-004"
EMBEDDING_DIMENSION = 768  # Standard dimension for text-embedding-004


def generate_query_embedding(query_text: str) -> Optional[List[float]]:
    """
    Generates a vector embedding for a query text using Gemini Embeddings API.

    Args:
        query_text: The user's query text to embed

    Returns:
        List of floats representing the embedding vector (768 dimensions), or None if generation fails
    """
    if not embedding_client:
        logger.error("Google Gen AI SDK not initialized for query embeddings")
        return None

    try:
        logger.info(
            "Generating query embedding query_len=%d preview=%r",
            len(query_text or ""),
            safe_text_preview(query_text, max_len=60),
        )

        if not query_text or not query_text.strip():
            logger.error("Empty query text provided for embedding generation")
            return None

        # Generate embedding using text-embedding-004
        logger.debug(
            f"Calling embedding_client.models.embed_content with model={EMBEDDING_MODEL}, dimension={EMBEDDING_DIMENSION}"
        )
        result = embedding_client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=query_text,
            config=EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSION),
        )

        logger.debug(
            f"Embedding API returned result: has_embeddings={bool(result and result.embeddings)}"
        )

        # Extract embedding vector from result
        if result and result.embeddings and len(result.embeddings) > 0:
            embedding = result.embeddings[0].values
            if embedding and len(embedding) == EMBEDDING_DIMENSION:
                logger.info(
                    "Successfully generated query embedding dimension=%d",
                    len(embedding),
                )
                return list(embedding)  # Convert to list of floats
            else:
                logger.error(
                    f"Invalid embedding dimension: {len(embedding) if embedding else 0}, expected {EMBEDDING_DIMENSION}"
                )
                return None
        else:
            logger.error(f"No embeddings returned from API. Result: {result}")
            return None

    except Exception as e:
        logger.error(
            f"Error generating query embedding for query '{query_text[:50]}...': {e}",
            exc_info=True,
        )
        return None


def search_checkpoints_by_vector(
    db,  # firestore.Client - using Any to avoid import at module level
    user_id: str,
    property_id: str,
    query_text: str,
    limit: int = 5,
    location: Optional[str] = None,
    distance_measure: str = "COSINE",
) -> List[Dict[str, Any]]:
    """
    Performs a KNN vector search on checkpoints using Firestore's findNearest API.

    Args:
        db: Firestore client instance
        user_id: User ID to filter checkpoints
        property_id: Property ID to filter checkpoints
        query_text: Natural language query text (will be embedded)
        limit: Maximum number of results to return (default: 10, max: 1000)
        location: Optional location filter (e.g., "Kitchen", "Car")
        distance_measure: Distance measure for vector comparison ("COSINE", "EUCLIDEAN", or "DOT_PRODUCT")

    Returns:
        List of checkpoint dictionaries with similarity information, sorted by relevance
    """
    try:
        # Lazy imports to avoid deployment issues
        from google.cloud import firestore  # type: ignore[attr-defined]
        from google.cloud.firestore_v1.vector import Vector
        from google.cloud.firestore_v1.base_vector_query import DistanceMeasure

        # Generate query embedding
        logger.info(
            "Starting vector search user_id=%s property_id=%s query_len=%d preview=%r "
            "limit=%d location=%r",
            user_id,
            property_id,
            len(query_text or ""),
            safe_text_preview(query_text, max_len=60),
            limit,
            location,
        )
        query_embedding = generate_query_embedding(query_text)
        if not query_embedding:
            logger.error(
                f"Failed to generate query embedding for query '{query_text}', returning empty results"
            )
            return []

        logger.info(
            f"Successfully generated query embedding (dimension: {len(query_embedding)})"
        )

        # Build query path to checkpoints collection
        # Note: propertyId is already implicit in the collection path (users/{userId}/properties/{propertyId}/checkpoints)
        checkpoints_ref = (
            db.collection("users")
            .document(user_id)
            .collection("properties")
            .document(property_id)
            .collection("checkpoints")
        )

        # Convert distance_measure string to DistanceMeasure enum
        distance_measure_enum = DistanceMeasure.COSINE
        if distance_measure == "EUCLIDEAN":
            distance_measure_enum = DistanceMeasure.EUCLIDEAN
        elif distance_measure == "DOT_PRODUCT":
            distance_measure_enum = DistanceMeasure.DOT_PRODUCT

        # Convert query_embedding list to Vector object
        query_vector = Vector(query_embedding)

        # Start with base collection reference
        # Add location filter if provided (creates a query with location filter)
        if location:
            # Apply location filter first, then vector search
            filtered_query = checkpoints_ref.where(
                filter=firestore.FieldFilter("location", "==", location)
            )

            # Perform vector search on filtered query
            logger.info(
                "Performing vector search location_filter=%r query_len=%d limit=%d",
                location,
                len(query_text or ""),
                limit,
            )
            vector_query = filtered_query.find_nearest(
                vector_field="embedding",
                query_vector=query_vector,
                limit=limit,
                distance_measure=distance_measure_enum,
                distance_result_field="vector_distance",
            )
        else:
            # Perform vector search on collection (no location filter)
            logger.info(
                "Performing vector search query_len=%d limit=%d",
                len(query_text or ""),
                limit,
            )
            vector_query = checkpoints_ref.find_nearest(
                vector_field="embedding",
                query_vector=query_vector,
                limit=limit,
                distance_measure=distance_measure_enum,
                distance_result_field="vector_distance",
            )

        # Execute vector search query
        logger.info(
            f"Executing vector search query on collection path: users/{user_id}/properties/{property_id}/checkpoints"
        )
        results = vector_query.stream()

        # Convert results to dictionaries with checkpoint data
        checkpoints = []
        result_count = 0
        for doc in results:
            result_count += 1
            logger.debug(f"Processing search result {result_count}: doc_id={doc.id}")
            checkpoint_data = doc.to_dict()
            if checkpoint_data:
                checkpoint_data["id"] = doc.id
                # Extract distance from result and convert to similarity score
                vector_distance = checkpoint_data.get("vector_distance")
                if vector_distance is not None:
                    # For COSINE distance: similarity = 1 - distance (distance is 0-2 for cosine, similarity is -1 to 1)
                    # For EUCLIDEAN: similarity = 1 / (1 + distance) or use distance directly
                    if distance_measure == "COSINE":
                        # Cosine distance: 0 = identical, 2 = opposite
                        # Convert to similarity: 1 = identical, -1 = opposite
                        checkpoint_data["similarity_score"] = 1.0 - vector_distance
                    else:
                        # For other measures, use inverse distance or normalize
                        checkpoint_data["similarity_score"] = (
                            1.0 / (1.0 + vector_distance)
                            if vector_distance > 0
                            else 1.0
                        )

                checkpoints.append(checkpoint_data)
                logger.debug(
                    f"Added checkpoint {result_count}: id={doc.id}, has_aiAnalysis={bool(checkpoint_data.get('aiAnalysis'))}, similarity_score={checkpoint_data.get('similarity_score', 'N/A')}"
                )

        logger.info(
            f"Vector search completed: processed {result_count} results, returning {len(checkpoints)} checkpoints"
        )
        if checkpoints:
            logger.info(
                f"Top checkpoint similarity scores: {[cp.get('similarity_score', 'N/A') for cp in checkpoints[:3]]}"
            )
        return checkpoints

    except Exception as e:
        logger.error(f"Error performing vector search: {e}", exc_info=True)
        return []
