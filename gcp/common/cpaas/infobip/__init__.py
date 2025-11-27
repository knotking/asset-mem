"""
Infobip CPaaS Client Module.

Provides async messaging capabilities via Infobip for:
- SMS (Short Message Service)
- MMS (Multimedia Messaging Service)
- WhatsApp (text, template, media messages)
- Viber (text messages with buttons)
"""

from .client import InfobipClient, InfobipClientError
from .config import InfobipConfig
from .models import (
    # Request models
    InfobipSMSMessage,
    InfobipMMSMessage,
    InfobipMMSContent,
    InfobipWhatsAppTextMessage,
    InfobipWhatsAppTemplateMessage,
    InfobipWhatsAppMediaMessage,
    InfobipViberMessage,
    InfobipDestination,
    # Response models
    InfobipSendResponse,
    InfobipMessageResult,
    InfobipMessageStatusDetail,
    InfobipDeliveryReport,
    InfobipDeliveryReportResponse,
    InfobipPrice,
    # Enums
    InfobipMessageStatus,
    InfobipChannel,
)

__all__ = [
    # Client
    "InfobipClient",
    "InfobipClientError",
    "InfobipConfig",
    # Request models
    "InfobipSMSMessage",
    "InfobipMMSMessage",
    "InfobipMMSContent",
    "InfobipWhatsAppTextMessage",
    "InfobipWhatsAppTemplateMessage",
    "InfobipWhatsAppMediaMessage",
    "InfobipViberMessage",
    "InfobipDestination",
    # Response models
    "InfobipSendResponse",
    "InfobipMessageResult",
    "InfobipMessageStatusDetail",
    "InfobipDeliveryReport",
    "InfobipDeliveryReportResponse",
    "InfobipPrice",
    # Enums
    "InfobipMessageStatus",
    "InfobipChannel",
]

