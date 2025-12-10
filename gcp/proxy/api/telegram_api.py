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
import time
import json
from typing import Any, Dict, List, Union, Optional

# aiogram imports
from aiogram.enums import ParseMode, ChatAction
from aiogram.client.default import DefaultBotProperties
from aiogram import Bot, Dispatcher, types as aio_types, Router
from aiogram.filters import Command
from aiogram import F
from fastapi import FastAPI, Request
import telegramify_markdown
from schemas import AgentRequest
from optional_agents import ANALYSIS_OPTIONAL_AGENT_ORDER

# Import Vertex AI client logic
from vertex_client import (
    stream_agent_answers
)

from dotenv import load_dotenv
load_dotenv()

from gcp_utils import upload_file_to_gcs, listen_to_event

# Configure logging
logger: logging.Logger = logging.getLogger(__name__)

# --- Environment Variables ---
TELEGRAM_BOT_TOKEN: str   = os.environ.get("TELEGRAM_BOT_TOKEN","")    

# --- aiogram Bot and Dispatcher Initialization ---
bot = Bot(
    token=TELEGRAM_BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=None)  # No markdown parsing - return raw response
)
dp = Dispatcher()
router = Router()

dp.include_router(router)

processed_messages = set()
# --- Helper Functions for Telegram API ---
def escape_markdown(text: str) -> str:
    markdown_v2_special_chars = r'_*[]()~`>#+-=|{}.!'
    pattern = r'([{}])'.format(re.escape(markdown_v2_special_chars))
    return re.sub(pattern, r'\\\1', text)


def format_google_maps_links(text: str) -> str:
    # Regex to find Google Maps URLs
    # This regex looks for URLs starting with https://www.google.com/maps/dir/ or https://www.google.com/maps/place/
    # and captures the entire URL.
    # It also handles cases where there are additional query parameters.
    # Updated regex to handle broader range of URL characters including +, !, :, ,
    pattern = r'(https?://(?:www\.)?google\.com/maps/(?:dir|place)/([a-zA-Z0-9_\-./?&%=+!:,]+))'

    def replace_link(match):
        # Capture group 1 is the full URL, group 2 is the path/query part. We want the full URL.
        url = match.group(0)  
        return f"[View Directions]({url})"

    return re.sub(pattern, replace_link, text)

def format_youtube_links(text: str) -> str:
    # Regex to find common YouTube URL patterns
    # This includes short URLs (youtu.be), standard URLs (youtube.com/watch?v=), and embed URLs.
    pattern = r'(https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)[a-zA-Z0-9_\-]+(?:[&?][^\s]*)?)'

    def replace_link(match):
        url = match.group(0)
        return f"[Watch on YouTube]({url})"

    return re.sub(pattern, replace_link, text)

def json_to_markdown(json_data: Union[str, dict]) -> str:
    """
    Converts JSON data (string or dict) to a readable markdown format for Telegram.
    Extracts and converts any JSON found in the text to clean markdown format.
    
    Args:
        json_data: Either a JSON string or a dict
        
    Returns:
        Formatted markdown string (without JSON syntax)
    """
    try:
        # Try to parse if it's a string
        if isinstance(json_data, str):
            # Strip whitespace
            text = json_data.strip()
            
            # Remove markdown code block markers if present
            if text.startswith('```json'):
                text = text[7:]
            elif text.startswith('```'):
                text = text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            
            # Method 1: Try to find JSON object or array in the string using balanced braces
            # This handles nested JSON better than simple regex
            json_str = _extract_json_from_string(text)
            if json_str:
                try:
                    parsed = json.loads(json_str)
                    # Successfully parsed JSON - convert to markdown
                    formatted = _format_json_as_markdown(parsed)
                    
                    # Replace the JSON in the original text with formatted markdown
                    # Find where the JSON starts and ends in the original text
                    json_start = text.find(json_str)
                    if json_start >= 0:
                        prefix = text[:json_start].strip()
                        suffix = text[json_start + len(json_str):].strip()
                        parts = []
                        if prefix:
                            # Remove trailing colon if present (e.g., "Agent Name:" -> "Agent Name")
                            prefix = prefix.rstrip(':').strip()
                            if prefix:
                                parts.append(prefix)
                        parts.append(formatted)
                        if suffix:
                            # Recursively check suffix for more JSON
                            suffix_formatted = json_to_markdown(suffix)
                            parts.append(suffix_formatted)
                        result = "\n\n".join(parts)
                        logger.debug(f"Successfully converted JSON to markdown (Method 1)")
                        return result
                    logger.debug(f"Successfully converted JSON to markdown (Method 1, no prefix)")
                    return formatted
                except json.JSONDecodeError as e:
                    logger.debug(f"Failed to parse extracted JSON: {e}, JSON string length: {len(json_str)}")
            
            # Method 2: Try parsing the whole string as JSON
            try:
                parsed = json.loads(text)
                return _format_json_as_markdown(parsed)
            except json.JSONDecodeError:
                pass
            
            # Method 3: Try to find JSON-like structures even with minor formatting issues
            # Look for patterns that look like JSON but might have trailing commas or comments
            # This regex is more aggressive - finds any opening brace followed by content
            json_like_pattern = re.search(r'\{[^}]*"[^"]*"[^}]*\}', text)
            if json_like_pattern:
                potential_json = json_like_pattern.group(0)
                # Try to find the full JSON by expanding to balanced braces
                full_json = _extract_json_from_string(potential_json)
                if full_json:
                    try:
                        parsed = json.loads(full_json)
                        formatted = _format_json_as_markdown(parsed)
                        # Replace in original text
                        json_start = text.find(full_json)
                        if json_start >= 0:
                            prefix = text[:json_start].strip()
                            suffix = text[json_start + len(full_json):].strip()
                            parts = []
                            if prefix:
                                # Remove trailing colon if present
                                prefix = prefix.rstrip(':').strip()
                                if prefix:
                                    parts.append(prefix)
                            parts.append(formatted)
                            if suffix:
                                suffix_formatted = json_to_markdown(suffix)
                                parts.append(suffix_formatted)
                            return "\n\n".join(parts)
                        return formatted
                    except json.JSONDecodeError:
                        pass
            
            # Method 4: More aggressive search - look for any opening brace in the text
            # and try to extract complete JSON from that point
            brace_positions = [i for i, char in enumerate(text) if char == '{']
            for pos in brace_positions:
                # Try to extract JSON starting from this position
                json_str = _extract_json_from_string(text[pos:])
                if json_str:
                    try:
                        parsed = json.loads(json_str)
                        formatted = _format_json_as_markdown(parsed)
                        # Replace in original text
                        prefix = text[:pos].strip()
                        suffix = text[pos + len(json_str):].strip()
                        parts = []
                        if prefix:
                            # Remove trailing colon if present
                            prefix = prefix.rstrip(':').strip()
                            if prefix:
                                parts.append(prefix)
                        parts.append(formatted)
                        if suffix:
                            suffix_formatted = json_to_markdown(suffix)
                            parts.append(suffix_formatted)
                        return "\n\n".join(parts)
                    except json.JSONDecodeError:
                        continue
        else:
            # Already a dict/list, format it directly
            return _format_json_as_markdown(json_data)
    except (json.JSONDecodeError, ValueError, AttributeError, Exception) as e:
        # If it's not valid JSON, return as-is
        logger.debug(f"Could not parse as JSON: {e}")
        return str(json_data)
    
    # If no JSON found, return original text
    return str(json_data)

def _extract_json_from_string(text: str) -> str:
    """
    Extracts a JSON object or array from a string by finding balanced braces/brackets.
    
    Args:
        text: String that may contain JSON
        
    Returns:
        Extracted JSON string or empty string if not found
    """
    # Find first opening brace or bracket
    for i, char in enumerate(text):
        if char == '{':
            # Find matching closing brace
            depth = 0
            in_string = False
            escape_next = False
            for j in range(i, len(text)):
                if escape_next:
                    escape_next = False
                    continue
                if text[j] == '\\':
                    escape_next = True
                    continue
                if text[j] == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if not in_string:
                    if text[j] == '{':
                        depth += 1
                    elif text[j] == '}':
                        depth -= 1
                        if depth == 0:
                            # Found balanced JSON object
                            json_str = text[i:j+1]
                            try:
                                # Validate it's valid JSON
                                json.loads(json_str)
                                return json_str
                            except json.JSONDecodeError:
                                break
            break
        elif char == '[':
            # Find matching closing bracket
            depth = 0
            in_string = False
            escape_next = False
            for j in range(i, len(text)):
                if escape_next:
                    escape_next = False
                    continue
                if text[j] == '\\':
                    escape_next = True
                    continue
                if text[j] == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if not in_string:
                    if text[j] == '[':
                        depth += 1
                    elif text[j] == ']':
                        depth -= 1
                        if depth == 0:
                            # Found balanced JSON array
                            json_str = text[i:j+1]
                            try:
                                # Validate it's valid JSON
                                json.loads(json_str)
                                return json_str
                            except json.JSONDecodeError:
                                break
            break
    return ""

def _format_json_as_markdown(data: Any, indent: int = 0, max_depth: int = 5) -> str:
    """
    Recursively formats JSON data as human-readable markdown.
    Converts JSON structure to clean, readable markdown without JSON syntax.
    
    Args:
        data: The data to format (dict, list, or primitive)
        indent: Current indentation level
        max_depth: Maximum depth to recurse (prevents infinite loops)
        
    Returns:
        Formatted markdown string (no JSON syntax)
    """
    if max_depth <= 0:
        return "..."
    
    indent_str = "  " * indent
    
    if isinstance(data, dict):
        # Sanitize analysis payloads when clarification is required
        if 'analysis' in data and isinstance(data['analysis'], dict):
            analysis_section = data['analysis']
            triage_section = analysis_section.get('triageResult')
            if isinstance(triage_section, dict) and triage_section.get('needs_clarification') is True:
                # Keep only triageResult to avoid leaking service recommendations or other sections
                data = {
                    'analysis': {
                        'triageResult': triage_section
                    }
                }
        if not data:
            return ""
        
        lines = []
        for key, value in data.items():
            # Convert camelCase/snake_case keys to readable format
            readable_key = key.replace('_', ' ').replace('-', ' ')
            # Capitalize first letter of each word
            readable_key = ' '.join(word.capitalize() for word in readable_key.split())
            
            # Format key - use ** for bold
            formatted_key = f"**{readable_key}**"
            
            # Format value
            if isinstance(value, (dict, list)):
                formatted_value = _format_json_as_markdown(value, indent + 1, max_depth - 1)
                if formatted_value.strip():
                    lines.append(f"{indent_str}• {formatted_key}:")
                    # Add the value on next line with indentation
                    value_lines = formatted_value.split('\n')
                    for line in value_lines:
                        if line.strip():
                            lines.append(f"{indent_str}  {line}")
            else:
                formatted_value = _format_value(value)
                if formatted_value and formatted_value.strip() and formatted_value != "*None*":
                    lines.append(f"{indent_str}• {formatted_key}: {formatted_value}")
        
        return "\n".join(lines)
    
    elif isinstance(data, list):
        if not data:
            return ""
        
        lines = []
        for i, item in enumerate(data):
            if isinstance(item, dict):
                # For dict items in list, format as a section
                item_lines = _format_json_as_markdown(item, indent + 1, max_depth - 1).split('\n')
                if item_lines and any(line.strip() for line in item_lines):
                    # Add a separator for each item in the list
                    if i > 0:
                        lines.append("")
                    for line in item_lines:
                        if line.strip():
                            lines.append(f"{indent_str}{line}")
            elif isinstance(item, list):
                item_lines = _format_json_as_markdown(item, indent + 1, max_depth - 1).split('\n')
                for line in item_lines:
                    if line.strip():
                        lines.append(f"{indent_str}{line}")
            else:
                formatted_item = _format_value(item)
                if formatted_item and formatted_item.strip():
                    lines.append(f"{indent_str}{i + 1}\\. {formatted_item}")
        
        return "\n".join(lines)
    
    else:
        return _format_value(data)

def _format_value(value: Any) -> str:
    """Formats a primitive value for markdown."""
    if value is None:
        return "*None*"
    elif isinstance(value, bool):
        return "✅ *True*" if value else "❌ *False*"
    elif isinstance(value, str):
        # Preserve URLs and format as links
        if value.startswith(('http://', 'https://')):
            return f"[Link]({value})"
        # Limit very long strings to prevent message overflow
        if len(value) > 500:
            return f"{value[:497]}..."
        # Return string as-is (telegramify_markdown will handle escaping)
        return value
    elif isinstance(value, (int, float)):
        return str(value)
    else:
        # Convert other types to string
        str_value = str(value)
        # Limit length
        if len(str_value) > 500:
            return f"{str_value[:497]}..."
        return str_value

def extract_markdown_from_dual_format(text: str) -> Optional[str]:
    """
    Extracts the markdown portion from a dual-format response (Markdown + JSON code block).
    
    Analysis Agent responses should be in the format:
    [Markdown formatted response here]
    
    ```json
    { ... JSON data ... }
    ```
    
    Args:
        text: The full response text that may contain both Markdown and JSON
        
    Returns:
        The extracted markdown text if dual format is detected, None otherwise
    """
    if not text or not isinstance(text, str):
        return None
    
    # Check if response contains a JSON code block marker
    if '```json' not in text:
        return None
    
    # Pattern 1: Match markdown content before ```json ... ```
    # This handles multi-line markdown before the JSON block
    # Uses non-greedy match to stop at the first ```json
    pattern1 = r'(.+?)\s*```json\s*\n.*?```'
    match1 = re.search(pattern1, text, re.DOTALL)
    
    if match1:
        markdown_part = match1.group(1).strip()  # Group 1 is the markdown before the JSON block
        if markdown_part:
            logger.info("✓ Extracted markdown from dual-format response (Pattern 1)")
            return markdown_part
    
    # Pattern 2: More flexible - captures everything before ```json
    # Handles cases where there might be minimal whitespace
    pattern2 = r'(.+?)\s*```json'
    match2 = re.search(pattern2, text, re.DOTALL)
    if match2:
        markdown_part = match2.group(1).strip()
        if markdown_part:
            logger.info("✓ Extracted markdown from dual-format response (Pattern 2)")
            return markdown_part
    
    # Pattern 3: Split by ```json and take the first part
    parts = text.split('```json')
    if len(parts) > 1:
        markdown_part = parts[0].strip()
        if markdown_part:
            logger.info("✓ Extracted markdown from dual-format response (Pattern 3)")
            return markdown_part
    
    logger.debug("No markdown found before JSON code block - response may be JSON-only")
    return None

def safe_markdown_format(text: str) -> str:
    """
    Formats text for Telegram MarkdownV2, ensuring JSON is converted to readable markdown.
    
    For Analysis Agent responses in dual format (JSON + Markdown), extracts the markdown portion.
    For other responses, converts JSON to markdown format (backward compatible).
    
    Args:
        text: The response text that may be in dual format (JSON + Markdown) or JSON-only
        
    Returns:
        Formatted markdown text ready for Telegram MarkdownV2
    """
    if not text or not isinstance(text, str):
        return str(text)
    
    # First, check if this is a dual-format response (JSON code block + Markdown)
    # If so, extract just the markdown portion and use it directly
    markdown_text = extract_markdown_from_dual_format(text)
    if markdown_text:
        logger.info(f"Using extracted markdown from dual-format response (length: {len(markdown_text)} chars)")
        # We have markdown from dual format, format it for Telegram
        formatted_text = format_google_maps_links(markdown_text)
        formatted_text = format_youtube_links(formatted_text)
        
        try:
            telegram_formatted = telegramify_markdown.markdownify(formatted_text)
            logger.debug("Successfully formatted markdown for Telegram")
            return telegram_formatted
        except Exception as e:
            logger.warning(f"telegramify_markdown failed: {e}. Falling back to escape_markdown.")
            return escape_markdown(formatted_text)
    
    # Not dual format - fall back to existing behavior (convert JSON to markdown)
    logger.debug("No dual-format detected, converting JSON to markdown")
    # First, check if text contains JSON and convert it to markdown
    # This MUST happen first to remove all JSON syntax
    converted_text = json_to_markdown(text)
    
    # Verify no raw JSON structures remain (safety check)
    # Check multiple times if needed to catch nested or embedded JSON
    max_iterations = 3
    iteration = 0
    while iteration < max_iterations:
        # Check if there are JSON-like patterns that weren't converted
        json_pattern = re.search(r'\{[^}]*"[^"]*"[^}]*\}|\[[^\]]*"[^"]*"[^\]]*\]', converted_text)
        if json_pattern:
            logger.info(f"Found potential unconverted JSON on iteration {iteration + 1}, attempting additional conversion")
            prev_text = converted_text
            converted_text = json_to_markdown(converted_text)
            # If conversion didn't change anything, break to avoid infinite loop
            if prev_text == converted_text:
                logger.warning("JSON conversion didn't change text, stopping to avoid infinite loop")
                break
            iteration += 1
        else:
            break
    
    # Final check: if JSON still appears after all attempts, log it
    if '{' in converted_text and '"' in converted_text:
        # Check if it looks like JSON (has quotes and braces)
        json_like = re.search(r'\{[^}]*"[^"]*"[^}]*\}', converted_text)
        if json_like:
            logger.warning(f"Warning: JSON-like structure may still be present in converted text: {json_like.group(0)[:100]}...")
    
    # Apply specific link formatting
    formatted_text = format_google_maps_links(converted_text)
    formatted_text = format_youtube_links(formatted_text)

    try:
        # Finally, use telegramify_markdown for general MarkdownV2 escaping
        return telegramify_markdown.markdownify(formatted_text)
    except Exception as e:
        logger.warning(f"telegramify_markdown failed: {e}. Falling back to escape_markdown.")
        return escape_markdown(formatted_text)

def parse_command(text: str) -> str:
    return text.strip().split()[0].lower()

def split_message(text: str, max_length: int = 4000) -> list:
    """
    Splits a long text into chunks suitable for Telegram messages.
    """
    lines = text.splitlines(keepends=True)
    chunks = []
    current = ""
    for line in lines:
        if len(current) + len(line) > max_length:
            chunks.append(current)
            current = ""
        current += line
    if current:
        chunks.append(current)
    return chunks

# --- aiogram Handlers ---
@router.message(Command("start"))
async def cmd_start(message: aio_types.Message):
    await message.reply(safe_markdown_format("Welcome! I am your AI assistant. Send me a message or use /help to see what I can do."))

@router.message(Command("help"))
async def cmd_help(message: aio_types.Message):
    await message.reply(safe_markdown_format("You can chat with me or use commands like /start and /help. Just type your question!"))

@router.message(F.text.startswith("/") & ~F.text.in_(["/start", "/help"]))
async def handle_unknown_command(message: aio_types.Message) -> None:
    command: str = parse_command(getattr(message, "text", ""))
    await message.reply(safe_markdown_format(f"Unknown command: {command}\nType /help for available commands."))


# --- Attachment Handler ---

MAX_RAG_FILE_SIZE_MB = 10  # Example: 10 MB limit for Vertex RAG ManagedDB
MAX_RAG_FILE_SIZE_BYTES = MAX_RAG_FILE_SIZE_MB * 1024 * 1024

def isMessageAleadyHandled(message: aio_types.Message) -> bool:
    chat_id = message.chat.id
    message_id = message.message_id
    message_identifier = (chat_id, message_id)
    if message_identifier in processed_messages:
        logger.info(f"Skipping already processed message: {message_identifier}")
        return True # Do nothing, message already handled
    processed_messages.add(message_identifier)
    return False

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

    if(isMessageAleadyHandled(message=message)):
        return # Do nothing
    # Collect all attachments in a list of dicts: {file_id, file_name, file_size, type}
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
        await message.reply(safe_markdown_format("Unsupported attachment type."))
        return

    GCS_BUCKET = os.environ.get("GCS_BUCKET")
    if not GCS_BUCKET:
        await message.reply(safe_markdown_format("GCS_BUCKET environment variable not set."))
        return

    uploaded_gcs_urls = []
    for att in attachments:
        file_id = att['file_id']
        file_name = att['file_name']
        file_size = att['file_size']

        # Check file size against Vertex RAG ManagedDB limits
        if file_size and file_size > MAX_RAG_FILE_SIZE_BYTES:
            await message.reply(
                safe_markdown_format(
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
            await message.reply(safe_markdown_format(f"Failed to upload your document {file_name}: {e}"))

    if uploaded_gcs_urls:
        user_id = str(chat_id)
        user_query = getattr(message, 'caption', None) or getattr(message, 'text', None) or ""
        try:
            await message.reply(safe_markdown_format("Processing your documents..."))
            # Stream agent answers as they arrive
            agent_request = AgentRequest(
                    user_id=user_id,
                    user_query=user_query,
                    diagnosis_uris=uploaded_gcs_urls,
                    session_id=None, # Session ID will be handled by vertex_client
                    context_doc_uris=None,
                    property_address=None,
                    analysis_optional_agents=list(ANALYSIS_OPTIONAL_AGENT_ORDER),
                )
            async for answer_part in stream_agent_answers(agent_request):
                # Extract markdown from dual-format response if available, otherwise convert JSON to markdown
                answer_str = str(answer_part)
                formatted_answer = safe_markdown_format(answer_str)
                for part in split_message(formatted_answer):
                    await message.answer(part, parse_mode=ParseMode.MARKDOWN_V2)
        except Exception as e:
            logger.error(f"Failed to get an answer: {e}")
            await message.reply(safe_markdown_format(f"Oops!! Please try later: {str(e)}"))
    else:
        await message.reply(safe_markdown_format("No attachments were uploaded."))

@router.message(F.content_type == aio_types.ContentType.TEXT)
async def handle_text_message(message: aio_types.Message):
    chat_id = message.chat.id
    user_text = message.text
   
    if(isMessageAleadyHandled(message=message)):
        return # Do nothing

    await message.bot.send_chat_action(chat_id, ChatAction.TYPING)
    
    agent_request = AgentRequest(
        user_id=str(chat_id),
        user_query=user_text,
        session_id=None, # Session ID will be handled by vertex_client
        context_doc_uris=None,
        diagnosis_uris=None,
        property_address=None,
        analysis_optional_agents=list(ANALYSIS_OPTIONAL_AGENT_ORDER),
    )
    async for answer_part in stream_agent_answers(agent_request):
        # Extract markdown from dual-format response if available, otherwise convert JSON to markdown
        answer_str = str(answer_part)
        formatted_answer = safe_markdown_format(answer_str)
        for part in split_message(formatted_answer):
            await message.answer(part, parse_mode=ParseMode.MARKDOWN_V2)

@router.message()
async def handle_non_text(message: aio_types.Message):
    if message.content_type != aio_types.ContentType.TEXT:
        await message.reply(safe_markdown_format("Sorry, I can only process text messages at the moment."))


async def telegram_webhook_handler(request: Request):
    """
    Handles incoming Telegram webhook updates.
    """
    update_data = await request.json()
    telegram_update = aio_types.Update(**update_data)
    # Dispatch the update to aiogram in a background task
    # This allows the webhook to return immediately, preventing Telegram timeouts.
    asyncio.create_task(dp.feed_update(bot, telegram_update))
    return {"ok": True}


def get_telegram_webhook_endpoint():
    return telegram_webhook_handler


def start_telegram_bot_polling():
    asyncio.run(dp.start_polling(bot))
