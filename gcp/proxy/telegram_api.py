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
from typing import Any, Dict, List, Union

# aiogram imports
from aiogram.enums import ParseMode, ChatAction
from aiogram.client.default import DefaultBotProperties
from aiogram import Bot, Dispatcher, types as aio_types, Router
from aiogram.filters import Command
from aiogram import F
import asyncio

# Import Vertex AI client logic
from vertex_client import (
    reasoning_engine_resource,
    get_agent_answer
)

from dotenv import load_dotenv
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger: logging.Logger = logging.getLogger(__name__)

# --- Environment Variables ---
TELEGRAM_BOT_TOKEN: str   = os.environ.get("TELEGRAM_BOT_TOKEN","")    

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


def parse_command(text: str) -> str:
    return text.strip().split()[0].lower()

# --- aiogram Handlers ---
@router.message(Command("start"))
async def cmd_start(message: aio_types.Message):
    await message.reply(escape_markdown("Welcome! I am your AI assistant. Send me a message or use /help to see what I can do."))

@router.message(Command("help"))
async def cmd_help(message: aio_types.Message):
    await message.reply(escape_markdown("You can chat with me or use commands like /start and /help. Just type your question!"))

@router.message(F.text.startswith("/") & ~F.text.in_(["/start", "/help"]))
async def handle_unknown_command(message: aio_types.Message) -> None:
    command: str = parse_command(getattr(message, "text", ""))
    await message.reply(escape_markdown(f"Unknown command: {command}\nType /help for available commands."))


# --- Attachment Handler ---

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
        photo = message.photo[-1]  # Take the highest resolution photo
        ts = int(time.time())
        file_name = f"photo_{photo.file_id}_{ts}.jpg"
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
        destination_blob_name = f"uploads/{chat_id}/{file_name}"

        try:
            gcs_url = await upload_file_to_gcs(file_url, GCS_BUCKET, destination_blob_name)
            uploaded_gcs_urls.append(gcs_url)
        except Exception as e:
            logger.error(f"Failed to upload attachment {file_name}: {e}")
            await message.reply(escape_markdown(f"Failed to upload attachment {file_name}: {e}"))

    if uploaded_gcs_urls:
        # await message.reply(escape_markdown(
        #     "Attachments uploaded to GCS:\n" + "\n".join(uploaded_gcs_urls)
        # ))

      
        user_id = str(chat_id)
        # Try to get the user's last text message as the query, fallback to empty string
        user_query = getattr(message, 'caption', None) or getattr(message, 'text', None) or ""
        
        try:
            
            await message.reply(escape_markdown("Processing your documents..."))
            agent_answer = get_agent_answer(chat_id, user_query=user_query, uploaded_gcs_urls=uploaded_gcs_urls) # This is where your AI logic runs
            logger.info(f"Agent answer: {agent_answer}")
            await message.answer(escape_markdown(agent_answer))
        except Exception as e:
                logger.error(f"Failed to publish event to Pub/Sub: {e}")
                await message.reply(escape_markdown(f"Failed to publish event to Pub/Sub: {e}"))
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
    # # 2. Edit the "Thinking..." message with the actual answer
    await thinking_message.edit_text(escape_markdown(agent_answer))

@router.message()
async def handle_non_text(message: aio_types.Message):
    if message.content_type != aio_types.ContentType.TEXT:
        await message.reply(escape_markdown("Sorry, I can only process text messages at the moment."))

# --- FastAPI App and Webhook ---
from fastapi import FastAPI, Request

app = FastAPI()

main_loop = asyncio.get_event_loop()


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

async def  on_event_user_upload_result(message: str):
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
