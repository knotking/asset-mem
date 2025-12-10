"""
Constants Module

Centralized constants and magic numbers used throughout the application.
"""

# File Size Limits
MAX_RAG_FILE_SIZE_MB = 10
MAX_RAG_FILE_SIZE_BYTES = MAX_RAG_FILE_SIZE_MB * 1024 * 1024

# Telegram Message Limits
MAX_TELEGRAM_MESSAGE_LENGTH = 4000

# HTTP Status Codes
HTTP_OK = 200
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_FORBIDDEN = 403
HTTP_NOT_FOUND = 404
HTTP_INTERNAL_SERVER_ERROR = 500

# Retry Configuration
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 1

# Timeout Configuration (seconds)
DEFAULT_TIMEOUT = 30
VERTEX_AI_TIMEOUT = 60
GCS_UPLOAD_TIMEOUT = 300

# Health Check Configuration
HEALTH_CHECK_TIMEOUT = 5
