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

# Shared code lives in `gcp/common` (import as `common.*`).
# - Local dev: main.py is gcp/proxy/api/main.py → gcp root is parent.parent.
# - Docker: COPY common next to main.py → gcp root is the app dir.
_here = Path(__file__).resolve().parent
for root in (_here.parent.parent, _here):
    if root and (root / "common").is_dir() and str(root) not in sys.path:
        sys.path.insert(0, str(root))
        break

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from common.observability.logging_context import install_auth_uid_logging
from core.auth_uid_middleware import AuthUidLoggingMiddleware
from core.config import settings
from core.events import lifespan
from routers import agent, documents, telegram, service_broker, checkpoint, token_quota
from services.vertex_service import reasoning_engine_resource

# Configure logging (auth uid on every line via ContextVar + Filter)
install_auth_uid_logging(level=logging.INFO)
logger: logging.Logger = logging.getLogger(__name__)

# --- FastAPI App ---
app = FastAPI(
    title="HomeApp Proxy API",
    description="API for handling HomeApp proxy requests, including Firebase and Telegram webhooks.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(AuthUidLoggingMiddleware)

@app.get("/health", summary="Health Check", description="Check the health status of the API and Reasoning Engine connection.")
async def health_check():
    status_msg = "ok"
    if not reasoning_engine_resource:
        status_msg += " (Reasoning Engine not initialized)"
    return {"status": status_msg}

# Token quota UI: always at POST /token-quota-status (works when FIREBASE_WEBHOOK_SECRET is unset for local dev).
app.include_router(token_quota.router)
logger.info("Mounted token_quota at /token-quota-status")

# Mount routers
# Firebase / Agent endpoints
if settings.FIREBASE_WEBHOOK_SECRET:
    prefix = f"/{settings.FIREBASE_WEBHOOK_SECRET}"
    app.include_router(agent.router, prefix=prefix)
    app.include_router(documents.router, prefix=prefix)
    app.include_router(service_broker.router, prefix=prefix)
    app.include_router(checkpoint.router, prefix=prefix)
    app.include_router(token_quota.router, prefix=prefix)
    logger.info(
        f"Mounted agent, documents, service_broker, checkpoint, and token_quota routers at {prefix}"
    )
else:
    logger.warning("FIREBASE_WEBHOOK_SECRET not set, agent endpoints not mounted.")

# Telegram endpoint
if settings.TELEGRAM_WEBHOOK_SECRET:
    prefix = f"/{settings.TELEGRAM_WEBHOOK_SECRET}"
    app.include_router(telegram.router, prefix=prefix)
    logger.info(f"Mounted telegram router at {prefix}")
else:
    logger.warning("TELEGRAM_WEBHOOK_SECRET not set, telegram endpoint not mounted.")
