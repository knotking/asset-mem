import logging
import firebase_admin
from firebase_admin import firestore

from utils import parse_pubsub_message
from checkpoint_service import analyze_checkpoint_image

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

        # Add auto-detected room/area if available
        if "detectedRoom" in analysis_result:
            update_data["detectedRoom"] = analysis_result["detectedRoom"]
            update_data["roomConfidence"] = analysis_result.get("roomConfidence", 0.0)
            update_data["roomFeatures"] = analysis_result.get("roomFeatures", [])
            update_data["areaDescription"] = analysis_result.get("areaDescription", "")
            
            # If user didn't provide a location, use the detected one
            if not existing_location:
                update_data["location"] = analysis_result["detectedRoom"]
                logger.info(f"Auto-setting location to detected room: {analysis_result['detectedRoom']}")
            else:
                logger.info(f"Location already set to '{existing_location}', keeping user-provided value")

        checkpoint_ref.update(update_data)

        logger.info(f"Successfully updated checkpoint {checkpoint_id} with analysis results")

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

