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

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from core.events import lifespan
from routers import agent, documents, telegram, service_broker
from vertex_client import reasoning_engine_resource

# Configure logging
logging.basicConfig(level=logging.INFO)
logger: logging.Logger = logging.getLogger(__name__)

# --- FastAPI App ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    status_msg = "ok"
    if not reasoning_engine_resource:
        status_msg += " (Reasoning Engine not initialized)"
    return {"status": status_msg}

# Mount routers
# Firebase / Agent endpoints
if settings.FIREBASE_WEBHOOK_SECRET:
    prefix = f"/{settings.FIREBASE_WEBHOOK_SECRET}"
    app.include_router(agent.router, prefix=prefix)
    app.include_router(documents.router, prefix=prefix)
    app.include_router(service_broker.router, prefix=prefix)
    logger.info(f"Mounted agent, documents, and service_broker routers at {prefix}")
else:
    logger.warning("FIREBASE_WEBHOOK_SECRET not set, agent endpoints not mounted.")

# Telegram endpoint
if settings.TELEGRAM_WEBHOOK_SECRET:
    prefix = f"/{settings.TELEGRAM_WEBHOOK_SECRET}"
    app.include_router(telegram.router, prefix=prefix)
    logger.info(f"Mounted telegram router at {prefix}")
else:
    logger.warning("TELEGRAM_WEBHOOK_SECRET not set, telegram endpoint not mounted.")
