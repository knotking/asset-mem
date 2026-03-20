import logging
import time
import uuid
from datetime import datetime, timezone
import os
import json
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
from embedding_service import generate_checkpoint_embedding
from name_generator import generate_checkpoint_name

# Initialize observability
from common.observability import initialize_observability, checkpoint
from common.observability.constants import (
    FEATURE_CHECKPOINT,
    EVENT_CHECKPOINT_COMPARISON_SKIPPED
)
from common.observability.logging_helper import log_event, log_exception
from common.observability.base import get_tracer
from common.observability.metrics_helper import record_histogram
from common.token import (
    TokenQuotaExceeded,
    check_token_quota_or_raise,
    new_llm_usage_sink,
    persist_firestore_token_totals,
)
from prompt_builder import get_asset_category

from google.cloud import pubsub_v1

# Initialize observability infrastructure once at module load
initialize_observability(enable_tracing=True, enable_metrics=True)

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pub/Sub topic to trigger property metrics aggregation (optional)
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
CHECKPOINT_METRICS_TOPIC = os.environ.get("CHECKPOINT_METRICS_TOPIC")


def _publish_metrics_aggregate_event(user_id: str, property_id: str, checkpoint_id: str, reason: str) -> None:
    if not (GCP_PROJECT_ID and CHECKPOINT_METRICS_TOPIC):
        return
    try:
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(GCP_PROJECT_ID, CHECKPOINT_METRICS_TOPIC)
        payload = {
            "userId": user_id,
            "propertyId": property_id,
            "checkpointId": checkpoint_id,
            "reason": reason,
        }
        publisher.publish(topic_path, json.dumps(payload).encode("utf-8")).result()
    except Exception as e:
        logger.warning(f"Failed to publish checkpoint metrics aggregation event: {e}")

def pubsub_checkpoint_analysis(request, context):
    """Background Cloud Function to process checkpoint analysis via Pub/Sub."""
    total_start_time = time.time()
    
    # Create a trace span for the entire function
    tracer = get_tracer(__name__)
    with tracer.start_as_current_span("pubsub_checkpoint_analysis") as span:
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

        # Set span attributes
        span.set_attribute("checkpoint_id", checkpoint_id)
        span.set_attribute("user_id", user_id)
        span.set_attribute("property_id", property_id)

        logger.info(f"Processing checkpoint analysis: checkpointId={checkpoint_id}, userId={user_id}, propertyId={property_id}")

        # Initialize Firebase Admin if not already initialized
        try:
            firebase_admin.get_app()
        except ValueError:
            # Initialize with default credentials (uses GCP service account)
            firebase_admin.initialize_app()

        db = firestore.client()
        llm_usage = new_llm_usage_sink()
        checkpoint_ref = (
            db.collection("users")
            .document(user_id)
            .collection("properties")
            .document(property_id)
            .collection("checkpoints")
            .document(checkpoint_id)
        )

        try:
            check_token_quota_or_raise(db, user_id)
        except TokenQuotaExceeded as e:
            logger.warning(
                "Checkpoint analysis skipped: token quota exceeded user=%s period=%s used=%s limit=%s",
                user_id,
                e.period_key,
                e.used,
                e.limit,
            )
            try:
                checkpoint_ref.update(
                    {
                        "analysisStatus": "failed",
                        "analysisQuotaExceeded": True,
                        "analysisQuotaPeriod": e.period_key,
                        "analysisQuotaUsed": e.used,
                        "analysisQuotaLimit": e.limit,
                    }
                )
            except Exception as upd_err:
                logger.error(
                    "Failed to mark checkpoint quota failure: %s", upd_err, exc_info=True
                )
            return

        try:
            # Analyze the checkpoint image/video using Gemini
            analysis_start_time = time.time()
            analysis_result = analyze_checkpoint_image(
                image_url, content_type, location, usage_sink=llm_usage
            )
            analysis_duration_ms = (time.time() - analysis_start_time) * 1000

            # Update Firestore with analysis results
            # Check if location already exists
            checkpoint_doc = checkpoint_ref.get()
            existing_location = None
            existing_name = None
            if checkpoint_doc.exists:
                existing = checkpoint_doc.to_dict() or {}
                existing_location = existing.get("location")
                existing_name = existing.get("name")

            # Extract condition and damage scores from analysis result
            condition_scores = analysis_result.get("condition_scores", {})
            damage_scores = analysis_result.get("damage_scores", {})
            cost_estimates = analysis_result.get("cost_estimates", {})
            issues = analysis_result.get("issues", [])
            
            # Convert issues to severity-based counts
            issues_by_severity = {"critical": 0, "major": 0, "moderate": 0, "minor": 0}
            for issue in issues:
                if isinstance(issue, dict):
                    severity = issue.get("severity", "minor")
                    issues_by_severity[severity] = issues_by_severity.get(severity, 0) + 1
                else:
                    # Legacy format - default to minor
                    issues_by_severity["minor"] += 1
            
            # Build issues list for Firestore (keep structured format with severity)
            issues_for_firestore = issues
            
            update_data = {
                "analysisStatus": "completed",
                "aiAnalysis": {
                    "summary": analysis_result["summary"],
                    "conditions": analysis_result["conditions"],
                    "detectedItems": analysis_result["detectedItems"],
                    "issues": issues_for_firestore,  # Now includes severity
                    "condition_scores": condition_scores,
                    "damage_scores": damage_scores,
                    "cost_estimates": cost_estimates,
                    "issues_by_severity": issues_by_severity,
                    "aiConfidence": 0.9,
                    "analyzedAt": firestore.SERVER_TIMESTAMP,
                }
            }

            # Determine final location (user-provided, detected, or existing)
            final_location = existing_location
            detected_asset = analysis_result.get("detectedAsset")
            asset_confidence = analysis_result.get("assetConfidence", 0.0)
            
            # Determine asset category (infer from location/asset since it's not in analysis_result)
            asset_category = get_asset_category(final_location or detected_asset)
            
            if "detectedAsset" in analysis_result:
                update_data["aiAnalysis"]["detectedAsset"] = detected_asset
                update_data["aiAnalysis"]["assetConfidence"] = asset_confidence
                update_data["aiAnalysis"]["assetFeatures"] = analysis_result.get("assetFeatures", [])
                update_data["aiAnalysis"]["areaDescription"] = analysis_result.get("areaDescription", "")
                
                # If user didn't provide a location, use the detected one
                if not final_location:
                    final_location = detected_asset
                    update_data["location"] = final_location
                    logger.info(f"Auto-setting location to detected asset: {detected_asset}")
                else:
                    logger.info(f"Location already set to '{final_location}', keeping user-provided value")

            # Auto-generate an intelligent checkpoint name only if name is missing/blank
            # If a checkpoint has been named previously (by user, default app naming, or AI), preserve that name
            # This includes default names like "checkpoint + UTC datetime" that apps may set initially
            should_rename = not (isinstance(existing_name, str) and existing_name.strip())

            if should_rename:
                auto_name = generate_checkpoint_name(
                    analysis_result=analysis_result,
                    location=final_location,
                    detected_asset=detected_asset
                )
                update_data["name"] = auto_name
                logger.info(f"AI-generated checkpoint name: {auto_name}")
            else:
                logger.info(f"Keeping existing checkpoint name: {existing_name}")
            
            # Update checkpoint with analysis results first
            checkpoint_ref.update(update_data)
            logger.info(f"Successfully updated checkpoint {checkpoint_id} with analysis results")

            # Generate and store embedding for semantic search (Firestore Vector Search)
            try:
                # Fetch the updated checkpoint data for embedding generation
                updated_checkpoint_doc = checkpoint_ref.get()
                if updated_checkpoint_doc.exists:
                    checkpoint_dict = updated_checkpoint_doc.to_dict()
                    
                    # Generate embedding from checkpoint analysis text
                    embedding = generate_checkpoint_embedding(
                        checkpoint_dict, usage_sink=llm_usage
                    )
                    
                    if embedding:
                        # Update checkpoint with embedding
                        embedding_update = {
                            "embedding": embedding,
                            "embeddingModel": "text-embedding-004",
                            "embeddingGeneratedAt": firestore.SERVER_TIMESTAMP
                        }
                        checkpoint_ref.update(embedding_update)
                        logger.info(f"Successfully generated and stored embedding for checkpoint {checkpoint_id}")
                    else:
                        logger.warning(f"Failed to generate embedding for checkpoint {checkpoint_id}, continuing without embedding")
                else:
                    logger.warning(f"Checkpoint document not found after analysis update, skipping embedding generation")
            except Exception as embedding_error:
                # Don't fail the entire process if embedding generation fails
                logger.error(f"Error generating embedding for checkpoint {checkpoint_id}: {embedding_error}", exc_info=True)

            # Trigger async metrics aggregation for the property (mobile analytics)
            _publish_metrics_aggregate_event(
                user_id=user_id,
                property_id=property_id,
                checkpoint_id=checkpoint_id,
                reason="checkpoint.analysis.completed",
            )
            
            # Determine media type
            media_type = "video" if content_type and content_type.startswith("video/") else "image"
            
            # Log analysis completion using observability module
            checkpoint.log_analysis_completed(
                checkpoint_id=checkpoint_id,
                user_id=user_id,
                property_id=property_id,
                duration_ms=analysis_duration_ms,
                detected_asset=detected_asset,
                asset_category=asset_category,
                condition_scores=condition_scores if condition_scores else None,
                damage_scores=damage_scores if damage_scores else None,
                issues_count=len(issues),
                location=final_location,
                media_type=media_type,
                content_type=content_type
            )
            
            # Record metrics
            attributes = {
                "user_id": user_id,
                "property_id": property_id,
                "checkpoint_id": checkpoint_id
            }
            if detected_asset:
                attributes["location"] = detected_asset
            
            # Record analysis duration metric
            record_histogram(
                "checkpoint.analysis.duration_ms",
                analysis_duration_ms,
                attributes,
                description="Checkpoint analysis duration in milliseconds",
                unit="ms"
            )
            
            # Record condition scores if available
            if condition_scores:
                for component, score in condition_scores.items():
                    checkpoint.record_condition_score(component, score, attributes)
            
            # Record damage scores if available
            if damage_scores:
                for damage_type, score in damage_scores.items():
                    checkpoint.record_damage_score(damage_type, score, attributes)
            
            # Record cost estimates if available
            if cost_estimates:
                if cost_estimates.get("repairs_immediate", 0) > 0:
                    checkpoint.record_cost_estimate(
                        "repairs_immediate",
                        cost_estimates["repairs_immediate"],
                        attributes
                    )
                if cost_estimates.get("maintenance_annual", 0) > 0:
                    checkpoint.record_cost_estimate(
                        "maintenance_annual",
                        cost_estimates["maintenance_annual"],
                        attributes
                    )
            
            # Record issue counts by severity
            for severity, count in issues_by_severity.items():
                if count > 0:
                    checkpoint.record_issue_count(severity, count, attributes)

            # Attempt automatic comparison with previous checkpoint
            comparison_start_time = time.time()
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
                    detected_asset=detected_asset,
                    max_age_days=None,  # Will use user preference or default
                    user_preferences=user_preferences
                )
                
                # Check if we should perform comparison
                checkpoint_doc_after_update = checkpoint_ref.get()
                skip_comparison = False
                if checkpoint_doc_after_update.exists:
                    checkpoint_data = checkpoint_doc_after_update.to_dict()
                    skip_comparison = checkpoint_data.get("skipComparison", False)
                
                should_compare = should_compare_checkpoints(
                    previous_checkpoint,
                    asset_confidence,
                    skip_comparison,
                    user_preferences
                )
                
                if should_compare:
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
                                location=final_location,
                                usage_sink=llm_usage,
                            )
                            
                            comparison_duration_ms = (time.time() - comparison_start_time) * 1000
                            previous_checkpoint_id = previous_checkpoint.get("id")
                            
                            # Update checkpoint with comparison results
                            comparison_update = {
                                "visualDiff": {
                                    "id": f"diff_{uuid.uuid4().hex[:8]}",
                                    "status": "completed",
                                    "comparedWithCheckpointId": previous_checkpoint_id,
                                    "summary": comparison_result.get("summary", ""),
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

                            # Trigger async metrics aggregation after comparison as well (deterioration trends, etc.)
                            _publish_metrics_aggregate_event(
                                user_id=user_id,
                                property_id=property_id,
                                checkpoint_id=checkpoint_id,
                                reason="checkpoint.comparison.completed",
                            )
                            
                            # Log comparison completion
                            checkpoint.log_comparison_completed(
                                checkpoint_id=checkpoint_id,
                                user_id=user_id,
                                property_id=property_id,
                                compared_with_checkpoint_id=previous_checkpoint_id,
                                duration_ms=comparison_duration_ms,
                                similarity_score=comparison_result.get("similarityScore", 1.0),
                                semantic_changes_count=len(comparison_result.get("semanticChanges", []))
                            )
                            
                            # Record comparison duration metric
                            record_histogram(
                                "checkpoint.comparison.duration_ms",
                                comparison_duration_ms,
                                attributes,
                                description="Checkpoint comparison duration in milliseconds",
                                unit="ms"
                            )
                            
                            # Calculate and record deterioration rate if we have condition scores
                            previous_condition_scores = previous_checkpoint.get("aiAnalysis", {}).get("condition_scores", {})
                            if previous_condition_scores and condition_scores:
                                previous_overall = previous_condition_scores.get("overall")
                                current_overall = condition_scores.get("overall")
                                if previous_overall is not None and current_overall is not None:
                                    # Get timestamp from previous checkpoint
                                    previous_created_at = previous_checkpoint.get("createdAt")
                                    if previous_created_at:
                                        # Firestore timestamp - convert to datetime
                                        if hasattr(previous_created_at, 'timestamp'):
                                            previous_time = datetime.fromtimestamp(previous_created_at.timestamp(), tz=timezone.utc)
                                        elif isinstance(previous_created_at, datetime):
                                            previous_time = previous_created_at if previous_created_at.tzinfo else previous_created_at.replace(tzinfo=timezone.utc)
                                        else:
                                            previous_time = datetime.now(timezone.utc)
                                        
                                        current_time = datetime.now(timezone.utc)
                                        days_diff = (current_time - previous_time).days
                                        if days_diff > 0:
                                            # Positive rate means deterioration (score decreased), negative means improvement
                                            rate = (previous_overall - current_overall) / days_diff
                                            record_histogram(
                                                "checkpoint.deterioration.rate",
                                                rate,
                                                attributes,
                                                description="Condition deterioration rate (positive = deteriorating, negative = improving) in condition points per day",
                                                unit="1/day"
                                            )
                        else:
                            # Log comparison skipped due to missing media URLs
                            log_event(
                                EVENT_CHECKPOINT_COMPARISON_SKIPPED,
                                {
                                    "checkpoint_id": checkpoint_id,
                                    "user_id": user_id,
                                    "property_id": property_id,
                                    "skip_reason": "missing_media_urls"
                                },
                                severity="INFO"
                            )
                    else:
                        # Log comparison skipped due to missing media
                        log_event(
                            EVENT_CHECKPOINT_COMPARISON_SKIPPED,
                            {
                                "checkpoint_id": checkpoint_id,
                                "user_id": user_id,
                                "property_id": property_id,
                                "skip_reason": "missing_media"
                            },
                            severity="INFO"
                        )
                else:
                    # Determine skip reason for logging
                    skip_reason = "unknown"
                    if not previous_checkpoint:
                        skip_reason = "no_previous_checkpoint"
                    elif skip_comparison:
                        skip_reason = "checkpoint_flag"
                    elif asset_confidence is not None:
                        comparison_prefs = user_preferences.get("checkpointComparison", {}) if user_preferences else {}
                        min_confidence = comparison_prefs.get("minAssetConfidence", 0.3)
                        if asset_confidence < min_confidence:
                            skip_reason = "low_confidence"
                    elif user_preferences:
                        comparison_prefs = user_preferences.get("checkpointComparison", {})
                        if not comparison_prefs.get("enabled", True):
                            skip_reason = "user_disabled"
                    
                    # Log comparison skipped
                    log_event(
                        EVENT_CHECKPOINT_COMPARISON_SKIPPED,
                        {
                            "checkpoint_id": checkpoint_id,
                            "user_id": user_id,
                            "property_id": property_id,
                            "skip_reason": skip_reason,
                            "preferences": user_preferences.get("checkpointComparison", {}) if user_preferences else {}
                        },
                        severity="INFO"
                    )
                    logger.info(f"Skipping automatic comparison: {skip_reason}")
                
            except Exception as comparison_error:
                    # Don't fail the entire process if comparison fails
                    logger.error(f"Error during automatic comparison: {comparison_error}", exc_info=True)
                    
                    # Log comparison failure
                    log_event(
                        "checkpoint.comparison.failed",
                        {
                            "checkpoint_id": checkpoint_id,
                            "user_id": user_id,
                            "property_id": property_id,
                            "error": {
                                "message": str(comparison_error),
                                "code": "COMPARISON_FAILED"
                            }
                        },
                        severity="ERROR"
                    )
                    
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
            total_duration_ms = (time.time() - total_start_time) * 1000
            logger.error(f"Error processing checkpoint analysis: {e}", exc_info=True)
            
            # Log analysis failure using observability module
            log_exception(
                feature=FEATURE_CHECKPOINT,
                user_id=user_id,
                exception=e,
                error_code="ANALYSIS_FAILED",
                additional_data={
                    "checkpoint_id": checkpoint_id,
                    "property_id": property_id,
                    "duration_ms": total_duration_ms
                }
            )
            
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

        finally:
            persist_firestore_token_totals(
                user_id,
                llm_usage,
                worker_llm_call_increment=llm_usage.get("gemini_calls", 0),
            )

