"""
Pydantic models for Infobip messaging.

Supports:
- SMS (Short Message Service)
- MMS (Multimedia Messaging Service)
- WhatsApp (text, template, media)
- Viber (text with optional buttons)
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ============================================================================
# Enums
# ============================================================================

class InfobipMessageStatus(str, Enum):
    """Infobip message status values."""
    PENDING = "PENDING"
    UNDELIVERABLE = "UNDELIVERABLE"
    DELIVERED = "DELIVERED"
    EXPIRED = "EXPIRED"
    REJECTED = "REJECTED"
    PENDING_ENROUTE = "PENDING_ENROUTE"
    PENDING_ACCEPTED = "PENDING_ACCEPTED"
    PENDING_WAITING = "PENDING_WAITING"


class InfobipChannel(str, Enum):
    """Infobip messaging channels."""
    SMS = "sms"
    MMS = "mms"
    WHATSAPP = "whatsapp"
    VIBER = "viber"
    RCS = "rcs"
    EMAIL = "email"


# ============================================================================
# Request Models
# ============================================================================

class InfobipDestination(BaseModel):
    """Infobip message destination."""
    to: str = Field(..., description="Recipient phone number")
    message_id: Optional[str] = Field(None, alias="messageId", description="Custom message ID")
    
    model_config = {"populate_by_name": True}


class InfobipSMSMessage(BaseModel):
    """
    Infobip SMS message model for sending.
    
    Example:
        sms = InfobipSMSMessage(
            destinations=[InfobipDestination(to="+1234567890")],
            text="Hello from Infobip!"
        )
    """
    destinations: List[InfobipDestination] = Field(
        ..., 
        description="List of message destinations"
    )
    from_: Optional[str] = Field(None, alias="from", description="Sender ID")
    text: str = Field(..., description="Message text content")
    flash: Optional[bool] = Field(None, description="Send as flash SMS")
    transliteration: Optional[str] = Field(None, description="Transliteration type")
    language_code: Optional[str] = Field(None, alias="languageCode", description="Language code")
    notify_url: Optional[str] = Field(None, alias="notifyUrl", description="Delivery report webhook URL")
    notify_content_type: Optional[str] = Field(
        None, 
        alias="notifyContentType", 
        description="Content type for notify webhook"
    )
    callback_data: Optional[str] = Field(None, alias="callbackData", description="Custom callback data")
    validity_period: Optional[int] = Field(
        None, 
        alias="validityPeriod", 
        description="Message validity period in minutes"
    )
    send_at: Optional[str] = Field(None, alias="sendAt", description="Scheduled send time (ISO 8601)")
    
    model_config = {"populate_by_name": True}
    
    def to_infobip_params(self) -> Dict[str, Any]:
        """Convert to Infobip API request format."""
        message = {
            "destinations": [
                {"to": d.to, **({"messageId": d.message_id} if d.message_id else {})}
                for d in self.destinations
            ],
            "text": self.text,
        }
        
        if self.from_:
            message["from"] = self.from_
        if self.flash is not None:
            message["flash"] = self.flash
        if self.transliteration:
            message["transliteration"] = self.transliteration
        if self.language_code:
            message["languageCode"] = self.language_code
        if self.notify_url:
            message["notifyUrl"] = self.notify_url
        if self.notify_content_type:
            message["notifyContentType"] = self.notify_content_type
        if self.callback_data:
            message["callbackData"] = self.callback_data
        if self.validity_period is not None:
            message["validityPeriod"] = self.validity_period
        if self.send_at:
            message["sendAt"] = self.send_at
            
        return {"messages": [message]}


class InfobipMMSContent(BaseModel):
    """MMS content item for Infobip."""
    content_type: str = Field(..., alias="contentType", description="MIME type")
    content_id: str = Field(..., alias="contentId", description="Content identifier")
    content_url: Optional[str] = Field(None, alias="contentUrl", description="URL of media content")
    content_base64: Optional[str] = Field(None, alias="contentBase64", description="Base64 encoded content")
    text: Optional[str] = Field(None, description="Text content (for text/plain)")
    smil: Optional[str] = Field(None, description="SMIL content")
    
    model_config = {"populate_by_name": True}


class InfobipMMSMessage(BaseModel):
    """
    Infobip MMS message model.
    
    Example:
        mms = InfobipMMSMessage(
            destinations=[InfobipDestination(to="+1234567890")],
            content=[
                InfobipMMSContent(
                    content_type="image/jpeg",
                    content_id="image1",
                    content_url="https://example.com/image.jpg"
                )
            ],
            text="Check out this image!"
        )
    """
    destinations: List[InfobipDestination] = Field(..., description="List of destinations")
    from_: Optional[str] = Field(None, alias="from", description="Sender ID")
    text: Optional[str] = Field(None, description="Text part of MMS")
    content: List[InfobipMMSContent] = Field(default_factory=list, description="Media content items")
    notify_url: Optional[str] = Field(None, alias="notifyUrl", description="Delivery report webhook URL")
    callback_data: Optional[str] = Field(None, alias="callbackData", description="Custom callback data")
    
    model_config = {"populate_by_name": True}
    
    def to_infobip_params(self) -> Dict[str, Any]:
        """Convert to Infobip MMS API request format."""
        message = {
            "destinations": [
                {"to": d.to, **({"messageId": d.message_id} if d.message_id else {})}
                for d in self.destinations
            ],
        }
        
        if self.from_:
            message["from"] = self.from_
        if self.text:
            message["text"] = self.text
        if self.content:
            message["content"] = [
                {
                    "contentType": c.content_type,
                    "contentId": c.content_id,
                    **({"contentUrl": c.content_url} if c.content_url else {}),
                    **({"contentBase64": c.content_base64} if c.content_base64 else {}),
                    **({"text": c.text} if c.text else {}),
                    **({"smil": c.smil} if c.smil else {}),
                }
                for c in self.content
            ]
        if self.notify_url:
            message["notifyUrl"] = self.notify_url
        if self.callback_data:
            message["callbackData"] = self.callback_data
            
        return message


class InfobipWhatsAppTextMessage(BaseModel):
    """
    Infobip WhatsApp text message model.
    
    Example:
        msg = InfobipWhatsAppTextMessage(
            to="+1234567890",
            text="Hello via WhatsApp!"
        )
    """
    to: str = Field(..., alias="to", description="Recipient WhatsApp number")
    from_: Optional[str] = Field(None, alias="from", description="Sender WhatsApp number")
    message_id: Optional[str] = Field(None, alias="messageId", description="Custom message ID")
    text: str = Field(..., description="Message text content")
    preview_url: Optional[bool] = Field(None, alias="previewUrl", description="Enable URL preview")
    notify_url: Optional[str] = Field(None, alias="notifyUrl", description="Delivery report webhook URL")
    callback_data: Optional[str] = Field(None, alias="callbackData", description="Custom callback data")
    
    model_config = {"populate_by_name": True}
    
    def to_infobip_params(self) -> Dict[str, Any]:
        """Convert to Infobip WhatsApp API request format."""
        content = {"text": self.text}
        if self.preview_url is not None:
            content["previewUrl"] = self.preview_url
            
        message = {
            "to": self.to,
            "content": content,
        }
        
        if self.from_:
            message["from"] = self.from_
        if self.message_id:
            message["messageId"] = self.message_id
        if self.notify_url:
            message["notifyUrl"] = self.notify_url
        if self.callback_data:
            message["callbackData"] = self.callback_data
            
        return message


class InfobipWhatsAppTemplateMessage(BaseModel):
    """
    Infobip WhatsApp template message model.
    
    Example:
        msg = InfobipWhatsAppTemplateMessage(
            to="+1234567890",
            template_name="order_confirmation",
            template_data={"body": {"placeholders": ["John", "12345"]}}
        )
    """
    to: str = Field(..., description="Recipient WhatsApp number")
    from_: Optional[str] = Field(None, alias="from", description="Sender WhatsApp number")
    message_id: Optional[str] = Field(None, alias="messageId", description="Custom message ID")
    template_name: str = Field(..., alias="templateName", description="Template name")
    template_data: Dict[str, Any] = Field(..., alias="templateData", description="Template data/variables")
    language: str = Field(default="en", description="Template language code")
    notify_url: Optional[str] = Field(None, alias="notifyUrl", description="Delivery report webhook URL")
    callback_data: Optional[str] = Field(None, alias="callbackData", description="Custom callback data")
    
    model_config = {"populate_by_name": True}
    
    def to_infobip_params(self) -> Dict[str, Any]:
        """Convert to Infobip WhatsApp template API request format."""
        message = {
            "to": self.to,
            "content": {
                "templateName": self.template_name,
                "templateData": self.template_data,
                "language": self.language,
            },
        }
        
        if self.from_:
            message["from"] = self.from_
        if self.message_id:
            message["messageId"] = self.message_id
        if self.notify_url:
            message["notifyUrl"] = self.notify_url
        if self.callback_data:
            message["callbackData"] = self.callback_data
            
        return message


class InfobipWhatsAppMediaMessage(BaseModel):
    """
    Infobip WhatsApp media message model.
    
    Supports: image, video, audio, document, sticker.
    
    Example:
        msg = InfobipWhatsAppMediaMessage(
            to="+1234567890",
            media_type="image",
            media_url="https://example.com/image.jpg",
            caption="Check this out!"
        )
    """
    to: str = Field(..., description="Recipient WhatsApp number")
    from_: Optional[str] = Field(None, alias="from", description="Sender WhatsApp number")
    message_id: Optional[str] = Field(None, alias="messageId", description="Custom message ID")
    media_type: str = Field(..., alias="mediaType", description="Type: image, video, audio, document, sticker")
    media_url: str = Field(..., alias="mediaUrl", description="URL of media file")
    caption: Optional[str] = Field(None, description="Media caption (for image/video/document)")
    filename: Optional[str] = Field(None, description="Filename (for document)")
    notify_url: Optional[str] = Field(None, alias="notifyUrl", description="Delivery report webhook URL")
    callback_data: Optional[str] = Field(None, alias="callbackData", description="Custom callback data")
    
    model_config = {"populate_by_name": True}
    
    def to_infobip_params(self) -> Dict[str, Any]:
        """Convert to Infobip WhatsApp media API request format."""
        content = {
            "mediaUrl": self.media_url,
        }
        if self.caption:
            content["caption"] = self.caption
        if self.filename:
            content["filename"] = self.filename
            
        message = {
            "to": self.to,
            "content": content,
        }
        
        if self.from_:
            message["from"] = self.from_
        if self.message_id:
            message["messageId"] = self.message_id
        if self.notify_url:
            message["notifyUrl"] = self.notify_url
        if self.callback_data:
            message["callbackData"] = self.callback_data
            
        return message


class InfobipViberMessage(BaseModel):
    """
    Infobip Viber message model.
    
    Example:
        msg = InfobipViberMessage(
            to="+1234567890",
            text="Hello via Viber!"
        )
    """
    to: str = Field(..., description="Recipient phone number")
    from_: Optional[str] = Field(None, alias="from", description="Sender ID (Viber service)")
    message_id: Optional[str] = Field(None, alias="messageId", description="Custom message ID")
    text: Optional[str] = Field(None, description="Message text content")
    image_url: Optional[str] = Field(None, alias="imageUrl", description="Image URL")
    button_url: Optional[str] = Field(None, alias="buttonUrl", description="Button URL")
    button_text: Optional[str] = Field(None, alias="buttonText", description="Button text")
    validity_period: Optional[int] = Field(
        None, 
        alias="validityPeriod", 
        description="Message validity period in seconds"
    )
    notify_url: Optional[str] = Field(None, alias="notifyUrl", description="Delivery report webhook URL")
    callback_data: Optional[str] = Field(None, alias="callbackData", description="Custom callback data")
    
    model_config = {"populate_by_name": True}
    
    def to_infobip_params(self) -> Dict[str, Any]:
        """Convert to Infobip Viber API request format."""
        message = {
            "to": self.to,
        }
        
        if self.from_:
            message["from"] = self.from_
        if self.message_id:
            message["messageId"] = self.message_id
        if self.text:
            message["text"] = self.text
        if self.image_url:
            message["imageUrl"] = self.image_url
        if self.button_url:
            message["buttonUrl"] = self.button_url
        if self.button_text:
            message["buttonText"] = self.button_text
        if self.validity_period is not None:
            message["validityPeriod"] = self.validity_period
        if self.notify_url:
            message["notifyUrl"] = self.notify_url
        if self.callback_data:
            message["callbackData"] = self.callback_data
            
        return {"messages": [message]}


# ============================================================================
# Response Models
# ============================================================================

class InfobipMessageStatusDetail(BaseModel):
    """Infobip message status details."""
    group_id: int = Field(..., alias="groupId")
    group_name: str = Field(..., alias="groupName")
    id: int = Field(...)
    name: str = Field(...)
    description: Optional[str] = Field(None)
    
    model_config = {"populate_by_name": True}


class InfobipPrice(BaseModel):
    """Infobip message price information."""
    price_per_message: float = Field(..., alias="pricePerMessage")
    currency: str = Field(...)
    
    model_config = {"populate_by_name": True}


class InfobipMessageResult(BaseModel):
    """Single message result from Infobip API."""
    message_id: str = Field(..., alias="messageId", description="Infobip message ID")
    to: str = Field(..., description="Recipient number")
    status: InfobipMessageStatusDetail = Field(..., description="Message status")
    sms_count: Optional[int] = Field(None, alias="smsCount", description="SMS segment count")
    
    model_config = {"populate_by_name": True}


class InfobipSendResponse(BaseModel):
    """
    Response model for Infobip send operations.
    """
    bulk_id: Optional[str] = Field(None, alias="bulkId", description="Bulk message ID")
    messages: List[InfobipMessageResult] = Field(default_factory=list, description="Individual message results")
    
    model_config = {"populate_by_name": True}
    
    @classmethod
    def from_infobip_response(cls, data: Dict[str, Any]) -> "InfobipSendResponse":
        """Create InfobipSendResponse from API response."""
        messages = []
        for msg in data.get("messages", []):
            status_data = msg.get("status", {})
            messages.append(
                InfobipMessageResult(
                    message_id=msg.get("messageId", ""),
                    to=msg.get("to", ""),
                    status=InfobipMessageStatusDetail(
                        group_id=status_data.get("groupId", 0),
                        group_name=status_data.get("groupName", ""),
                        id=status_data.get("id", 0),
                        name=status_data.get("name", ""),
                        description=status_data.get("description"),
                    ),
                    sms_count=msg.get("smsCount"),
                )
            )
        
        return cls(
            bulk_id=data.get("bulkId"),
            messages=messages,
        )


class InfobipDeliveryReport(BaseModel):
    """Infobip delivery report for a single message."""
    message_id: str = Field(..., alias="messageId")
    to: str = Field(...)
    sent_at: Optional[str] = Field(None, alias="sentAt")
    done_at: Optional[str] = Field(None, alias="doneAt")
    sms_count: Optional[int] = Field(None, alias="smsCount")
    mcc_mnc: Optional[str] = Field(None, alias="mccMnc")
    price: Optional[InfobipPrice] = Field(None)
    status: InfobipMessageStatusDetail = Field(...)
    error: Optional[InfobipMessageStatusDetail] = Field(None)
    callback_data: Optional[str] = Field(None, alias="callbackData")
    
    model_config = {"populate_by_name": True}


class InfobipDeliveryReportResponse(BaseModel):
    """Response model for delivery reports."""
    results: List[InfobipDeliveryReport] = Field(default_factory=list)
    
    @classmethod
    def from_infobip_response(cls, data: Dict[str, Any]) -> "InfobipDeliveryReportResponse":
        """Create from API response."""
        results = []
        for r in data.get("results", []):
            status_data = r.get("status", {})
            error_data = r.get("error")
            price_data = r.get("price")
            
            results.append(
                InfobipDeliveryReport(
                    message_id=r.get("messageId", ""),
                    to=r.get("to", ""),
                    sent_at=r.get("sentAt"),
                    done_at=r.get("doneAt"),
                    sms_count=r.get("smsCount"),
                    mcc_mnc=r.get("mccMnc"),
                    price=InfobipPrice(
                        price_per_message=price_data.get("pricePerMessage", 0),
                        currency=price_data.get("currency", ""),
                    ) if price_data else None,
                    status=InfobipMessageStatusDetail(
                        group_id=status_data.get("groupId", 0),
                        group_name=status_data.get("groupName", ""),
                        id=status_data.get("id", 0),
                        name=status_data.get("name", ""),
                        description=status_data.get("description"),
                    ),
                    error=InfobipMessageStatusDetail(
                        group_id=error_data.get("groupId", 0),
                        group_name=error_data.get("groupName", ""),
                        id=error_data.get("id", 0),
                        name=error_data.get("name", ""),
                        description=error_data.get("description"),
                    ) if error_data else None,
                    callback_data=r.get("callbackData"),
                )
            )
        
        return cls(results=results)

