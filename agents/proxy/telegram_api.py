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

# --- Helper Functions for Telegram API ---
def escape_markdown(text: str) -> str:
    markdown_v2_special_chars = r'_*[]()~`>#+-=|{}.!'
    pattern = r'([{}])'.format(re.escape(markdown_v2_special_chars))
    return re.sub(pattern, r'\\\1', text)

def is_command(text: str) -> bool:
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

@router.message(F.content_type == aio_types.ContentType.TEXT)
async def handle_text_message(message: aio_types.Message):
    chat_id = message.chat.id
    user_text = message.text

    # 1. Send "Thinking..." message and chat action immediately
    await message.bot.send_chat_action(chat_id, ChatAction.TYPING)
    thinking_message = await message.answer(escape_markdown("Thinking...🤔"))
    # thinking_message = await message.bot.send_animation(chat_id=chat_id,animation='CAACAgIAAxkBAAJKSWiDeIjJhcfJAk3oys1q9QABQyAViQACbwUAAj-VzArANFJh3KtOyDYE')
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
