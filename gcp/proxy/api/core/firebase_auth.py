"""Firebase ID token verification for user-facing proxy routes."""

from __future__ import annotations

import logging
from typing import Annotated, Any, Optional

import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from common.observability.logging_context import bind_auth_uid
from core.config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

_firebase_initialized = False


def ensure_firebase_admin() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return
    try:
        firebase_admin.get_app()
    except ValueError:
        options: dict[str, Any] = {}
        project_id = settings.FIREBASE_PROJECT_ID or settings.GCP_PROJECT_ID
        if project_id:
            options["projectId"] = project_id
        firebase_admin.initialize_app(options=options or None)
    _firebase_initialized = True


def verify_id_token(token: str) -> str:
    """Verify a Firebase ID token and return the uid."""
    ensure_firebase_admin()
    try:
        decoded = firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "TOKEN_EXPIRED",
                "message": "Firebase ID token expired",
            },
        )
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "TOKEN_REVOKED",
                "message": "Firebase ID token revoked",
            },
        )
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "INVALID_TOKEN",
                "message": "Invalid Firebase ID token",
            },
        )
    except Exception:
        logger.exception("Firebase ID token verification failed")
        raise HTTPException(
            status_code=401,
            detail={
                "code": "INVALID_TOKEN",
                "message": "Could not verify Firebase ID token",
            },
        )

    uid = decoded.get("uid") or decoded.get("sub")
    if not uid or not isinstance(uid, str):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "INVALID_TOKEN",
                "message": "Token missing uid",
            },
        )
    return uid


def _uid_from_request_body(request: Request) -> Optional[str]:
    """Best-effort uid from JSON body when auth is disabled (local dev / tests)."""
    uid = getattr(request.state, "body_auth_uid", None)
    if isinstance(uid, str) and uid.strip():
        return uid.strip()
    return None


async def require_firebase_uid(
    request: Request,
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(_bearer)
    ] = None,
) -> str:
    """
    Resolve the authenticated Firebase uid for the request.

    When DISABLE_FIREBASE_AUTH is set, trusts user_id / userId from the JSON body
    (populated by AuthUidLoggingMiddleware on request.state.body_auth_uid).
    """
    if not settings.DISABLE_FIREBASE_AUTH:
        if not credentials or credentials.scheme.lower() != "bearer":
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "UNAUTHORIZED",
                    "message": "Missing Authorization: Bearer <Firebase ID token>",
                },
            )
        if not credentials.credentials:
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "UNAUTHORIZED",
                    "message": "Empty bearer token",
                },
            )
        uid = verify_id_token(credentials.credentials)
    else:
        uid = _uid_from_request_body(request)
        if not uid:
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "UNAUTHORIZED",
                    "message": (
                        "DISABLE_FIREBASE_AUTH is set but no user_id/userId in body"
                    ),
                },
            )

    request.state.auth_uid = uid
    bind_auth_uid(uid)
    return uid


def apply_uid_to_agent_request(model: Any, uid: str) -> None:
    if hasattr(model, "user_id"):
        model.user_id = uid


def apply_uid_to_camel_user_id(model: Any, uid: str) -> None:
    if hasattr(model, "userId"):
        model.userId = uid
