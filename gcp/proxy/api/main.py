# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import sys
from pathlib import Path

# Shared code: `gcp/common` (import `common.*`) and `gcp/agent_framework` (import `agent_framework.*`).
# - Local dev: main.py is gcp/proxy/api/main.py → gcp root is parent.parent.
# - Docker/CI: staged copies live next to main.py (./common, ./agent_framework).
_here = Path(__file__).resolve().parent
for root in (_here.parent.parent, _here):
    if not root:
        continue
    has_common = (root / "common").is_dir()
    has_agent_framework = (root / "agent_framework" / "__init__.py").is_file()
    if (has_common or has_agent_framework) and str(root) not in sys.path:
        sys.path.insert(0, str(root))
        break

import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from common.observability.logging_context import install_auth_uid_logging
from core.firebase_auth_middleware import FirebaseAuthLoggingMiddleware
from core.correlation_middleware import CorrelationIdMiddleware
from core.config import settings
from core.events import lifespan
from routers import agent, documents, telegram, service_broker, checkpoint, token_quota, billing, auth_handoff, stripe_webhook, apple_billing, apple_webhook, deletion, reports
from services.vertex_service import reasoning_engine_resource

# Configure logging (auth uid on every line via ContextVar + Filter).
# PROXY_LOG_LEVEL=DEBUG for verbose third-party logs; default INFO keeps stream_chunk visible.
_proxy_log_level_name = os.environ.get("PROXY_LOG_LEVEL", "INFO").upper()
_proxy_log_level = getattr(logging, _proxy_log_level_name, logging.INFO)
install_auth_uid_logging(level=_proxy_log_level)
logger: logging.Logger = logging.getLogger(__name__)

# --- FastAPI App ---
app = FastAPI(
    title="HomeApp Proxy API",
    description="API for handling HomeApp proxy requests, including Firebase and Telegram webhooks.",
    version="1.0.0",
    lifespan=lifespan
)

logger.info("CORS allow_origins: %s", settings.CORS_ALLOW_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
app.add_middleware(FirebaseAuthLoggingMiddleware)
app.add_middleware(CorrelationIdMiddleware)

@app.get(
    "/health",
    summary="Health / readiness",
    description=(
        "Liveness and readiness. Returns 503 when the Reasoning Engine client is not "
        "initialized (Cloud Run / load balancers should not send traffic)."
    ),
)
async def health_check():
    if not reasoning_engine_resource:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "reason": "reasoning_engine_not_initialized",
                "message": "Vertex AI Reasoning Engine is not available",
            },
        )
    return {"status": "ok", "reasoning_engine": "ready"}

def _mount_user_routers(prefix: str = "") -> None:
    """User-facing routes protected by Firebase ID token (see require_firebase_uid)."""
    app.include_router(agent.router, prefix=prefix)
    app.include_router(documents.router, prefix=prefix)
    app.include_router(checkpoint.router, prefix=prefix)
    app.include_router(token_quota.router, prefix=prefix)
    app.include_router(billing.router, prefix=prefix)
    app.include_router(apple_billing.router, prefix=prefix)
    app.include_router(auth_handoff.router, prefix=prefix)
    app.include_router(deletion.router, prefix=prefix)
    app.include_router(reports.router, prefix=prefix)
    label = prefix or "/"
    logger.info(
        "Mounted agent, documents, checkpoint, token_quota, billing, apple_billing, auth_handoff, deletion, reports at %s (Firebase auth%s)",
        label,
        " disabled" if settings.DISABLE_FIREBASE_AUTH else "",
    )


# Stripe (B2C): webhook must stay on a fixed path for Stripe Dashboard (no Firebase secret prefix).
app.include_router(stripe_webhook.router)
logger.info("Mounted stripe_webhook at /stripe/webhook")

# Apple App Store Server Notifications V2 (fixed path for App Store Connect).
app.include_router(apple_webhook.router)
logger.info("Mounted apple_webhook at /apple/app-store-notifications")

_mount_user_routers()

if settings.FIREBASE_WEBHOOK_SECRET and settings.ENABLE_LEGACY_SECRET_PREFIX:
    legacy = f"/{settings.FIREBASE_WEBHOOK_SECRET}"
    _mount_user_routers(prefix=legacy)
    app.include_router(service_broker.router, prefix=legacy)
    logger.info("Mounted service_broker at %s (legacy prefix)", legacy)
elif settings.FIREBASE_WEBHOOK_SECRET:
    logger.info(
        "FIREBASE_WEBHOOK_SECRET set but ENABLE_LEGACY_SECRET_PREFIX=false; "
        "service_broker not mounted (stub — enable when broker is live)"
    )
else:
    logger.warning(
        "FIREBASE_WEBHOOK_SECRET not set; user routes only at /. "
        "Set DISABLE_FIREBASE_AUTH=true for local dev without Bearer tokens."
    )

# Telegram endpoint
if settings.TELEGRAM_WEBHOOK_SECRET:
    prefix = f"/{settings.TELEGRAM_WEBHOOK_SECRET}"
    app.include_router(telegram.router, prefix=prefix)
    logger.info(f"Mounted telegram router at {prefix}")
else:
    logger.warning("TELEGRAM_WEBHOOK_SECRET not set, telegram endpoint not mounted.")
