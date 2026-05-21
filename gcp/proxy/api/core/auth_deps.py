"""Combined Firebase auth + per-UID rate limit dependencies."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.firebase_auth import require_firebase_uid
from core.rate_limit import enforce_rate_limit

_bearer = HTTPBearer(auto_error=False)

# Rate-limit buckets (map to PROXY_RATE_LIMIT_* env vars in config).
RATE_BUCKET_AGENT = "agent"
RATE_BUCKET_CHECKPOINT = "checkpoint"
RATE_BUCKET_DOCUMENTS = "documents"
RATE_BUCKET_QUOTA = "quota"


def authenticated_user(bucket: str):
    """FastAPI dependency: verify Firebase uid, then enforce per-UID rate limit."""

    async def _dependency(
        request: Request,
        credentials: Annotated[
            Optional[HTTPAuthorizationCredentials], Depends(_bearer)
        ] = None,
    ) -> str:
        uid = await require_firebase_uid(request, credentials)
        enforce_rate_limit(uid, bucket)
        return uid

    return _dependency
