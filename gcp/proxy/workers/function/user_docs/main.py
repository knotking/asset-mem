import json
import logging
import time
from datetime import datetime, timezone
from google.cloud import pubsub_v1

from config import Config
from rag_service import RagService
from utils import parse_pubsub_message
from exceptions import WorkerError

try:
    import firebase_admin
    from firebase_admin import firestore as admin_firestore
except ImportError:
    firebase_admin = None  # type: ignore
    admin_firestore = None  # type: ignore

from common.plan_limits import PlanLimitExceeded, check_monthly_document_creations_allowed

# Setup logger
logging.basicConfig(level=logging.INFO)
from common.observability.logging_context import install_auth_uid_logging_if_needed
from common.observability.pubsub_context import worker_request_scope

install_auth_uid_logging_if_needed()
logger = logging.getLogger(__name__)

def pubsub_to_user_docs(request, context):
    """Background Cloud Function to be triggered by Pub/Sub."""
    payload = parse_pubsub_message(request)
    
    gcs_urls = payload.get("gcs_urls", [])
    user_id = payload.get("user_id")
    user_query = payload.get("user_query", "")
    source = payload.get("source", "unknown")

    if not user_id or not gcs_urls:
        logger.warning("No user_id or gcs_urls in payload, skipping.")
        return

    with worker_request_scope(payload):
        t0 = time.monotonic()
        logger.info(
            "user_docs worker start gcs_urls=%d user_query_len=%d source=%s",
            len(gcs_urls),
            len(user_query or ""),
            source,
        )
        logger.debug(
            "user_docs worker gcs_urls_preview=%r user_query_preview=%r",
            gcs_urls[:15],
            (user_query or "")[:400],
        )

        success = False
        result_msg = ""

        try:
            if admin_firestore is not None:
                try:
                    firebase_admin.get_app()
                except ValueError:
                    firebase_admin.initialize_app()
                db = admin_firestore.client()
                check_monthly_document_creations_allowed(db, user_id, len(gcs_urls))
            rag_service = RagService()
            result_msg = rag_service.import_files(gcs_urls, user_id)
            success = True
        except PlanLimitExceeded as e:
            logger.warning(
                "user_docs skipped: document creation limit user=%s period=%s used=%s limit=%s",
                user_id,
                e.period_key,
                e.used,
                e.limit,
            )
            result_msg = (
                f"Monthly document limit reached ({e.used} of {e.limit} this UTC month)."
            )
            success = False
        except WorkerError as e:
            logger.warning("user_docs WorkerError: %s", e)
            result_msg = str(e)
        except Exception as e:
            logger.exception("user_docs unexpected error: %s", e)
            result_msg = f"Unexpected error: {str(e)}"

        result_preview = str(result_msg) if result_msg is not None else ""
        logger.info(
            "user_docs import outcome success=%s result_len=%d",
            success,
            len(result_preview),
        )
        logger.debug("user_docs result_preview=%r", result_preview[:800])

        data = {
            "gcs_urls": gcs_urls,
            "user_id": user_id,
            "user_query": user_query,
            "result": result_msg,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "success": success,
            "error": "" if success else str(result_msg),
            "source": source,
        }

        _publish_result(data)
        logger.info(
            "user_docs worker done duration_ms=%d success=%s gcs_urls=%d",
            int((time.monotonic() - t0) * 1000),
            success,
            len(gcs_urls),
        )

def _publish_result(data):
    """Publishes the result to the configured Pub/Sub topic."""
    try:
        if Config.USER_UPLOAD_RESULT_TOPIC:
            publisher = pubsub_v1.PublisherClient()
            future = publisher.publish(topic=Config.USER_UPLOAD_RESULT_TOPIC, data=json.dumps(data).encode("utf-8"))
            logger.info(f"Published result to Pub/Sub topic {Config.USER_UPLOAD_RESULT_TOPIC}: {future.result()}")
        else:
            logger.warning("USER_UPLOAD_RESULT_TOPIC not set, skipping publish.")
    except Exception as e:
        logger.exception("Failed to publish to Pub/Sub topic: %s", e)

