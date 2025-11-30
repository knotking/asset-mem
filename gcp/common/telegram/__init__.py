"""
Telegram Bot - Telegram Bot API Integration

Provides support for Telegram Bot API integration with:
- Message handling and formatting
- File upload handling
- Webhook support
- Markdown formatting for Telegram
"""

from .client import (
    TelegramBot,
    initialize_bot,
    get_telegram_webhook_endpoint,
    start_telegram_bot_polling,
    safe_markdown_format,
    escape_markdown,
    format_google_maps_links,
    format_youtube_links,
    json_to_markdown,
    extract_markdown_from_dual_format,
    split_message,
    parse_command,
)
from .config import TelegramConfig

__all__ = [
    # Client
    "TelegramBot",
    "initialize_bot",
    "get_telegram_webhook_endpoint",
    "start_telegram_bot_polling",
    # Config
    "TelegramConfig",
    # Utilities
    "safe_markdown_format",
    "escape_markdown",
    "format_google_maps_links",
    "format_youtube_links",
    "json_to_markdown",
    "extract_markdown_from_dual_format",
    "split_message",
    "parse_command",
]

