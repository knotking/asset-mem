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
from models import (
    AgentRequest,
    ExtractDocInfoRequest,
    CreateFileSearchStoreRequest,
    UploadFileToStoreRequest,
    ImportGCSFileRequest,
    FileSearchQueryRequest,
    DeleteStoreRequest,
    OperationStatusRequest,
    UserFileUploadRequest,
    UserGCSImportRequest,
    UserQueryRequest,
)
from optional_agents import (
    ANALYSIS_OPTIONAL_AGENT_ORDER,
    normalize_analysis_optional_agents,
)


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
# Import document analysis
from document_analysis import extract_doc_info
# Import Gemini File Search
from gemini_file_search import get_file_search_manager
# Register Telegram handlers

TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET")  

FIREBASE_WEBHOOK_SECRET = os.environ.get("FIREBASE_WEBHOOK_SECRET")

@app.get("/health")
async def health_check():
    status_msg = "ok"
    if not reasoning_engine_resource:
        status_msg += " (Reasoning Engine not initialized)"
    
    # Check Gemini API key
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    if gemini_api_key:
        status_msg += " (Gemini File Search available)"
    
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
    user_query = data.get("user_query", "Analyse")
    context_doc_uris = data.get("context_doc_uris", [])
    diagnosis_uris = data.get("diagnosis_uris", [])
    property_address = data.get("property_address", "")
    analysis_optional_agents = normalize_analysis_optional_agents(data.get("analysis_optional_agents"))
    return AgentRequest(
        user_id=user_id,
        user_query=user_query,
        context_doc_uris=context_doc_uris,
        diagnosis_uris=diagnosis_uris,
        session_id=session_id,
        property_address=property_address,
        analysis_optional_agents=analysis_optional_agents,
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

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/extract-doc-info")
async def extract_document_info(request: Request):
    """
    Extract structured information from property documents using Gemini AI.

    This endpoint analyzes documents and extracts:
    - Document type (DEED, INSURANCE_POLICY, etc.)
    - Property address (normalized)
    - Key entities (policy numbers, dates, amounts)
    - Summary

    Request body:
    {
        "docUrl": "https://storage.googleapis.com/.../document.pdf",
        "contentType": "application/pdf"
    }
    """
    logger.info("Document analysis endpoint received a request.")
    try:
        data = await request.json()
        doc_request = ExtractDocInfoRequest(**data)
        logger.info(f"Analyzing document: {doc_request.docUrl}")

        result = extract_doc_info(doc_request)

        logger.info(f"Analysis complete: {result.documentType.value}")
        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error processing document analysis: {e}")
        return {"status": "error", "message": str(e)}

# Gemini File Search Endpoints

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/create-store")
async def create_file_search_store(request: Request):
    """
    Create a new Gemini File Search store for RAG.
    
    Request body:
    {
        "display_name": "Property Documents Store"
    }
    """
    logger.info("Create File Search store endpoint received a request.")
    try:
        data = await request.json()
        store_request = CreateFileSearchStoreRequest(**data)
        
        manager = get_file_search_manager()
        result = manager.create_file_search_store(store_request.display_name)
        
        logger.info(f"Created store: {result['name']}")
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error creating File Search store: {e}")
        return {"status": "error", "message": str(e)}

@app.get(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/list-stores")
async def list_file_search_stores():
    """
    List all File Search stores.
    """
    logger.info("List File Search stores endpoint received a request.")
    try:
        manager = get_file_search_manager()
        stores = manager.list_file_search_stores()
        
        return {
            "stores": stores,
            "count": len(stores)
        }
        
    except Exception as e:
        logger.error(f"Error listing File Search stores: {e}")
        return {"status": "error", "message": str(e)}

@app.delete(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/delete-store")
async def delete_file_search_store(request: Request):
    """
    Delete a File Search store.
    
    Request body:
    {
        "store_name": "fileSearchStores/xxxxx"
    }
    """
    logger.info("Delete File Search store endpoint received a request.")
    try:
        data = await request.json()
        delete_request = DeleteStoreRequest(**data)
        
        manager = get_file_search_manager()
        result = manager.delete_file_search_store(delete_request.store_name)
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error deleting File Search store: {e}")
        return {"status": "error", "message": str(e)}

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/upload-file")
async def upload_file_to_file_search(request: Request):
    """
    Upload a file to a File Search store.
    
    Request body:
    {
        "file_path": "/path/to/file.pdf",
        "store_name": "fileSearchStores/xxxxx",
        "display_name": "Property Document",
        "wait_for_completion": true,
        "timeout": 300
    }
    """
    logger.info("Upload file to File Search endpoint received a request.")
    try:
        data = await request.json()
        upload_request = UploadFileToStoreRequest(**data)
        
        manager = get_file_search_manager()
        result = manager.upload_file_to_store(
            file_path=upload_request.file_path,
            store_name=upload_request.store_name,
            display_name=upload_request.display_name,
            user_id=upload_request.user_id,
            wait_for_completion=upload_request.wait_for_completion,
            timeout=upload_request.timeout
        )
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        return {"status": "error", "message": str(e)}

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/import-gcs-file")
async def import_gcs_file_to_file_search(request: Request):
    """
    Import a GCS file to a File Search store.
    
    Request body:
    {
        "gcs_uri": "gs://bucket/path/file.pdf",
        "store_name": "fileSearchStores/xxxxx",
        "display_name": "Property Document",
        "mime_type": "application/pdf",
        "wait_for_completion": true
    }
    """
    logger.info("Import GCS file to File Search endpoint received a request.")
    try:
        data = await request.json()
        import_request = ImportGCSFileRequest(**data)
        
        manager = get_file_search_manager()
        result = manager.import_gcs_file_to_store(
            gcs_uri=import_request.gcs_uri,
            store_name=import_request.store_name,
            display_name=import_request.display_name,
            user_id=import_request.user_id,
            mime_type=import_request.mime_type,
            wait_for_completion=import_request.wait_for_completion
        )
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error importing GCS file: {e}")
        return {"status": "error", "message": str(e)}

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/query")
async def query_file_search(request: Request):
    """
    Query File Search stores with semantic search.
    
    Request body:
    {
        "query": "What is the property address?",
        "store_names": ["fileSearchStores/xxxxx"],
        "model": "gemini-2.5-flash",
        "include_grounding_metadata": true
    }
    """
    logger.info("Query File Search endpoint received a request.")
    try:
        data = await request.json()
        query_request = FileSearchQueryRequest(**data)
        
        manager = get_file_search_manager()
        result = manager.query_file_search(
            query=query_request.query,
            store_names=query_request.store_names,
            model=query_request.model,
            include_grounding_metadata=query_request.include_grounding_metadata,
            generation_config=query_request.generation_config
        )
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error querying File Search: {e}")
        return {"status": "error", "message": str(e)}

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/operation-status")
async def get_file_search_operation_status(request: Request):
    """
    Get the status of a File Search operation.
    
    Request body:
    {
        "operation_name": "operations/xxxxx"
    }
    """
    logger.info("Get operation status endpoint received a request.")
    try:
        data = await request.json()
        status_request = OperationStatusRequest(**data)
        
        manager = get_file_search_manager()
        result = manager.get_operation_status(status_request.operation_name)
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error getting operation status: {e}")
        return {"status": "error", "message": str(e)}

# User-scoped File Search Endpoints

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/user/upload-file")
async def upload_user_file(request: Request):
    """
    Upload a file for a specific user (auto-creates user store).
    
    Request body:
    {
        "user_id": "user123",
        "file_path": "/path/to/file.pdf",
        "display_name": "My Document",
        "wait_for_completion": true
    }
    """
    logger.info("User file upload endpoint received a request.")
    try:
        data = await request.json()
        upload_request = UserFileUploadRequest(**data)
        
        manager = get_file_search_manager()
        result = manager.upload_user_file(
            user_id=upload_request.user_id,
            file_path=upload_request.file_path,
            display_name=upload_request.display_name,
            wait_for_completion=upload_request.wait_for_completion
        )
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error uploading user file: {e}")
        return {"status": "error", "message": str(e)}

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/user/import-gcs-file")
async def import_user_gcs_file(request: Request):
    """
    Import a GCS file for a specific user (auto-creates user store).
    
    Request body:
    {
        "user_id": "user123",
        "gcs_uri": "gs://bucket/file.pdf",
        "display_name": "My Document",
        "mime_type": "application/pdf",
        "wait_for_completion": true
    }
    """
    logger.info("User GCS import endpoint received a request.")
    try:
        data = await request.json()
        import_request = UserGCSImportRequest(**data)
        
        manager = get_file_search_manager()
        result = manager.import_user_gcs_file(
            user_id=import_request.user_id,
            gcs_uri=import_request.gcs_uri,
            display_name=import_request.display_name,
            mime_type=import_request.mime_type,
            wait_for_completion=import_request.wait_for_completion
        )
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error importing user GCS file: {e}")
        return {"status": "error", "message": str(e)}

@app.post(f"/{FIREBASE_WEBHOOK_SECRET}/file-search/user/query")
async def query_user_documents(request: Request):
    """
    Query documents for a specific user.
    
    Request body:
    {
        "user_id": "user123",
        "query": "What documents do I have?",
        "model": "gemini-2.5-flash",
        "include_grounding_metadata": true
    }
    """
    logger.info("User query endpoint received a request.")
    try:
        data = await request.json()
        query_request = UserQueryRequest(**data)
        
        manager = get_file_search_manager()
        result = manager.query_user_documents(
            user_id=query_request.user_id,
            query=query_request.query,
            model=query_request.model,
            include_grounding_metadata=query_request.include_grounding_metadata
        )
        
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Error querying user documents: {e}")
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
