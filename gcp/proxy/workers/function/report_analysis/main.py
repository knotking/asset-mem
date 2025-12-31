"""Cloud Function for processing inspection report analysis via Pub/Sub.

This function is triggered by Pub/Sub messages to analyze inspection reports asynchronously.
It calls the report agent, processes the results, and updates Firestore.
"""

import logging
import time
import os
import json
import firebase_admin
from firebase_admin import firestore
from datetime import datetime, timezone

from utils import parse_pubsub_message
from report_service import analyze_inspection_report
from embedding_service import generate_report_embedding

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def pubsub_report_analysis(request, context):
    """
    Background Cloud Function to process inspection report analysis via Pub/Sub.
    
    Workflow:
    1. Parse Pub/Sub message
    2. Call report agent to analyze the report
    3. Generate embedding for semantic search
    4. Update Firestore with results
    
    Args:
        request: Cloud Function request object
        context: Cloud Function context object
    """
    total_start_time = time.time()
    
    try:
        # Parse the Pub/Sub message
        payload = parse_pubsub_message(request)
        
        report_id = payload.get("reportId")
        user_id = payload.get("userId")
        property_id = payload.get("propertyId")
        report_uri = payload.get("reportUri")
        content_type = payload.get("contentType", "application/pdf")
        
        if not all([report_id, user_id, property_id, report_uri]):
            logger.warning(f"Missing required fields in payload: {payload}")
            return
        
        logger.info(f"Processing report analysis: reportId={report_id}, userId={user_id}, propertyId={property_id}")
        
        # Initialize Firebase Admin if not already initialized
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app()
        
        db = firestore.client()
        
        # Get reference to the report document
        report_ref = db.collection("users").document(user_id)\
            .collection("properties").document(property_id)\
            .collection("reports").document(report_id)
        
        try:
            # Update status to analyzing
            report_ref.update({"status": "analyzing"})
            
            # Analyze the inspection report using the report agent
            analysis_start_time = time.time()
            analysis_result = analyze_inspection_report(
                report_uri=report_uri,
                content_type=content_type,
                user_id=user_id,
                property_id=property_id
            )
            analysis_duration_ms = (time.time() - analysis_start_time) * 1000
            
            logger.info(f"Analysis completed in {analysis_duration_ms:.2f}ms")
            
            # Extract and structure the analysis data
            metadata = analysis_result.get("metadata", {})
            issues = analysis_result.get("issues", [])
            recommendations = analysis_result.get("recommendations", [])
            key_findings = analysis_result.get("key_findings", [])
            cost_estimates = analysis_result.get("cost_estimates", {})
            
            # Build the aiAnalysis object
            ai_analysis = {
                "summary": analysis_result.get("summary", "Analysis completed"),
                "overallCondition": analysis_result.get("overall_condition", "fair"),
                "issues": issues,
                "recommendations": recommendations,
                "keyFindings": key_findings,
                "costEstimates": {
                    "immediate": cost_estimates.get("immediate", 0),
                    "shortTerm": cost_estimates.get("short_term", 0),
                    "longTerm": cost_estimates.get("long_term", 0)
                } if cost_estimates else None,
                "analyzedAt": firestore.SERVER_TIMESTAMP,
                "confidence": analysis_result.get("confidence", 0.85)
            }
            
            # Prepare the update data
            update_data = {
                "status": "complete",
                "aiAnalysis": ai_analysis,
                "inspectionDate": metadata.get("inspection_date"),
                "inspectorName": metadata.get("inspector_name"),
                "inspectorCompany": metadata.get("inspector_company"),
                "reportType": metadata.get("report_type", "OTHER")
            }
            
            # Remove None values
            update_data = {k: v for k, v in update_data.items() if v is not None}
            
            # Update the report document with analysis results
            report_ref.update(update_data)
            logger.info(f"Successfully updated report {report_id} with analysis results")
            
            # Generate and store embedding for semantic search
            try:
                embedding = generate_report_embedding(ai_analysis)
                
                if embedding:
                    embedding_update = {
                        "embedding": embedding,
                        "embeddingModel": "text-embedding-004",
                        "embeddingGeneratedAt": firestore.SERVER_TIMESTAMP
                    }
                    report_ref.update(embedding_update)
                    logger.info(f"Successfully generated and stored embedding for report {report_id}")
                else:
                    logger.warning(f"Failed to generate embedding for report {report_id}")
            except Exception as embedding_error:
                # Don't fail the entire process if embedding generation fails
                logger.error(f"Error generating embedding for report {report_id}: {embedding_error}", exc_info=True)
            
            # Update property report count (optional)
            try:
                property_ref = db.collection("users").document(user_id)\
                    .collection("properties").document(property_id)
                
                property_ref.update({
                    "reportsCount": firestore.Increment(1),
                    "reports": firestore.Increment(1)
                })
                logger.info(f"Updated property {property_id} report count")
            except Exception as count_error:
                logger.warning(f"Failed to update property report count: {count_error}")
            
            total_duration_ms = (time.time() - total_start_time) * 1000
            logger.info(f"Report analysis completed successfully in {total_duration_ms:.2f}ms")
            
        except Exception as e:
            total_duration_ms = (time.time() - total_start_time) * 1000
            logger.error(f"Error processing report analysis: {e}", exc_info=True)
            
            # Update Firestore with failed status
            try:
                report_ref.update({
                    "status": "failed"
                })
                logger.info(f"Updated report {report_id} status to failed")
            except Exception as update_error:
                logger.error(f"Failed to update report status to failed: {update_error}", exc_info=True)
            
    except Exception as e:
        logger.error(f"Fatal error in pubsub_report_analysis: {e}", exc_info=True)

