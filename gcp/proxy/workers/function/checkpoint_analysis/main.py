import logging
import uuid
import firebase_admin
from firebase_admin import firestore

from utils import parse_pubsub_message
from checkpoint_service import analyze_checkpoint_image
from comparison_service import (
    find_previous_checkpoint,
    should_compare_checkpoints,
    compare_checkpoints,
    get_user_preferences
)

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def pubsub_checkpoint_analysis(request, context):
    """Background Cloud Function to process checkpoint analysis via Pub/Sub."""
    payload = parse_pubsub_message(request)
    
    checkpoint_id = payload.get("checkpointId")
    user_id = payload.get("userId")
    property_id = payload.get("propertyId")
    image_url = payload.get("imageUrl")
    content_type = payload.get("contentType")
    location = payload.get("location")
    source = payload.get("source", "checkpoint-analysis-api")

    if not checkpoint_id or not user_id or not property_id or not image_url:
        logger.warning(f"Missing required fields in payload: {payload}")
        return

    logger.info(f"Processing checkpoint analysis: checkpointId={checkpoint_id}, userId={user_id}, propertyId={property_id}")

    # Initialize Firebase Admin if not already initialized
    try:
        firebase_admin.get_app()
    except ValueError:
        # Initialize with default credentials (uses GCP service account)
        firebase_admin.initialize_app()

    db = firestore.client()

    try:
        # Analyze the checkpoint image/video using Gemini
        analysis_result = analyze_checkpoint_image(image_url, content_type, location)

        # Update Firestore with analysis results
        checkpoint_ref = db.collection("users").document(user_id)\
            .collection("properties").document(property_id)\
            .collection("checkpoints").document(checkpoint_id)

        # Check if location already exists
        checkpoint_doc = checkpoint_ref.get()
        existing_location = None
        if checkpoint_doc.exists():
            existing_location = checkpoint_doc.to_dict().get("location")

        update_data = {
            "analysisStatus": "completed",
            "aiAnalysis": {
                "summary": analysis_result["summary"],
                "conditions": analysis_result["conditions"],
                "detectedItems": analysis_result["detectedItems"],
                "issues": analysis_result["issues"],
                "aiConfidence": 0.9,
                "analyzedAt": firestore.SERVER_TIMESTAMP,
            }
        }

        # Determine final location (user-provided, detected, or existing)
        final_location = existing_location
        detected_room = analysis_result.get("detectedRoom")
        room_confidence = analysis_result.get("roomConfidence")
        
        if "detectedRoom" in analysis_result:
            update_data["detectedRoom"] = detected_room
            update_data["roomConfidence"] = room_confidence or 0.0
            update_data["roomFeatures"] = analysis_result.get("roomFeatures", [])
            update_data["areaDescription"] = analysis_result.get("areaDescription", "")
            
            # If user didn't provide a location, use the detected one
            if not final_location:
                final_location = detected_room
                update_data["location"] = final_location
                logger.info(f"Auto-setting location to detected room: {detected_room}")
            else:
                logger.info(f"Location already set to '{final_location}', keeping user-provided value")
        
        # Update checkpoint with analysis results first
        checkpoint_ref.update(update_data)
        logger.info(f"Successfully updated checkpoint {checkpoint_id} with analysis results")

        # Attempt automatic comparison with previous checkpoint
        try:
            # Fetch user preferences
            user_preferences = get_user_preferences(db, user_id)
            
            # Find previous checkpoint for the same location
            previous_checkpoint = find_previous_checkpoint(
                db=db,
                user_id=user_id,
                property_id=property_id,
                current_checkpoint_id=checkpoint_id,
                location=final_location,
                detected_room=detected_room,
                max_age_days=None,  # Will use user preference or default
                user_preferences=user_preferences
            )
            
            # Check if we should perform comparison
            checkpoint_doc_after_update = checkpoint_ref.get()
            skip_comparison = False
            if checkpoint_doc_after_update.exists():
                checkpoint_data = checkpoint_doc_after_update.to_dict()
                skip_comparison = checkpoint_data.get("skipComparison", False)
            
            if should_compare_checkpoints(
                previous_checkpoint,
                room_confidence,
                skip_comparison,
                user_preferences
            ):
                # Get media URLs for comparison
                new_checkpoint_media = checkpoint_doc_after_update.to_dict().get("media", [])
                previous_media = previous_checkpoint.get("media", [])
                
                if new_checkpoint_media and previous_media:
                    new_media = new_checkpoint_media[0]
                    prev_media = previous_media[0]
                    
                    new_media_url = new_media.get("gsURI") or new_media.get("url")
                    prev_media_url = prev_media.get("gsURI") or prev_media.get("url")
                    
                    if new_media_url and prev_media_url:
                        logger.info(f"Performing automatic comparison with checkpoint {previous_checkpoint.get('id')}")
                        
                        # Perform comparison
                        comparison_result = compare_checkpoints(
                            image1_url=prev_media_url,
                            image2_url=new_media_url,
                            content_type1=prev_media.get("contentType", "image/jpeg"),
                            content_type2=new_media.get("contentType", "image/jpeg"),
                            location=final_location
                        )
                        
                        # Update checkpoint with comparison results
                        comparison_update = {
                            "visualDiff": {
                                "id": f"diff_{uuid.uuid4().hex[:8]}",
                                "status": "completed",
                                "comparedWithCheckpointId": previous_checkpoint.get("id"),
                                "semanticChanges": comparison_result.get("semanticChanges", []),
                                "regions": [
                                    {
                                        "id": f"region_{i}",
                                        "bbox": region.get("bbox") or {"x": 0, "y": 0, "width": 0, "height": 0},
                                        "changeType": region.get("changeType", "modified"),
                                        "severity": region.get("severity", "minor"),
                                        "confidence": region.get("confidence", 0.5),
                                        "description": region.get("description", ""),
                                        "changePercentage": 0
                                    }
                                    for i, region in enumerate(comparison_result.get("regions", []))
                                ],
                                "similarityScore": comparison_result.get("similarityScore", 1.0),
                                "completedAt": firestore.SERVER_TIMESTAMP
                            }
                        }
                        
                        checkpoint_ref.update(comparison_update)
                        logger.info(f"Successfully updated checkpoint {checkpoint_id} with comparison results")
                    else:
                        logger.warning("Media URLs not available for comparison")
            else:
                logger.info("Skipping automatic comparison (no previous checkpoint or other conditions not met)")
                
        except Exception as comparison_error:
            # Don't fail the entire process if comparison fails
            logger.error(f"Error during automatic comparison: {comparison_error}", exc_info=True)
            # Optionally update checkpoint with comparison failure status
            try:
                checkpoint_ref.update({
                    "visualDiff": {
                        "status": "failed",
                        "id": f"diff_failed"
                    }
                })
            except Exception as update_error:
                logger.error(f"Failed to update comparison failure status: {update_error}")

    except Exception as e:
        logger.error(f"Error processing checkpoint analysis: {e}", exc_info=True)
        
        # Update Firestore with failed status
        try:
            checkpoint_ref = db.collection("users").document(user_id)\
                .collection("properties").document(property_id)\
                .collection("checkpoints").document(checkpoint_id)
            
            checkpoint_ref.update({
                "analysisStatus": "failed"
            })
            logger.info(f"Updated checkpoint {checkpoint_id} status to failed")
        except Exception as update_error:
            logger.error(f"Failed to update checkpoint status to failed: {update_error}", exc_info=True)

