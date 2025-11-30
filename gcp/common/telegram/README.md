# Telegram Bot - Telegram Bot API Integration

A reusable Telegram Bot API integration module for handling messages, attachments, and webhooks.

## Features

- **Message Handling** - Text message processing with custom handlers
- **File Upload Support** - Handle document, photo, audio, and video attachments
- **Webhook Support** - FastAPI webhook endpoint for receiving Telegram updates
- **Markdown Formatting** - Convert JSON to readable markdown for Telegram
- **Dual-Format Support** - Extract markdown from dual-format responses (Markdown + JSON)
- **Link Formatting** - Automatic formatting for Google Maps and YouTube links
- **Async Support** - Full async/await support for high-performance applications

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install aiogram telegramify-markdown fastapi google-cloud-secret-manager
```

## Configuration

### Environment Variables

Set the following environment variables:

```bash
# Required
export TELEGRAM_BOT_TOKEN="your-bot-token"

# Optional
export TELEGRAM_WEBHOOK_SECRET="your-webhook-secret"
```

### Using Configuration Object

```python
from gcp.common.telegram import TelegramConfig, TelegramBot

# Load from environment
config = TelegramConfig.from_env()

# Or create directly
config = TelegramConfig(
    bot_token="your-bot-token",
    webhook_secret="optional-secret"
)
```

## Usage

### Basic Setup with Custom Handlers

```python
import asyncio
from gcp.common.telegram import TelegramBot, TelegramConfig

async def handle_message(user_query: str, chat_id: int):
    """Handle text messages."""
    # Your custom logic here
    yield f"Echo: {user_query}"

async def handle_attachment(gcs_urls: list, user_query: str, chat_id: int):
    """Handle file attachments."""
    # Your custom logic here
    yield f"Processed {len(gcs_urls)} files"

async def upload_file(file_url: str, bucket_name: str, destination: str) -> str:
    """Upload file to GCS."""
    # Your upload logic here
    return f"gs://{bucket_name}/{destination}"

# Initialize bot
config = TelegramConfig.from_env()
bot = TelegramBot(
    config=config,
    message_handler=handle_message,
    attachment_handler=handle_attachment,
    upload_file_callback=upload_file,
)
```

### Using with FastAPI

```python
from fastapi import FastAPI, Request
from gcp.common.telegram import TelegramBot, TelegramConfig

app = FastAPI()

# Initialize bot
config = TelegramConfig.from_env()
bot = TelegramBot(
    config=config,
    message_handler=your_message_handler,
    attachment_handler=your_attachment_handler,
    upload_file_callback=your_upload_callback,
)

@app.post("/webhook/{secret}")
async def telegram_webhook(request: Request, secret: str):
    return await bot.webhook_handler(request)
```

### Backward Compatibility Mode

For backward compatibility with existing code:

```python
from gcp.common.telegram import initialize_bot, get_telegram_webhook_endpoint

# Initialize with handlers
initialize_bot(
    message_handler=your_message_handler,
    attachment_handler=your_attachment_handler,
    upload_file_callback=your_upload_callback,
)

# Use the webhook endpoint
webhook_handler = get_telegram_webhook_endpoint()
```

## API Reference

### TelegramBot

Main bot class for handling Telegram messages.

#### Methods

- `webhook_handler(request: Request)` - Handle webhook updates
- `get_webhook_endpoint()` - Get webhook handler function
- `start_polling()` - Start polling for updates (development)

### TelegramConfig

Configuration container for Telegram Bot.

#### Attributes

- `bot_token` - Telegram Bot API token (required)
- `webhook_secret` - Webhook secret (optional)

#### Methods

- `from_env()` - Load from environment variables
- `from_gcp_secret_manager(...)` - Load from GCP Secret Manager
- `validate()` - Validate configuration

### Utility Functions

- `safe_markdown_format(text: str)` - Format text for Telegram MarkdownV2
- `escape_markdown(text: str)` - Escape markdown special characters
- `format_google_maps_links(text: str)` - Format Google Maps URLs as links
- `format_youtube_links(text: str)` - Format YouTube URLs as links
- `json_to_markdown(json_data)` - Convert JSON to readable markdown
- `extract_markdown_from_dual_format(text: str)` - Extract markdown from dual-format responses
- `split_message(text: str, max_length: int)` - Split long messages into chunks
- `parse_command(text: str)` - Parse command from text

## Handler Signatures

### Message Handler

```python
async def message_handler(user_query: str, chat_id: int):
    """Handle text messages."""
    # Process user_query
    # Yield response parts
    yield "Response part 1"
    yield "Response part 2"
```

### Attachment Handler

```python
async def attachment_handler(gcs_urls: list, user_query: str, chat_id: int):
    """Handle file attachments."""
    # Process attachments
    # Yield response parts
    yield "Processing..."
    yield "Done!"
```

### Upload File Callback

```python
async def upload_file(file_url: str, bucket_name: str, destination: str) -> str:
    """Upload file to storage."""
    # Upload logic
    return "gs://bucket/path/to/file"
```

## Examples

### Example 1: Simple Echo Bot

```python
from gcp.common.telegram import TelegramBot, TelegramConfig

async def echo_handler(user_query: str, chat_id: int):
    yield f"You said: {user_query}"

config = TelegramConfig.from_env()
bot = TelegramBot(config=config, message_handler=echo_handler)
```

### Example 2: Integration with Vertex AI

```python
from gcp.common.telegram import TelegramBot, TelegramConfig
from your_module import AgentRequest, stream_agent_answers, ANALYSIS_OPTIONAL_AGENT_ORDER

async def ai_handler(user_query: str, chat_id: int):
    request = AgentRequest(
        user_id=str(chat_id),
        user_query=user_query,
        analysis_optional_agents=list(ANALYSIS_OPTIONAL_AGENT_ORDER),
    )
    async for answer in stream_agent_answers(request):
        yield str(answer)

config = TelegramConfig.from_env()
bot = TelegramBot(config=config, message_handler=ai_handler)
```

## License

Internal use only.

