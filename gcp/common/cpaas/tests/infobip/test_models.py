"""Unit tests for Infobip message models."""

import pytest

from cpaas.infobip import (
    InfobipSMSMessage,
    InfobipMMSMessage,
    InfobipMMSContent,
    InfobipWhatsAppTextMessage,
    InfobipWhatsAppTemplateMessage,
    InfobipWhatsAppMediaMessage,
    InfobipViberMessage,
    InfobipDestination,
    InfobipSendResponse,
    InfobipMessageStatus,
    InfobipChannel,
)


class TestInfobipDestination:
    """Tests for InfobipDestination model."""

    def test_valid_destination(self):
        """Test creating a valid destination."""
        dest = InfobipDestination(to="+1234567890")
        assert dest.to == "+1234567890"
        assert dest.message_id is None

    def test_destination_with_message_id(self):
        """Test destination with custom message ID."""
        dest = InfobipDestination(to="+1234567890", message_id="custom-123")
        assert dest.message_id == "custom-123"


class TestInfobipSMSMessage:
    """Tests for InfobipSMSMessage model."""

    def test_valid_sms_message(self):
        """Test creating a valid SMS message."""
        sms = InfobipSMSMessage(
            destinations=[InfobipDestination(to="+1234567890")],
            text="Hello, World!",
        )
        assert len(sms.destinations) == 1
        assert sms.text == "Hello, World!"

    def test_sms_with_all_fields(self):
        """Test SMS message with all optional fields."""
        sms = InfobipSMSMessage(
            destinations=[InfobipDestination(to="+1234567890")],
            text="Test message",
            from_="MySender",
            flash=True,
            transliteration="TURKISH",
            notify_url="https://example.com/callback",
            validity_period=60,
        )
        
        assert sms.from_ == "MySender"
        assert sms.flash is True
        assert sms.transliteration == "TURKISH"
        assert sms.notify_url == "https://example.com/callback"
        assert sms.validity_period == 60

    def test_sms_to_infobip_params(self):
        """Test conversion to Infobip API parameters."""
        sms = InfobipSMSMessage(
            destinations=[
                InfobipDestination(to="+1234567890"),
                InfobipDestination(to="+0987654321", message_id="msg-2"),
            ],
            text="Hello!",
            from_="MySender",
        )
        
        params = sms.to_infobip_params()
        
        assert "messages" in params
        assert len(params["messages"]) == 1
        message = params["messages"][0]
        assert len(message["destinations"]) == 2
        assert message["text"] == "Hello!"
        assert message["from"] == "MySender"
        assert message["destinations"][1]["messageId"] == "msg-2"

    def test_sms_to_infobip_params_minimal(self):
        """Test minimal params only include required fields."""
        sms = InfobipSMSMessage(
            destinations=[InfobipDestination(to="+1234567890")],
            text="Test",
        )
        params = sms.to_infobip_params()
        
        message = params["messages"][0]
        assert "destinations" in message
        assert "text" in message
        assert "from" not in message
        assert "flash" not in message


class TestInfobipMMSMessage:
    """Tests for InfobipMMSMessage model."""

    def test_valid_mms_message(self):
        """Test creating a valid MMS message."""
        mms = InfobipMMSMessage(
            destinations=[InfobipDestination(to="+1234567890")],
            text="Check this out!",
            content=[
                InfobipMMSContent(
                    content_type="image/jpeg",
                    content_id="img1",
                    content_url="https://example.com/image.jpg",
                )
            ],
        )
        
        assert len(mms.destinations) == 1
        assert len(mms.content) == 1
        assert mms.content[0].content_type == "image/jpeg"

    def test_mms_to_infobip_params(self):
        """Test MMS conversion to Infobip params."""
        mms = InfobipMMSMessage(
            destinations=[InfobipDestination(to="+1234567890")],
            text="Check this!",
            content=[
                InfobipMMSContent(
                    content_type="image/jpeg",
                    content_id="img1",
                    content_url="https://example.com/img.jpg",
                )
            ],
        )
        
        params = mms.to_infobip_params()
        
        assert params["destinations"][0]["to"] == "+1234567890"
        assert params["text"] == "Check this!"
        assert len(params["content"]) == 1
        assert params["content"][0]["contentType"] == "image/jpeg"


class TestInfobipWhatsAppTextMessage:
    """Tests for InfobipWhatsAppTextMessage model."""

    def test_valid_whatsapp_message(self):
        """Test creating a valid WhatsApp text message."""
        msg = InfobipWhatsAppTextMessage(
            to="+1234567890",
            text="Hello via WhatsApp!",
        )
        
        assert msg.to == "+1234567890"
        assert msg.text == "Hello via WhatsApp!"

    def test_whatsapp_with_all_fields(self):
        """Test WhatsApp message with all optional fields."""
        msg = InfobipWhatsAppTextMessage(
            to="+1234567890",
            text="Test message",
            from_="+0987654321",
            message_id="custom-id",
            preview_url=True,
            notify_url="https://example.com/callback",
        )
        
        assert msg.from_ == "+0987654321"
        assert msg.message_id == "custom-id"
        assert msg.preview_url is True

    def test_whatsapp_to_infobip_params(self):
        """Test WhatsApp conversion to Infobip params."""
        msg = InfobipWhatsAppTextMessage(
            to="+1234567890",
            text="Hello!",
            from_="+0987654321",
            preview_url=True,
        )
        
        params = msg.to_infobip_params()
        
        assert params["to"] == "+1234567890"
        assert params["from"] == "+0987654321"
        assert params["content"]["text"] == "Hello!"
        assert params["content"]["previewUrl"] is True


class TestInfobipWhatsAppTemplateMessage:
    """Tests for InfobipWhatsAppTemplateMessage model."""

    def test_valid_template_message(self):
        """Test creating a valid WhatsApp template message."""
        msg = InfobipWhatsAppTemplateMessage(
            to="+1234567890",
            template_name="order_confirmation",
            template_data={"body": {"placeholders": ["John", "12345"]}},
        )
        
        assert msg.template_name == "order_confirmation"
        assert msg.template_data["body"]["placeholders"][0] == "John"

    def test_template_to_infobip_params(self):
        """Test template conversion to Infobip params."""
        msg = InfobipWhatsAppTemplateMessage(
            to="+1234567890",
            template_name="order_confirmation",
            template_data={"body": {"placeholders": ["John"]}},
            language="en",
        )
        
        params = msg.to_infobip_params()
        
        assert params["to"] == "+1234567890"
        assert params["content"]["templateName"] == "order_confirmation"
        assert params["content"]["language"] == "en"


class TestInfobipWhatsAppMediaMessage:
    """Tests for InfobipWhatsAppMediaMessage model."""

    def test_valid_media_message(self):
        """Test creating a valid WhatsApp media message."""
        msg = InfobipWhatsAppMediaMessage(
            to="+1234567890",
            media_type="image",
            media_url="https://example.com/image.jpg",
            caption="Check this out!",
        )
        
        assert msg.media_type == "image"
        assert msg.media_url == "https://example.com/image.jpg"
        assert msg.caption == "Check this out!"

    def test_media_to_infobip_params(self):
        """Test media conversion to Infobip params."""
        msg = InfobipWhatsAppMediaMessage(
            to="+1234567890",
            media_type="document",
            media_url="https://example.com/doc.pdf",
            filename="document.pdf",
        )
        
        params = msg.to_infobip_params()
        
        assert params["to"] == "+1234567890"
        assert params["content"]["mediaUrl"] == "https://example.com/doc.pdf"
        assert params["content"]["filename"] == "document.pdf"


class TestInfobipViberMessage:
    """Tests for InfobipViberMessage model."""

    def test_valid_viber_message(self):
        """Test creating a valid Viber message."""
        msg = InfobipViberMessage(
            to="+1234567890",
            text="Hello via Viber!",
        )
        
        assert msg.to == "+1234567890"
        assert msg.text == "Hello via Viber!"

    def test_viber_with_button(self):
        """Test Viber message with button."""
        msg = InfobipViberMessage(
            to="+1234567890",
            text="Visit our site!",
            button_text="Visit",
            button_url="https://example.com",
        )
        
        assert msg.button_text == "Visit"
        assert msg.button_url == "https://example.com"

    def test_viber_to_infobip_params(self):
        """Test Viber conversion to Infobip params."""
        msg = InfobipViberMessage(
            to="+1234567890",
            text="Hello!",
            from_="ViberService",
            image_url="https://example.com/img.jpg",
        )
        
        params = msg.to_infobip_params()
        
        assert "messages" in params
        message = params["messages"][0]
        assert message["to"] == "+1234567890"
        assert message["text"] == "Hello!"
        assert message["from"] == "ViberService"
        assert message["imageUrl"] == "https://example.com/img.jpg"


class TestInfobipSendResponse:
    """Tests for InfobipSendResponse model."""

    def test_from_infobip_response(self):
        """Test creating InfobipSendResponse from API response."""
        infobip_data = {
            "bulkId": "BULK-12345",
            "messages": [
                {
                    "messageId": "MSG-123",
                    "to": "+1234567890",
                    "status": {
                        "groupId": 1,
                        "groupName": "PENDING",
                        "id": 7,
                        "name": "PENDING_ENROUTE",
                        "description": "Message sent to next instance",
                    },
                    "smsCount": 1,
                }
            ],
        }
        
        response = InfobipSendResponse.from_infobip_response(infobip_data)
        
        assert response.bulk_id == "BULK-12345"
        assert len(response.messages) == 1
        assert response.messages[0].message_id == "MSG-123"
        assert response.messages[0].to == "+1234567890"
        assert response.messages[0].status.group_name == "PENDING"
        assert response.messages[0].sms_count == 1

    def test_from_infobip_response_multiple_messages(self):
        """Test InfobipSendResponse with multiple messages."""
        infobip_data = {
            "bulkId": "BULK-123",
            "messages": [
                {
                    "messageId": "MSG-1",
                    "to": "+1111111111",
                    "status": {"groupId": 1, "groupName": "PENDING", "id": 7, "name": "PENDING_ENROUTE"},
                },
                {
                    "messageId": "MSG-2",
                    "to": "+2222222222",
                    "status": {"groupId": 1, "groupName": "PENDING", "id": 7, "name": "PENDING_ENROUTE"},
                },
            ],
        }
        
        response = InfobipSendResponse.from_infobip_response(infobip_data)
        
        assert len(response.messages) == 2
        assert response.messages[0].to == "+1111111111"
        assert response.messages[1].to == "+2222222222"


class TestInfobipEnums:
    """Tests for Infobip enums."""

    def test_infobip_message_status(self):
        """Test InfobipMessageStatus enum values."""
        assert InfobipMessageStatus.PENDING == "PENDING"
        assert InfobipMessageStatus.DELIVERED == "DELIVERED"
        assert InfobipMessageStatus.EXPIRED == "EXPIRED"
        assert InfobipMessageStatus.REJECTED == "REJECTED"

    def test_infobip_channel(self):
        """Test InfobipChannel enum values."""
        assert InfobipChannel.SMS == "sms"
        assert InfobipChannel.MMS == "mms"
        assert InfobipChannel.WHATSAPP == "whatsapp"
        assert InfobipChannel.VIBER == "viber"
        assert InfobipChannel.RCS == "rcs"

