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
import asyncio
import threading
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import route registration
from routes import register_routes

# Import event handling
from events import start_pubsub_listener

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger: logging.Logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    loop = asyncio.get_running_loop()
    app.state.main_loop = loop
    
    # Start the listener in a background thread, passing the main loop
    logger.info("Starting PubSub listener thread...")
    listener_thread = threading.Thread(target=start_pubsub_listener, args=(loop,), daemon=True)
    listener_thread.start()
    
    yield
    
    # Shutdown
    # (Optional: Add logic to stop the listener if needed, though daemon thread dies with process)
    logger.info("Shutting down...")

# --- FastAPI App Setup ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Register all routes
register_routes(app)
