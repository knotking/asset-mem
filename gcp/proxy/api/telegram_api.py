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

"""
Telegram API adapter for proxy/api.

This module provides backward-compatible access to the Telegram bot functionality
from gcp.common.telegram, configured with proxy-specific handlers.
"""

import os
import logging
from typing import List, Dict, Any

from dotenv import load_dotenv
load_dotenv()

# Import proxy-specific modules
from models import AgentRequest
from optional_agents import ANALYSIS_OPTIONAL_AGENT_ORDER
from vertex_client import stream_agent_answers
from gcp_utils import upload_file_to_gcs

# Import common telegram module
from gcp.common.telegram import (
    TelegramBot,
    TelegramConfig,
    initialize_bot,
    get_telegram_webhook_endpoint as _get_webhook_endpoint,
    start_telegram_bot_polling as _start_polling,
)

# Configure logging
logger: logging.Logger = logging.getLogger(__name__)

# Initialize bot with proxy-specific handlers
def _create_message_handler():
    """Create message handler for text messages."""
    async def handle_message(user_query: str, chat_id: int):
        agent_request = AgentRequest(
            user_id=str(chat_id),
            user_query=user_query,
            session_id=None,  # Session ID will be handled by vertex_client
            context_doc_uris=None,
            diagnosis_uris=None,
            property_address=None,
            analysis_optional_agents=list(ANALYSIS_OPTIONAL_AGENT_ORDER),
        )
        async for answer_part in stream_agent_answers(agent_request):
            yield str(answer_part)
    
    return handle_message

def _create_attachment_handler():
    """Create attachment handler for file uploads."""
    async def handle_attachment(gcs_urls: List[str], user_query: str, chat_id: int):
        user_id = str(chat_id)
        agent_request = AgentRequest(
            user_id=user_id,
            user_query=user_query,
            diagnosis_uris=gcs_urls,
            session_id=None,  # Session ID will be handled by vertex_client
            context_doc_uris=None,
            property_address=None,
            analysis_optional_agents=list(ANALYSIS_OPTIONAL_AGENT_ORDER),
        )
        async for answer_part in stream_agent_answers(agent_request):
            yield str(answer_part)
    
    return handle_attachment

# Initialize bot on module import
_config = TelegramConfig.from_env()
_bot = TelegramBot(
    config=_config,
    message_handler=_create_message_handler(),
    attachment_handler=_create_attachment_handler(),
    upload_file_callback=upload_file_to_gcs,
)

# Backward compatibility functions
def get_telegram_webhook_endpoint():
    """Get the webhook endpoint handler (backward compatibility)."""
    return _bot.get_webhook_endpoint()

def start_telegram_bot_polling():
    """Start polling for updates (backward compatibility)."""
    _bot.start_polling()

# Export bot instance for advanced usage
bot = _bot.bot
dp = _bot.dp
router = _bot.router
