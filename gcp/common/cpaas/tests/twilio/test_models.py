"""Unit tests for Twilio message models."""

import pytest
from pydantic import ValidationError

from cpaas.twilio import (
    SMSMessage,
    MMSMessage,
    TemplateMessage,
    OTTMessage,
    MessageResponse,
    MessageStatus,
    MessageDirection,
    OTTChannel,
    MediaResource,
    ContentTemplate,
)


class TestSMSMessage:
    """Tests for SMSMessage model."""

    def test_valid_sms_message(self):
        """Test creating a valid SMS message."""
        sms = SMSMessage(
            to="+1234567890",
            body="Hello, World!",
        )
        assert sms.to == "+1234567890"
        assert sms.body == "Hello, World!"

    def test_sms_with_all_fields(self):
        """Test SMS message with all optional fields."""
        sms = SMSMessage(
            to="+1234567890",
            body="Test message",
            from_="+0987654321",
            messaging_service_sid="MG123456",
            status_callback="https://example.com/callback",
            max_price=0.05,
            validity_period=3600,
            smart_encoded=True,
        )
        
        assert sms.from_ == "+0987654321"
        assert sms.messaging_service_sid == "MG123456"
        assert sms.max_price == 0.05
        assert sms.validity_period == 3600
        assert sms.smart_encoded is True

    def test_sms_invalid_phone_number(self):
        """Test SMS message rejects invalid phone number."""
        with pytest.raises(ValidationError) as exc_info:
            SMSMessage(to="1234567890", body="Test")
        
        assert "Phone number must be in E.164 format" in str(exc_info.value)

    def test_sms_to_twilio_params(self):
        """Test conversion to Twilio API parameters."""
        sms = SMSMessage(
            to="+1234567890",
            body="Hello!",
            from_="+0987654321",
            max_price=0.05,
        )
        
        params = sms.to_twilio_params()
        
        assert params["To"] == "+1234567890"
        assert params["Body"] == "Hello!"
        assert params["From"] == "+0987654321"
        assert params["MaxPrice"] == "0.05"

    def test_sms_to_twilio_params_minimal(self):
        """Test minimal params only include required fields."""
        sms = SMSMessage(to="+1234567890", body="Test")
        params = sms.to_twilio_params()
        
        assert "To" in params
        assert "Body" in params
        assert "From" not in params
        assert "MaxPrice" not in params


class TestMMSMessage:
    """Tests for MMSMessage model."""

    def test_valid_mms_message(self):
        """Test creating a valid MMS message."""
        mms = MMSMessage(
            to="+1234567890",
            body="Check this out!",
            media_urls=["https://example.com/image.jpg"],
        )
        
        assert mms.to == "+1234567890"
        assert len(mms.media_urls) == 1

    def test_mms_multiple_media(self):
        """Test MMS with multiple media URLs."""
        mms = MMSMessage(
            to="+1234567890",
            media_urls=[
                "https://example.com/image1.jpg",
                "https://example.com/image2.png",
                "https://example.com/video.mp4",
            ],
        )
        
        assert len(mms.media_urls) == 3

    def test_mms_invalid_media_url(self):
        """Test MMS rejects invalid media URLs."""
        with pytest.raises(ValidationError) as exc_info:
            MMSMessage(
                to="+1234567890",
                media_urls=["not-a-valid-url"],
            )
        
        assert "Invalid media URL" in str(exc_info.value)

    def test_mms_to_twilio_params(self):
        """Test MMS conversion to Twilio params."""
        mms = MMSMessage(
            to="+1234567890",
            body="Check this!",
            media_urls=["https://example.com/img.jpg"],
        )
        
        params = mms.to_twilio_params()
        
        assert params["To"] == "+1234567890"
        assert params["Body"] == "Check this!"
        assert params["MediaUrl"] == ["https://example.com/img.jpg"]


class TestTemplateMessage:
    """Tests for TemplateMessage model."""

    def test_valid_template_message(self):
        """Test creating a valid template message."""
        template = TemplateMessage(
            to="whatsapp:+1234567890",
            content_sid="HX1234567890abcdef1234567890abcdef",
        )
        
        assert template.to == "whatsapp:+1234567890"
        assert template.content_sid == "HX1234567890abcdef1234567890abcdef"

    def test_template_with_variables(self):
        """Test template message with content variables."""
        template = TemplateMessage(
            to="whatsapp:+1234567890",
            content_sid="HX1234567890abcdef1234567890abcdef",
            content_variables={"1": "John", "2": "Order123"},
        )
        
        assert template.content_variables == {"1": "John", "2": "Order123"}

    def test_template_invalid_content_sid(self):
        """Test template rejects invalid content SID."""
        with pytest.raises(ValidationError) as exc_info:
            TemplateMessage(
                to="whatsapp:+1234567890",
                content_sid="invalid_sid",
            )
        
        assert "Content SID must start with 'HX'" in str(exc_info.value)

    def test_template_to_twilio_params(self):
        """Test template conversion to Twilio params."""
        template = TemplateMessage(
            to="whatsapp:+1234567890",
            content_sid="HX123456",
            content_variables={"1": "John"},
        )
        
        params = template.to_twilio_params()
        
        assert params["To"] == "whatsapp:+1234567890"
        assert params["ContentSid"] == "HX123456"
        assert '"1": "John"' in params["ContentVariables"]


class TestOTTMessage:
    """Tests for OTTMessage model."""

    def test_valid_whatsapp_message(self):
        """Test creating a valid WhatsApp message."""
        msg = OTTMessage(
            to="+1234567890",
            channel=OTTChannel.WHATSAPP,
            body="Hello via WhatsApp!",
        )
        
        assert msg.channel == OTTChannel.WHATSAPP
        assert msg.body == "Hello via WhatsApp!"

    def test_ott_with_media(self):
        """Test OTT message with media."""
        msg = OTTMessage(
            to="+1234567890",
            channel=OTTChannel.WHATSAPP,
            body="Check this!",
            media_urls=["https://example.com/photo.jpg"],
        )
        
        assert msg.media_urls == ["https://example.com/photo.jpg"]

    def test_ott_to_twilio_params_whatsapp_formatting(self):
        """Test OTT params add whatsapp: prefix."""
        msg = OTTMessage(
            to="+1234567890",
            channel=OTTChannel.WHATSAPP,
            body="Test",
            from_="+0987654321",
        )
        
        params = msg.to_twilio_params()
        
        assert params["To"] == "whatsapp:+1234567890"
        assert params["From"] == "whatsapp:+0987654321"

    def test_ott_preserves_whatsapp_prefix(self):
        """Test OTT doesn't double-add whatsapp: prefix."""
        msg = OTTMessage(
            to="whatsapp:+1234567890",
            channel=OTTChannel.WHATSAPP,
            body="Test",
        )
        
        params = msg.to_twilio_params()
        assert params["To"] == "whatsapp:+1234567890"

    def test_ott_messenger_channel(self):
        """Test OTT with Facebook Messenger channel."""
        msg = OTTMessage(
            to="+1234567890",
            channel=OTTChannel.FACEBOOK_MESSENGER,
            body="Hello Messenger!",
        )
        
        assert msg.channel == OTTChannel.FACEBOOK_MESSENGER


class TestMessageResponse:
    """Tests for MessageResponse model."""

    def test_from_twilio_response(self):
        """Test creating MessageResponse from Twilio API response."""
        twilio_data = {
            "sid": "SM1234567890abcdef",
            "account_sid": "AC1234567890abcdef",
            "to": "+1234567890",
            "from": "+0987654321",
            "body": "Hello!",
            "status": "delivered",
            "direction": "outbound-api",
            "num_segments": 1,
        }
        
        response = MessageResponse.from_twilio_response(twilio_data)
        
        assert response.sid == "SM1234567890abcdef"
        assert response.to == "+1234567890"
        assert response.from_ == "+0987654321"
        assert response.status == MessageStatus.DELIVERED
        assert response.direction == MessageDirection.OUTBOUND

    def test_message_response_with_error(self):
        """Test MessageResponse with error fields."""
        twilio_data = {
            "sid": "SM123",
            "account_sid": "AC123",
            "to": "+1234567890",
            "status": "failed",
            "error_code": 21608,
            "error_message": "The 'From' phone number is not valid.",
        }
        
        response = MessageResponse.from_twilio_response(twilio_data)
        
        assert response.status == MessageStatus.FAILED
        assert response.error_code == 21608
        assert "not valid" in response.error_message


class TestMessageStatus:
    """Tests for MessageStatus enum."""

    def test_all_statuses(self):
        """Test all message status values."""
        assert MessageStatus.QUEUED == "queued"
        assert MessageStatus.SENDING == "sending"
        assert MessageStatus.SENT == "sent"
        assert MessageStatus.DELIVERED == "delivered"
        assert MessageStatus.FAILED == "failed"
        assert MessageStatus.READ == "read"
        assert MessageStatus.CANCELED == "canceled"


class TestOTTChannel:
    """Tests for OTTChannel enum."""

    def test_all_channels(self):
        """Test all OTT channel values."""
        assert OTTChannel.WHATSAPP == "whatsapp"
        assert OTTChannel.FACEBOOK_MESSENGER == "messenger"
        assert OTTChannel.GOOGLE_BUSINESS_MESSAGES == "gbm"


class TestMediaResource:
    """Tests for MediaResource model."""

    def test_media_resource(self):
        """Test MediaResource model."""
        media = MediaResource(
            sid="ME123456",
            account_sid="AC123456",
            parent_sid="MM123456",
            content_type="image/jpeg",
            uri="/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123.json",
        )
        
        assert media.sid == "ME123456"
        assert media.content_type == "image/jpeg"


class TestContentTemplate:
    """Tests for ContentTemplate model."""

    def test_content_template(self):
        """Test ContentTemplate model."""
        template = ContentTemplate(
            sid="HX123456",
            account_sid="AC123456",
            friendly_name="Order Confirmation",
            language="en",
            variables={"1": {"type": "text"}},
        )
        
        assert template.sid == "HX123456"
        assert template.friendly_name == "Order Confirmation"
        assert template.language == "en"

