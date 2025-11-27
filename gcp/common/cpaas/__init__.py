"""
CPaaS - Communication Platform as a Service

Twilio integration module for sending and receiving messages via:
- SMS (Short Message Service)
- MMS (Multimedia Messaging Service)
- Content Templates (Pre-approved message templates)
- OTT (Over-the-Top messaging: WhatsApp, Facebook Messenger, etc.)
"""

from .twilio_client import TwilioClient
from .models import (
    SMSMessage,
    MMSMessage,
    TemplateMessage,
    OTTMessage,
    MessageResponse,
    MessageStatus,
    MessageDirection,
    OTTChannel,
)
from .config import TwilioConfig

__all__ = [
    "TwilioClient",
    "TwilioConfig",
    "SMSMessage",
    "MMSMessage",
    "TemplateMessage",
    "OTTMessage",
    "MessageResponse",
    "MessageStatus",
    "MessageDirection",
    "OTTChannel",
]

