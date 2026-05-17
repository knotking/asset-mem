import json
import logging
import os
import time
from typing import Any, Dict

import firebase_admin
from firebase_admin import firestore
from google.cloud import pubsub_v1

from utils import parse_pubsub_message
from metrics_aggregator import aggregate_property_metrics

logging.basicConfig(level=logging.INFO)
from common.observability.logging_context import install_auth_uid_logging_if_needed
from common.observability.pubsub_context import worker_request_scope

install_auth_uid_logging_if_needed()
logger = logging.getLogger(__name__)


GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID")

# Optional: publish a status event after aggregation
CHECKPOINT_METRICS_RESULT_TOPIC = os.environ.get("CHECKPOINT_METRICS_RESULT_TOPIC")


def _publish_result(payload: Dict[str, Any]) -> None:
    if not (GCP_PROJECT_ID and CHECKPOINT_METRICS_RESULT_TOPIC):
        return
    try:
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(GCP_PROJECT_ID, CHECKPOINT_METRICS_RESULT_TOPIC)
        publisher.publish(topic_path, json.dumps(payload).encode("utf-8")).result()
    except Exception as e:
        logger.warning(
            "Failed to publish checkpoint metrics result: %s",
            e,
            exc_info=True,
        )


def pubsub_checkpoint_metrics_aggregate(request, context):
    """
    Pub/Sub-triggered worker to aggregate checkpoint analysis into a property metrics doc.

    Expected payload:
      - userId
      - propertyId
      - (optional) checkpointId
      - (optional) reason
    """
    start = time.time()
    payload = parse_pubsub_message(request)

    user_id = payload.get("userId")
    property_id = payload.get("propertyId")
    checkpoint_id = payload.get("checkpointId")
    reason = payload.get("reason", "checkpoint.analysis.completed")

    if not user_id or not property_id:
        logger.warning(f"Missing userId/propertyId in payload: {payload}")
        return

    logger.debug(
        "checkpoint_metrics aggregate start checkpointId=%s reason=%s",
        checkpoint_id,
        reason,
    )

    with worker_request_scope(payload):
        # Initialize Firebase Admin if not already initialized
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app()

        db = firestore.client()
        try:
            metrics = aggregate_property_metrics(db=db, user_id=user_id, property_id=property_id)
            duration_ms = (time.time() - start) * 1000
            logger.info(
                f"Aggregated metrics for user={user_id} property={property_id} (checkpoint={checkpoint_id}) in {duration_ms:.1f}ms"
            )
            _publish_result(
                {
                    "status": "ok",
                    "userId": user_id,
                    "propertyId": property_id,
                    "checkpointId": checkpoint_id,
                    "reason": reason,
                    "durationMs": duration_ms,
                }
            )
            return metrics
        except Exception as e:
            duration_ms = (time.time() - start) * 1000
            logger.error(f"Failed to aggregate metrics: {e}", exc_info=True)
            _publish_result(
                {
                    "status": "error",
                    "userId": user_id,
                    "propertyId": property_id,
                    "checkpointId": checkpoint_id,
                    "reason": reason,
                    "durationMs": duration_ms,
                    "error": str(e),
                }
            )
            raise


