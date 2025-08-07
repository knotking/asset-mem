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
import re
import asyncio
from google.genai import types
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

# aiogram imports
from aiogram.enums import ParseMode, ChatAction
from aiogram.client.default import DefaultBotProperties
from aiogram import Bot, Dispatcher, types as aio_types, Router
from aiogram.filters import Command
from aiogram import F

# Import Vertex AI client logic
from vertex_client import (
    reasoning_engine_resource,
    get_agent_answer
)

from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Environment Variables ---
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")

# --- aiogram Bot and Dispatcher Initialization ---
bot = Bot(
    token=TELEGRAM_BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN_V2)
)
dp = Dispatcher()
router = Router()

dp.include_router(router)
from gcp_utils import listen_to_event

# --- Helper Functions for Telegram API ---
def escape_markdown(text: str) -> str:
    markdown_v2_special_chars = r'_*[]()~`>#+-=|{}.!'
    pattern = r'([{}])'.format(re.escape(markdown_v2_special_chars))
    return re.sub(pattern, r'\\\1', text)

def is_command(text: str) -> bool:
    if not text:
        return False
    return text.strip().startswith("/")

def parse_command(text: str) -> str:
    return text.strip().split()[0].lower()

# --- aiogram Handlers ---
@router.message(Command("start"))
async def cmd_start(message: aio_types.Message):
    await message.reply(escape_markdown("Welcome! I am your AI assistant. Send me a message or use /help to see what I can do."))

@router.message(Command("help"))
async def cmd_help(message: aio_types.Message):
    await message.reply(escape_markdown("You can chat with me or use commands like /start and /help. Just type your question!"))

@router.message(lambda message: is_command(message.text))
async def unknown_command(message: aio_types.Message):
    command = parse_command(message.text)
    if command not in ["/start", "/help"]:
        await message.reply(escape_markdown(f"Unknown command: {command}\nType /help for available commands."))


# --- Attachment Handler ---
from google.cloud import storage
import tempfile
import aiohttp

from gcp_utils import upload_file_to_gcs

MAX_RAG_FILE_SIZE_MB = 10  # Example: 10 MB limit for Vertex RAG ManagedDB
MAX_RAG_FILE_SIZE_BYTES = MAX_RAG_FILE_SIZE_MB * 1024 * 1024

@router.message(
    (F.content_type == aio_types.ContentType.DOCUMENT) |
    (F.content_type == aio_types.ContentType.PHOTO) |
    (F.content_type == aio_types.ContentType.AUDIO) |
    (F.content_type == aio_types.ContentType.VIDEO)
)
async def handle_attachment(message: aio_types.Message):
    chat_id = message.chat.id
    content_type = message.content_type
    attachments = []

    # Collect all attachments in a list of dicts: {file_id, file_name, file_size, type}
    import time
    if content_type == aio_types.ContentType.DOCUMENT:
        # Telegram supports multiple documents as a list in message.document (if sent as media group)
        if hasattr(message, 'media_group_id') and message.media_group_id and hasattr(message, 'documents'):
            for doc in message.documents:
                file_name = doc.file_name or f"document_{doc.file_id}"
                attachments.append({
                    'file_id': doc.file_id,
                    'file_name': file_name,
                    'file_size': doc.file_size,
                    'type': 'document'
                })
        else:
            file_name = message.document.file_name or f"document_{message.document.file_id}"
            attachments.append({
                'file_id': message.document.file_id,
                'file_name': file_name,
                'file_size': message.document.file_size,
                'type': 'document'
            })
    elif content_type == aio_types.ContentType.PHOTO:
        # message.photo is a list of sizes, take the largest (last) as the main photo
        for idx, photo in enumerate(message.photo):
            # Use a timestamp and index for uniqueness
            ts = int(time.time())
            file_name = f"photo_{photo.file_id}_{ts}_{idx}.jpg"
            attachments.append({
                'file_id': photo.file_id,
                'file_name': file_name,
                'file_size': photo.file_size,
                'type': 'photo'
            })
    elif content_type == aio_types.ContentType.AUDIO:
        file_name = message.audio.file_name or f"audio_{message.audio.file_id}.mp3"
        attachments.append({
            'file_id': message.audio.file_id,
            'file_name': file_name,
            'file_size': message.audio.file_size,
            'type': 'audio'
        })
    elif content_type == aio_types.ContentType.VIDEO:
        file_name = message.video.file_name or f"video_{message.video.file_id}.mp4"
        attachments.append({
            'file_id': message.video.file_id,
            'file_name': file_name,
            'file_size': message.video.file_size,
            'type': 'video'
        })
    else:
        await message.reply(escape_markdown("Unsupported attachment type."))
        return

    GCS_BUCKET = os.environ.get("GCS_BUCKET")
    if not GCS_BUCKET:
        await message.reply(escape_markdown("GCS_BUCKET environment variable not set."))
        return

    uploaded_gcs_urls = []
    for att in attachments:
        file_id = att['file_id']
        file_name = att['file_name']
        file_size = att['file_size']

        # Check file size against Vertex RAG ManagedDB limits
        if file_size and file_size > MAX_RAG_FILE_SIZE_BYTES:
            await message.reply(
                escape_markdown(
                    f"Attachment {file_name} is too large ({file_size / (1024*1024):.2f} MB). "
                    f"Maximum allowed size is {MAX_RAG_FILE_SIZE_MB} MB."
                )
            )
            continue

        # Get file URL from Telegram
        file = await message.bot.get_file(file_id)
        file_url = f"https://api.telegram.org/file/bot{TELEGRAM_BOT_TOKEN}/{file.file_path}"
        destination_blob_name = f"telegram_uploads/{chat_id}/{file_name}"

        try:
            gcs_url = await upload_file_to_gcs(file_url, GCS_BUCKET, destination_blob_name)
            uploaded_gcs_urls.append(gcs_url)
        except Exception as e:
            logger.error(f"Failed to upload attachment {file_name}: {e}")
            await message.reply(escape_markdown(f"Failed to upload attachment {file_name}: {e}"))

    if uploaded_gcs_urls:
        await message.reply(escape_markdown(
            "Attachments uploaded to GCS:\n" + "\n".join(uploaded_gcs_urls)
        ))

        # --- Publish event to Pub/Sub ---
        from gcp_utils import publish_event
        project_id = os.environ.get("GCP_PROJECT_ID")
        topic_id = os.environ.get("USER_UPLOAD_TOPIC")
        user_id = str(chat_id)
        # Try to get the user's last text message as the query, fallback to empty string
        user_query = getattr(message, 'caption', None) or getattr(message, 'text', None) or ""
        if project_id and topic_id:
            try:
                # Add source parameter with value 'telegram'
                publish_event(project_id, topic_id, uploaded_gcs_urls, user_id, user_query, source="telegram")
                await message.reply(escape_markdown("Processing your attachments..."))
            except Exception as e:
                logger.error(f"Failed to publish event to Pub/Sub: {e}")
                await message.reply(escape_markdown(f"Failed to publish event to Pub/Sub: {e}"))
        else:
            await message.reply(escape_markdown("GCP_PROJECT_ID or GCP_PUBSUB_TOPIC environment variable not set. Event not published."))
    else:
        await message.reply(escape_markdown("No attachments were uploaded."))

@router.message(F.content_type == aio_types.ContentType.TEXT)
async def handle_text_message(message: aio_types.Message):
    chat_id = message.chat.id
    user_text = message.text

    # 1. Send "Thinking..." message and chat action immediately
    await message.bot.send_chat_action(chat_id, ChatAction.TYPING)
    thinking_message = await message.answer(escape_markdown("Searching...🔍"))
    agent_answer = get_agent_answer(chat_id, user_text) # This is where your AI logic runs
    logger.info(f"Agent answer: {agent_answer}")
    # 2. Edit the "Thinking..." message with the actual answer
    await thinking_message.edit_text(escape_markdown(agent_answer))

@router.message()
async def handle_non_text(message: aio_types.Message):
    if message.content_type != aio_types.ContentType.TEXT:
        await message.reply(escape_markdown("Sorry, I can only process text messages at the moment."))

# --- FastAPI App and Webhook ---
from fastapi import FastAPI, Request
import json

app = FastAPI()

WEBHOOK_PATH = "/"
WEBHOOK_URL = os.environ.get("TELEGRAM_WEBHOOK_SECRET")  # e.g., https://your.domain.com/webhook


@app.get("/health")
async def health_check():
    status_msg = "ok"
    if not reasoning_engine_resource:
        status_msg += " (Reasoning Engine not initialized)"
    return {"status": status_msg}

@app.post(f"/{WEBHOOK_URL}")
async def telegram_webhook(request: Request):
    update = await request.json()
    telegram_update = aio_types.Update.model_validate(update)
    await dp.feed_update(bot, telegram_update)
    return {"status": "ok"}

async def on_event_user_upload_result(message: str):
    # Define the expected type using pydantic
    from pydantic import BaseModel, Field
    from typing import List, Dict
    import json

    class DocTypeInfo(BaseModel):
        title: str
        type: str
        summary: str

    class UserUploadResultEvent(BaseModel):
        user_id: str
        user_query: str
        gcs_urls: List[str]
        doc_types: Dict[str, DocTypeInfo]

    logger.info(f"User upload result event received: {message}")
    try:
        event_obj = UserUploadResultEvent.model_validate(json.loads(message))
        logger.info(f"Parsed event: {event_obj}")

        # Convert doc_types to a Gemini-style JSON string
        import json as pyjson
        doc_types_json = pyjson.dumps({k: v.dict() for k, v in event_obj.doc_types.items()}, indent=2)
        doc_types_str = f"```json\n{doc_types_json}\n```"
        from gcp_utils import get_user_gcs_files
        gcs_files = get_user_gcs_files(os.environ.get("GCS_BUCKET"), "telegram-uploads", event_obj.user_id)
        agent_answer = get_agent_answer(event_obj.user_id, event_obj.user_query, doc_types_str, gcs_files) # This is where your AI logic runs
        logger.info(f"Agent answer: {agent_answer}")
    # 2. Edit the "Thinking..." message with the actual answer
    except Exception as e:
        logger.error(f"Failed to parse user upload result event: {e}")
    if event_obj.user_id:
        await bot.send_message(chat_id=int(event_obj.user_id), text=escape_markdown(agent_answer))
    return {"status": "ok"}

        # You can now access event_obj.user_id, event_obj.user_query, event_obj.gcs_urls, event_obj.doc_types
   


# @app.post("/processing_complete")
# async def processing_complete(request: Request):
#     data = await request.json()
#     # Example: data = {"gcs_urls:[]","user_id": "123","user_query":"", "result": "imported_rag_files_count: 1", ...}
#     user_id = data.get("user_id")
#     user_query = data.get("user_query")
#     gcs_urls = data.get("gcs_urls", [])
#     # result = data.get("result", "Processing complete.")
#     agent_answer = get_agent_answer(user_id, user_query, gcs_urls ) # This is where your AI logic runs
#     logger.info(f"Agent answer: {agent_answer}")
#     # 2. Edit the "Thinking..." message with the actual answer
#     if user_id:
#         await bot.send_message(chat_id=int(user_id), text=escape_markdown(agent_answer))
#     return {"status": "ok"}
import threading

def start_pubsub_listener():
    listen_to_event(
        os.environ.get("GCP_PROJECT_ID"),
        os.environ.get("USER_UPLOAD_RESULT_SUBSCRIPTION"),
        on_event_user_upload_result
    )

threading.Thread(target=start_pubsub_listener, daemon=True).start()

# # --- aiogram webhook setup and FastAPI runner ---
# import asyncio

# if __name__ == "__main__":
#     import uvicorn

#     async def on_startup():
#         if not WEBHOOK_URL:
#             logger.error("WEBHOOK_URL environment variable not set!")
#             return
#         await bot.set_webhook(WEBHOOK_URL)
#         logger.info(f"Webhook set to: {WEBHOOK_URL}")

#     async def main():
#         await on_startup()
#         config = uvicorn.Config("agents.proxy.api:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8080)), log_level="info")
#         server = uvicorn.Server(config)
#         await server.serve()

#     asyncio.run(main())
