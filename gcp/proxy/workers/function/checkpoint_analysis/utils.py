import logging
import base64
import json
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

from firebase_admin import firestore

logger = logging.getLogger(__name__)

ANALYSIS_JOB_LEASE_SECONDS = 900


def checkpoint_timestamp_to_datetime(created_at: Any) -> Optional[datetime]:
    if hasattr(created_at, "to_datetime"):
        dt = created_at.to_datetime()
    elif hasattr(created_at, "seconds"):
        dt = datetime.fromtimestamp(created_at.seconds, tz=timezone.utc)
    elif isinstance(created_at, datetime):
        dt = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    else:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def try_claim_checkpoint_analysis(
    checkpoint_ref: Any,
    checkpoint_id: str,
    job_id: str,
) -> Tuple[str, Optional[dict]]:
    """
    Claim a checkpoint analysis job (idempotent under Pub/Sub redelivery).

    Returns (action, existing_data) where action is one of:
      claimed | skip_completed | skip_in_flight | skip_missing
    """
    snap = checkpoint_ref.get()
    if not snap.exists:
        logger.warning("Checkpoint not found, aborting: %s", checkpoint_id)
        return "skip_missing", None

    data = snap.to_dict() or {}
    status = data.get("analysisStatus")

    if status == "completed":
        logger.info(
            "checkpoint_analysis skip: already completed checkpointId=%s",
            checkpoint_id,
        )
        return "skip_completed", data

    if status == "processing":
        started_dt = checkpoint_timestamp_to_datetime(data.get("analysisJobStartedAt"))
        if started_dt is not None:
            age_s = (datetime.now(timezone.utc) - started_dt).total_seconds()
            if age_s < ANALYSIS_JOB_LEASE_SECONDS:
                logger.info(
                    "checkpoint_analysis skip: in-flight job checkpointId=%s jobId=%s age_s=%.0f",
                    checkpoint_id,
                    data.get("analysisJobId"),
                    age_s,
                )
                return "skip_in_flight", data

    checkpoint_ref.update(
        {
            "analysisStatus": "processing",
            "analysisJobId": job_id,
            "analysisJobStartedAt": firestore.SERVER_TIMESTAMP,
        }
    )
    return "claimed", data


def resolve_user_preferences_from_payload(
    payload: dict,
    db: Any,
    user_id: str,
    *,
    get_user_preferences: Any,
) -> Optional[dict]:
    """
    Prefer comparison prefs from the Pub/Sub payload (set by the proxy at enqueue).
    Fall back to Firestore for older messages or non-API sources.
    """
    comparison = payload.get("checkpointComparison")
    if isinstance(comparison, dict):
        return {"checkpointComparison": comparison}
    return get_user_preferences(db, user_id)

def parse_pubsub_message(request) -> dict:
    """
    Extracts and decodes the JSON payload from a Pub/Sub request.
    Returns an empty dict if decoding fails or no data is present.
    """
    if 'data' not in request:
        return {}
    
    try:
        return json.loads(base64.b64decode(request['data']).decode('utf-8'))
    except Exception as e:
        logger.error(f"Failed to decode payload: {e}")
        return {}

