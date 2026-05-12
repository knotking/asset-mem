"""Map plan limit exceptions to HTTP responses."""

from __future__ import annotations

from fastapi.responses import JSONResponse

from common.plan_limits import PlanLimitExceeded


def plan_limit_exceeded_response(exc: PlanLimitExceeded) -> JSONResponse:
    kind_label = "document" if exc.kind == "document" else "checkpoint"
    return JSONResponse(
        status_code=429,
        content={
            "status": "error",
            "code": exc.error_code,
            "message": (
                f"Monthly {kind_label} limit reached ({exc.used} of {exc.limit} "
                f"this UTC month). Upgrade your plan or wait until next month."
            ),
            "used": exc.used,
            "limit": exc.limit,
            "period": exc.period_key,
            "requested": exc.requested,
        },
    )
