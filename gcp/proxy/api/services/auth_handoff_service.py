"""One-time codes so the mobile app can sign the mobile browser into the same Firebase user on web."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone

from firebase_admin import auth
from google.cloud import firestore
from fastapi import HTTPException

from utils.firebase_auth import ensure_firebase_app

logger = logging.getLogger(__name__)

HANDOFF_COLLECTION = "mobile_web_handoffs"
HANDOFF_TTL_SECONDS = 300
DEFAULT_RETURN_PATH = "/home/settings?tab=billing"


def validate_return_path(path: str) -> str:
    """Restrict redirects to in-app paths (open-redirect safe)."""
    cleaned = (path or "").strip()
    if not cleaned.startswith("/"):
        cleaned = f"/{cleaned}"
    if not cleaned.startswith("/home"):
        raise HTTPException(status_code=400, detail="returnPath must start with /home")
    lowered = cleaned.lower()
    if "//" in cleaned or "://" in lowered or "\n" in cleaned or "\r" in cleaned:
        raise HTTPException(status_code=400, detail="Invalid returnPath")
    return cleaned


def create_mobile_web_handoff(db: firestore.Client, uid: str, return_path: str) -> dict[str, object]:
    safe_path = validate_return_path(return_path)
    code = secrets.token_urlsafe(32)
    ref = db.collection(HANDOFF_COLLECTION).document(code)
    ref.set(
        {
            "uid": uid,
            "returnPath": safe_path,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    )
    return {"code": code, "expiresInSeconds": HANDOFF_TTL_SECONDS}


def consume_mobile_web_handoff(db: firestore.Client, code: str) -> dict[str, str]:
    raw = (code or "").strip()
    if not raw or len(raw) > 256:
        raise HTTPException(status_code=400, detail="Invalid handoff code")

    ref = db.collection(HANDOFF_COLLECTION).document(raw)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=401, detail="Invalid or expired handoff code")

    data = snap.to_dict() or {}
    ref.delete()

    created_at = data.get("createdAt")
    if created_at is not None:
        if hasattr(created_at, "timestamp"):
            created_ts = created_at.timestamp()
        else:
            created_ts = None
        if created_ts is not None:
            age = datetime.now(timezone.utc).timestamp() - created_ts
            if age > HANDOFF_TTL_SECONDS:
                raise HTTPException(status_code=401, detail="Handoff code expired")

    uid = data.get("uid")
    return_path = data.get("returnPath") or DEFAULT_RETURN_PATH
    if not uid or not isinstance(uid, str):
        raise HTTPException(status_code=401, detail="Invalid handoff payload")

    ensure_firebase_app()
    try:
        custom_token = auth.create_custom_token(uid)
    except Exception as e:
        logger.error("create_custom_token failed for %s: %s", uid, e)
        raise HTTPException(status_code=503, detail="Could not issue sign-in token") from e

    token_str = custom_token.decode("utf-8") if isinstance(custom_token, bytes) else str(custom_token)
    return {"customToken": token_str, "returnPath": str(return_path)}
