"""Firebase ID token verification for unprefixed proxy routes (e.g. B2C billing)."""

from __future__ import annotations

import logging

import firebase_admin
from firebase_admin import auth
from fastapi import Header, HTTPException

logger = logging.getLogger(__name__)


def ensure_firebase_app() -> None:
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app()


def verify_bearer_uid(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")
    ensure_firebase_app()
    try:
        decoded = auth.verify_id_token(token)
        uid = decoded.get("uid")
        if not uid:
            raise HTTPException(status_code=401, detail="Token missing uid")
        return str(uid)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("verify_id_token failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token") from e


async def firebase_uid_from_header(authorization: str | None = Header(None)) -> str:
    return verify_bearer_uid(authorization)
