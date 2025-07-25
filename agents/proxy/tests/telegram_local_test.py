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
import asyncio
import json
import aiohttp # New dependency for making HTTP requests

# aiogram imports
from aiogram import Bot, Dispatcher, types as aio_types
# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("Loaded environment variables from .env")
except ImportError:
    print("python-dotenv not installed. Skipping .env loading.")
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Environment Variables ---
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
# This is the URL of your local FastAPI application's webhook endpoint
# Make sure this matches the host and port where main_webhook_app.py is running
# and includes the TELEGRAM_WEBHOOK_SECRET_PATH.
# Example: "http://localhost:8080/my_secret_webhook_path"
WEBHOOK_URL = os.environ.get("TELEGRAM_WEBHOOK_SECRET")
print(f"WEBHOOK_URL: {WEBHOOK_URL}")
LOCAL_WEBHOOK_URL = f"http://localhost:8080/{WEBHOOK_URL}"

# Validate essential environment variables
if not TELEGRAM_BOT_TOKEN:
    logger.error("TELEGRAM_BOT_TOKEN environment variable not set!")
    exit(1)
if not LOCAL_WEBHOOK_URL:
    logger.error("LOCAL_WEBHOOK_URL environment variable not set! This should be the URL of your local FastAPI webhook.")
    exit(1)

# --- aiogram Bot and Dispatcher Initialization for Polling ---
bot = Bot(token=TELEGRAM_BOT_TOKEN)
dp = Dispatcher()

# --- Handler to forward all updates to the local webhook ---
@dp.message() # Catches all message types
@dp.callback_query() # Catches inline keyboard callbacks
@dp.inline_query() # Catches inline queries
@dp.chosen_inline_result() # Catches chosen inline results
@dp.channel_post() # Catches channel posts
@dp.edited_channel_post() # Catches edited channel posts
@dp.my_chat_member() # Catches chat member updates for the bot
@dp.chat_member() # Catches chat member updates for other users
@dp.poll_answer() # Catches poll answers
@dp.poll() # Catches poll updates
@dp.shipping_query() # Catches shipping queries (for payments)
@dp.pre_checkout_query() # Catches pre-checkout queries (for payments)
@dp.message_reaction() # Catches message reactions
@dp.message_reaction_count() # Catches message reaction count updates
@dp.chat_join_request() # Catches chat join requests
async def forward_update_to_webhook(update: aio_types.Update):
    """
    This handler intercepts all incoming Telegram updates via long polling
    and forwards them as a POST request to the specified local webhook URL.
    """
    # logger.info(f"Received update from Telegram {update}). Forwarding...")
    
    # aiogram's Update object can be easily converted to a dictionary and then JSON
    update_data = update.model_copy(update={'update_id': 808333716})
    update_data = update_data.model_dump_json(by_alias=True) # Use by_alias to get original Telegram field names (e.g., 'message_id' instead of 'messageId')
    logger.info(f"update_data: {update_data}")

    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(LOCAL_WEBHOOK_URL, data=update_data, headers={'Content-Type': 'application/json'}) as response:
                response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
                response_json = await response.json()
                logger.info(f"Successfully forwarded update {update}. Webhook response: {response_json}")
        except aiohttp.ClientError as e:
            logger.error(f"Failed to forward update {update} to webhook {LOCAL_WEBHOOK_URL}: {e}")
        except Exception as e:
            logger.error(f"An unexpected error occurred while forwarding update {update}: {e}")

# --- Main function to start polling ---
async def main():
    logger.info("Starting Telegram long polling and forwarding updates to local webhook...")
    await bot.delete_webhook(drop_pending_updates=True)
    logger.info("Deleted existing Telegram webhooks.")
    # Start polling. The `handle_update` method will be called for each incoming update.
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Polling stopped by user.")
    except Exception as e:
        logger.error(f"An error occurred during polling: {e}")

