"""
Twilio CPaaS Client Module.

Provides async messaging capabilities via Twilio for:
- SMS (Short Message Service)
- MMS (Multimedia Messaging Service)
- Content Templates (Pre-approved templates)
- OTT (Over-the-Top messaging: WhatsApp, Facebook Messenger, etc.)
"""

from .client import TwilioClient, TwilioClientError
from .config import TwilioConfig
from .models import (
    # Request models
    SMSMessage,
    MMSMessage,
    TemplateMessage,
    OTTMessage,
    # Response models
    MessageResponse,
    MessageListResponse,
    MediaResource,
    ContentTemplate,
    ContentTemplateListResponse,
    # Enums
    MessageStatus,
    MessageDirection,
    OTTChannel,
)

__all__ = [
    # Client
    "TwilioClient",
    "TwilioClientError",
    "TwilioConfig",
    # Request models
    "SMSMessage",
    "MMSMessage",
    "TemplateMessage",
    "OTTMessage",
    # Response models
    "MessageResponse",
    "MessageListResponse",
    "MediaResource",
    "ContentTemplate",
    "ContentTemplateListResponse",
    # Enums
    "MessageStatus",
    "MessageDirection",
    "OTTChannel",
]

