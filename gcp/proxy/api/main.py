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

import os
import logging
from typing import Any, Dict, List, Union
import asyncio
from fastapi.responses import StreamingResponse
# from pydantic import BaseModel
from models import AgentRequest


from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger: logging.Logger = logging.getLogger(__name__)


# --- FastAPI App and Webhook ---
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# class FirebaseRequestData(BaseModel):
#     user_id: str
#     user_query: str
#     context_doc_uris: List[str]
#     diagnosis_uris: List[str]
#     session_id: str
#     property_address: str

main_loop = asyncio.get_event_loop()

from gcp_utils import listen_to_event
from telegram_api import get_telegram_webhook_endpoint
from firebase_api import handle_firebase_agent_query, stream_firebase_agent_answers, handle_firebase_file_upload
# Import Vertex AI client logic
from vertex_client import (
    reasoning_engine_resource,
    create_reasoning_engine_session,
    delete_reasoning_engine_session
)
# Register Telegram handlers

TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET")  

FIREBASE_WEBHOOK_SECRET = os.environ.get("FIREBASE_WEBHOOK_SECRET")

@app.get("/health")
async def health_check():
    status_msg = "ok"
    if not reasoning_engine_resource:
        status_msg += " (Reasoning Engine not initialized)"
    return {"status": status_msg}

@app.post(f"/{TELEGRAM_WEBHOOK_SECRET}")
async def telegram_webhook(request: Request):
    return await get_telegram_webhook_endpoint()(request)

async def _extract_firebase_request_data(request: Request) -> AgentRequest:
    data = await request.json()
    user_id = data.get("user_id", "")
    if not user_id:
        logger.error("User ID is required")
        raise ValueError("User ID is required")

    session_id = data.get("session_id", "")
    user_query = data.get("message", "Analyse")
    context_doc_uris = data.get("context_doc_uris", [])
    diagnosis_uris = data.get("diagnosis_uris", [])
    property_address = data.get("property_address", "")
    return AgentRequest(
        user_id=user_id,
        user_query=user_query,
        context_doc_uris=context_doc_uris,
        diagnosis_uris=diagnosis_uris,
        session_id=session_id,
        property_address=property_address,
    )

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-query")
async def firebase_webhook(request: Request):
    logger.info("Firebase querywebhook received a request.")
    try:
        request_data = await _extract_firebase_request_data(request)
        logger.info(f"Firebase query webhook data: {request_data.model_dump_json()}")
        
        return await handle_firebase_agent_query(request_data)
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error processing Firebase webhook: {e}")
        return {"status": "error", "message": str(e)}

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/firebase-agent-stream")
async def firebase_streaming_webhook(request: Request):
    logger.info("Firebase streaming webhook received a request.")
    try:
        request_data = await _extract_firebase_request_data(request)    
        return StreamingResponse(stream_firebase_agent_answers(request_data), media_type="text/event-stream")

    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error processing Firebase streaming webhook: {e}")
        return {"status": "error", "message": str(e)}

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/agent-session")
async def firebase_agent_session_webhook(request: Request):
    logger.info("Firebase agent session webhook received a request.")
    try:
        request_data = await _extract_firebase_request_data(request)
        user_id = request_data.user_id
        logger.info(f"Received session create request from user: {user_id}")
        return create_reasoning_engine_session(user_id)
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error processing Firebase agent session webhook: {e}")
        return {"status": "error", "message": str(e)}

@app.delete(f"/{FIREBASE_WEBHOOK_SECRET}/agent-session")
async def firebase_agent_delete_session_webhook(request: Request):
    logger.info("Firebase agent session webhook received a request.")
    try:
        data = await request.json()
        user_id = data.get("user_id", "")
        session_id = data.get("session_id","")
        logger.info(f"Received session delete request from user: {user_id}, {session_id}")
        delete_reasoning_engine_session(user_id, session_id)
        return {"status": "success", "message": "Deleted Session"}
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error processing Firebase agent session webhook: {e}")
        return {"status": "error", "message": str(e)}

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/rag-file-upload")
async def firebase_webhook_file_upload(request: Request):
    logger.info("Firebase webhook file upload received a request.")
    try:
        request_data = await _extract_firebase_request_data(request)
        logger.info(f"Firebase webhook file upload data: {request_data.model_dump_json()}")
        
        return handle_firebase_file_upload(request_data)
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error processing Firebase webhook: {e}")
        return {"status": "error", "message": str(e)}

async def on_event_user_upload_result(message: str):
    # Define the expected type using pydantic
    from pydantic import BaseModel, Field
    from typing import List, Dict, Any, Union
    import json

    class UserUploadResultEvent(BaseModel):
        user_id: str
        user_query: str
        gcs_urls: List[str]
        success: bool = Field(default=True)
        error: str = Field(default="")
        source: str = Field(default="unknown")
        result: Union[Dict[str, Any], str] = Field(default_factory=dict)

    try:
        event_obj = UserUploadResultEvent.model_validate(json.loads(message))
        logger.info(f"Parsed event: {event_obj}")

    # 2. Edit the "Thinking..." message with the actual answer
    except Exception as e:
        logger.error(f"Failed to parse user upload result event: {e}")
    

        # You can now access event_obj.user_id, event_obj.user_query, event_obj.gcs_urls, event_obj.doc_types
   


import threading
import asyncio

def start_pubsub_listener():
    def sync_callback(message):
        # Schedule the coroutine on the main event loop
        asyncio.run_coroutine_threadsafe(
            on_event_user_upload_result(message),
            main_loop
        )
    listen_to_event(
        os.environ.get("GCP_PROJECT_ID"),
        os.environ.get("USER_UPLOAD_RESULT_SUBSCRIPTION"),
        sync_callback
    )

threading.Thread(target=start_pubsub_listener, daemon=True).start()
