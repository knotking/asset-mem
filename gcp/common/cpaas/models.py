"""
Pydantic models for Twilio messaging.

Supports:
- SMS (Short Message Service)
- MMS (Multimedia Messaging Service)
- Content Templates (Pre-approved templates)
- OTT (Over-the-Top: WhatsApp, Facebook Messenger, etc.)
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class MessageStatus(str, Enum):
    """Twilio message status values."""
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    UNDELIVERED = "undelivered"
    FAILED = "failed"
    RECEIVING = "receiving"
    RECEIVED = "received"
    ACCEPTED = "accepted"
    SCHEDULED = "scheduled"
    READ = "read"
    PARTIALLY_DELIVERED = "partially_delivered"
    CANCELED = "canceled"


class MessageDirection(str, Enum):
    """Message direction."""
    INBOUND = "inbound"
    OUTBOUND = "outbound-api"
    OUTBOUND_CALL = "outbound-call"
    OUTBOUND_REPLY = "outbound-reply"


class OTTChannel(str, Enum):
    """Over-the-Top messaging channels."""
    WHATSAPP = "whatsapp"
    FACEBOOK_MESSENGER = "messenger"
    GOOGLE_BUSINESS_MESSAGES = "gbm"
    
    
# ============================================================================
# Request Models (for sending messages)
# ============================================================================

class BaseMessage(BaseModel):
    """Base message model with common fields."""
    to: str = Field(..., description="Recipient phone number in E.164 format (+1234567890)")
    from_: Optional[str] = Field(None, alias="from", description="Sender phone number")
    body: Optional[str] = Field(None, description="Message body text (max 1600 chars for SMS)")
    status_callback: Optional[str] = Field(None, description="URL for status webhook callbacks")
    
    model_config = {"populate_by_name": True}
    
    @field_validator("to")
    @classmethod
    def validate_phone_number(cls, v: str) -> str:
        """Validate phone number format."""
        # Allow WhatsApp format (whatsapp:+1234567890)
        if v.startswith("whatsapp:"):
            return v
        # Basic E.164 validation
        if not v.startswith("+"):
            raise ValueError("Phone number must be in E.164 format (e.g., +1234567890)")
        return v


class SMSMessage(BaseMessage):
    """
    SMS (Short Message Service) message model.
    
    Example:
        sms = SMSMessage(
            to="+1234567890",
            body="Hello from Twilio!"
        )
    """
    messaging_service_sid: Optional[str] = Field(None, description="Messaging Service SID for sender pool")
    max_price: Optional[float] = Field(None, description="Maximum price in USD for message delivery")
    validity_period: Optional[int] = Field(None, ge=1, le=14400, description="Validity period in seconds (1-14400)")
    smart_encoded: Optional[bool] = Field(None, description="Enable smart encoding for Unicode")
    
    def to_twilio_params(self) -> Dict[str, Any]:
        """Convert to Twilio API parameters."""
        params = {"To": self.to}
        if self.from_:
            params["From"] = self.from_
        if self.body:
            params["Body"] = self.body
        if self.messaging_service_sid:
            params["MessagingServiceSid"] = self.messaging_service_sid
        if self.status_callback:
            params["StatusCallback"] = self.status_callback
        if self.max_price is not None:
            params["MaxPrice"] = str(self.max_price)
        if self.validity_period is not None:
            params["ValidityPeriod"] = str(self.validity_period)
        if self.smart_encoded is not None:
            params["SmartEncoded"] = str(self.smart_encoded).lower()
        return params


class MMSMessage(BaseMessage):
    """
    MMS (Multimedia Messaging Service) message model.
    
    Supports sending images, videos, audio, and other media files.
    
    Example:
        mms = MMSMessage(
            to="+1234567890",
            body="Check out this image!",
            media_urls=["https://example.com/image.jpg"]
        )
    """
    media_urls: List[str] = Field(
        default_factory=list,
        max_length=10,
        description="List of media URLs to attach (max 10)"
    )
    messaging_service_sid: Optional[str] = Field(None, description="Messaging Service SID")
    
    @field_validator("media_urls")
    @classmethod
    def validate_media_urls(cls, v: List[str]) -> List[str]:
        """Validate media URLs."""
        if len(v) > 10:
            raise ValueError("Maximum 10 media URLs allowed per MMS")
        for url in v:
            if not url.startswith(("http://", "https://")):
                raise ValueError(f"Invalid media URL: {url}")
        return v
    
    def to_twilio_params(self) -> Dict[str, Any]:
        """Convert to Twilio API parameters."""
        params = {"To": self.to}
        if self.from_:
            params["From"] = self.from_
        if self.body:
            params["Body"] = self.body
        if self.messaging_service_sid:
            params["MessagingServiceSid"] = self.messaging_service_sid
        if self.status_callback:
            params["StatusCallback"] = self.status_callback
        if self.media_urls:
            params["MediaUrl"] = self.media_urls
        return params


class TemplateMessage(BaseMessage):
    """
    Content Template message model for pre-approved templates.
    
    Used for WhatsApp Business API and other channels requiring template approval.
    
    Example:
        template = TemplateMessage(
            to="whatsapp:+1234567890",
            content_sid="HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            content_variables={"1": "John", "2": "12345"}
        )
    """
    content_sid: str = Field(..., description="Content Template SID (starts with 'HX')")
    content_variables: Optional[Dict[str, str]] = Field(
        None, 
        description="Template variables as key-value pairs"
    )
    messaging_service_sid: Optional[str] = Field(None, description="Messaging Service SID")
    
    @field_validator("content_sid")
    @classmethod
    def validate_content_sid(cls, v: str) -> str:
        """Validate Content SID format."""
        if not v.startswith("HX"):
            raise ValueError("Content SID must start with 'HX'")
        return v
    
    def to_twilio_params(self) -> Dict[str, Any]:
        """Convert to Twilio API parameters."""
        import json
        params = {"To": self.to, "ContentSid": self.content_sid}
        if self.from_:
            params["From"] = self.from_
        if self.messaging_service_sid:
            params["MessagingServiceSid"] = self.messaging_service_sid
        if self.status_callback:
            params["StatusCallback"] = self.status_callback
        if self.content_variables:
            params["ContentVariables"] = json.dumps(self.content_variables)
        return params


class OTTMessage(BaseMessage):
    """
    OTT (Over-the-Top) message model for WhatsApp, Facebook Messenger, etc.
    
    Example (WhatsApp):
        msg = OTTMessage(
            to="whatsapp:+1234567890",
            channel=OTTChannel.WHATSAPP,
            body="Hello via WhatsApp!"
        )
    """
    channel: OTTChannel = Field(..., description="OTT channel to use")
    media_urls: Optional[List[str]] = Field(None, description="Media URLs for rich messaging")
    content_sid: Optional[str] = Field(None, description="Content Template SID for templates")
    content_variables: Optional[Dict[str, str]] = Field(None, description="Template variables")
    persistent_action: Optional[List[str]] = Field(
        None, 
        description="Persistent menu actions"
    )
    
    @field_validator("to")
    @classmethod
    def validate_ott_recipient(cls, v: str, info) -> str:
        """Validate OTT recipient format."""
        # For WhatsApp, prepend 'whatsapp:' if not present
        return v
    
    def to_twilio_params(self) -> Dict[str, Any]:
        """Convert to Twilio API parameters."""
        import json
        
        # Format recipient for OTT channel
        to = self.to
        if self.channel == OTTChannel.WHATSAPP and not to.startswith("whatsapp:"):
            to = f"whatsapp:{to}"
            
        params = {"To": to}
        
        if self.from_:
            from_addr = self.from_
            if self.channel == OTTChannel.WHATSAPP and not from_addr.startswith("whatsapp:"):
                from_addr = f"whatsapp:{from_addr}"
            params["From"] = from_addr
            
        if self.body:
            params["Body"] = self.body
        if self.status_callback:
            params["StatusCallback"] = self.status_callback
        if self.media_urls:
            params["MediaUrl"] = self.media_urls
        if self.content_sid:
            params["ContentSid"] = self.content_sid
        if self.content_variables:
            params["ContentVariables"] = json.dumps(self.content_variables)
        if self.persistent_action:
            params["PersistentAction"] = self.persistent_action
            
        return params


# ============================================================================
# Response Models (from Twilio API)
# ============================================================================

class MessageResponse(BaseModel):
    """
    Response model for Twilio message operations.
    
    Represents the response from sending or retrieving a message.
    """
    sid: str = Field(..., description="Unique message SID")
    account_sid: str = Field(..., description="Account SID")
    messaging_service_sid: Optional[str] = Field(None, description="Messaging Service SID")
    to: str = Field(..., description="Recipient phone number")
    from_: Optional[str] = Field(None, alias="from", description="Sender phone number")
    body: Optional[str] = Field(None, description="Message body")
    status: MessageStatus = Field(..., description="Message status")
    direction: Optional[MessageDirection] = Field(None, description="Message direction")
    date_created: Optional[datetime] = Field(None, description="Creation timestamp")
    date_sent: Optional[datetime] = Field(None, description="Sent timestamp")
    date_updated: Optional[datetime] = Field(None, description="Last update timestamp")
    price: Optional[str] = Field(None, description="Message price")
    price_unit: Optional[str] = Field(None, description="Price currency")
    error_code: Optional[int] = Field(None, description="Error code if failed")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    num_segments: Optional[int] = Field(None, description="Number of message segments")
    num_media: Optional[int] = Field(None, description="Number of media attachments")
    uri: Optional[str] = Field(None, description="API URI for this message")
    
    model_config = {"populate_by_name": True}
    
    @classmethod
    def from_twilio_response(cls, data: Dict[str, Any]) -> "MessageResponse":
        """Create MessageResponse from Twilio API response."""
        return cls(
            sid=data.get("sid", ""),
            account_sid=data.get("account_sid", ""),
            messaging_service_sid=data.get("messaging_service_sid"),
            to=data.get("to", ""),
            from_=data.get("from"),
            body=data.get("body"),
            status=data.get("status", "queued"),
            direction=data.get("direction"),
            date_created=data.get("date_created"),
            date_sent=data.get("date_sent"),
            date_updated=data.get("date_updated"),
            price=data.get("price"),
            price_unit=data.get("price_unit"),
            error_code=data.get("error_code"),
            error_message=data.get("error_message"),
            num_segments=data.get("num_segments"),
            num_media=data.get("num_media"),
            uri=data.get("uri"),
        )


class MessageListResponse(BaseModel):
    """Response model for listing messages."""
    messages: List[MessageResponse] = Field(default_factory=list)
    page: int = Field(default=0)
    page_size: int = Field(default=50)
    total_count: Optional[int] = Field(None)
    next_page_uri: Optional[str] = Field(None)
    previous_page_uri: Optional[str] = Field(None)


class MediaResource(BaseModel):
    """Media resource attached to MMS/OTT messages."""
    sid: str = Field(..., description="Media SID")
    account_sid: str = Field(..., description="Account SID")
    parent_sid: str = Field(..., description="Parent message SID")
    content_type: str = Field(..., description="MIME type")
    date_created: Optional[datetime] = Field(None)
    date_updated: Optional[datetime] = Field(None)
    uri: str = Field(..., description="API URI for this media")


class ContentTemplate(BaseModel):
    """Content Template resource."""
    sid: str = Field(..., description="Template SID (starts with HX)")
    account_sid: str = Field(..., description="Account SID")
    friendly_name: str = Field(..., description="Template friendly name")
    language: str = Field(..., description="Template language code")
    variables: Optional[Dict[str, Any]] = Field(None, description="Template variables schema")
    types: Optional[Dict[str, Any]] = Field(None, description="Template type configuration")
    date_created: Optional[datetime] = Field(None)
    date_updated: Optional[datetime] = Field(None)
    url: Optional[str] = Field(None, description="API URL for this template")


class ContentTemplateListResponse(BaseModel):
    """Response model for listing content templates."""
    contents: List[ContentTemplate] = Field(default_factory=list)
    meta: Optional[Dict[str, Any]] = Field(None)

