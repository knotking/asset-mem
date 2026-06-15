"""Map token quota exceptions to HTTP responses."""

from __future__ import annotations

from fastapi.responses import JSONResponse

from common.token import TokenQuotaExceeded


def token_quota_exceeded_response(exc: TokenQuotaExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "status": "error",
            "code": "TOKEN_QUOTA_EXCEEDED",
            "message": (
                "Monthly AI token limit reached. Usage resets at the start of next month."
            ),
            "used": exc.used,
            "limit": exc.limit,
            "period": exc.period_key,
        },
    )
