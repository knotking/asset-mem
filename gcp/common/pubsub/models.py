"""
Pydantic models for GCP Pub/Sub API.

Supports:
- Topic management
- Subscription management
- Message handling
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum


class MessageOrderingKey(str, Enum):
    """Message ordering key options."""
    NONE = ""


class AckDeadlineSeconds(int, Enum):
    """Common acknowledgment deadline values."""
    MIN_10 = 10
    MIN_60 = 60
    MIN_300 = 300
    MIN_600 = 600


class TopicMetadata(BaseModel):
    """Topic metadata model."""
    name: str = Field(..., description="Topic name")
    project_id: Optional[str] = Field(None, description="GCP project ID")
    labels: Optional[Dict[str, str]] = Field(None, description="Topic labels")
    message_retention_duration: Optional[str] = Field(None, description="Message retention duration")
    kms_key_name: Optional[str] = Field(None, description="KMS key name for encryption")
    schema_settings: Optional[Dict[str, Any]] = Field(None, description="Schema settings")
    satisfies_pzs: Optional[bool] = Field(None, description="Whether topic satisfies PZS")


class Topic(BaseModel):
    """Topic model."""
    name: str = Field(..., description="Topic name")
    project_id: Optional[str] = Field(None, description="GCP project ID")
    metadata: Optional[TopicMetadata] = Field(None, description="Topic metadata")
    
    @property
    def full_name(self) -> str:
        """Get full topic name: projects/{project_id}/topics/{topic_name}"""
        if self.project_id:
            return f"projects/{self.project_id}/topics/{self.name}"
        return f"projects/*/topics/{self.name}"


class SubscriptionMetadata(BaseModel):
    """Subscription metadata model."""
    name: str = Field(..., description="Subscription name")
    topic: Optional[str] = Field(None, description="Topic name")
    project_id: Optional[str] = Field(None, description="GCP project ID")
    ack_deadline_seconds: Optional[int] = Field(None, description="Acknowledgment deadline in seconds")
    retain_acked_messages: Optional[bool] = Field(None, description="Whether to retain acknowledged messages")
    message_retention_duration: Optional[str] = Field(None, description="Message retention duration")
    labels: Optional[Dict[str, str]] = Field(None, description="Subscription labels")
    enable_message_ordering: Optional[bool] = Field(None, description="Whether message ordering is enabled")
    expiration_policy: Optional[Dict[str, Any]] = Field(None, description="Expiration policy")
    dead_letter_policy: Optional[Dict[str, Any]] = Field(None, description="Dead letter policy")
    retry_policy: Optional[Dict[str, Any]] = Field(None, description="Retry policy")
    push_config: Optional[Dict[str, Any]] = Field(None, description="Push configuration")
    bigquery_config: Optional[Dict[str, Any]] = Field(None, description="BigQuery configuration")
    cloud_storage_config: Optional[Dict[str, Any]] = Field(None, description="Cloud Storage configuration")


class Subscription(BaseModel):
    """Subscription model."""
    name: str = Field(..., description="Subscription name")
    topic: Optional[str] = Field(None, description="Topic name")
    project_id: Optional[str] = Field(None, description="GCP project ID")
    metadata: Optional[SubscriptionMetadata] = Field(None, description="Subscription metadata")
    
    @property
    def full_name(self) -> str:
        """Get full subscription name: projects/{project_id}/subscriptions/{subscription_name}"""
        if self.project_id:
            return f"projects/{self.project_id}/subscriptions/{self.name}"
        return f"projects/*/subscriptions/{self.name}"


class MessageMetadata(BaseModel):
    """Message metadata model."""
    message_id: Optional[str] = Field(None, description="Message ID")
    publish_time: Optional[datetime] = Field(None, description="Publish timestamp")
    ordering_key: Optional[str] = Field(None, description="Ordering key")
    attributes: Optional[Dict[str, str]] = Field(None, description="Message attributes")


class Message(BaseModel):
    """Message model."""
    data: bytes = Field(..., description="Message data")
    attributes: Optional[Dict[str, str]] = Field(None, description="Message attributes")
    ordering_key: Optional[str] = Field(None, description="Ordering key")
    message_id: Optional[str] = Field(None, description="Message ID (set after publishing)")
    publish_time: Optional[datetime] = Field(None, description="Publish timestamp")
    ack_id: Optional[str] = Field(None, description="Acknowledgment ID (for pulled messages)")
    metadata: Optional[MessageMetadata] = Field(None, description="Message metadata")
    
    def decode(self, encoding: str = "utf-8") -> str:
        """Decode message data to string."""
        return self.data.decode(encoding)
    
    @classmethod
    def from_string(cls, data: str, encoding: str = "utf-8", **kwargs) -> "Message":
        """Create a message from a string."""
        return cls(data=data.encode(encoding), **kwargs)


class PublishConfig(BaseModel):
    """Configuration for publishing messages."""
    ordering_key: Optional[str] = Field(None, description="Ordering key for ordered delivery")
    attributes: Optional[Dict[str, str]] = Field(None, description="Message attributes")


class PullConfig(BaseModel):
    """Configuration for pulling messages."""
    max_messages: int = Field(1, description="Maximum number of messages to pull (default: 1, max: 1000)")
    return_immediately: bool = Field(False, description="Return immediately if no messages available")
    timeout: Optional[float] = Field(None, description="Timeout in seconds")


class SubscriptionConfig(BaseModel):
    """Configuration for creating/updating subscriptions."""
    ack_deadline_seconds: Optional[int] = Field(None, description="Acknowledgment deadline in seconds (default: 10)")
    retain_acked_messages: Optional[bool] = Field(None, description="Whether to retain acknowledged messages")
    message_retention_duration: Optional[str] = Field(None, description="Message retention duration (e.g., '7d')")
    labels: Optional[Dict[str, str]] = Field(None, description="Subscription labels")
    enable_message_ordering: Optional[bool] = Field(None, description="Whether message ordering is enabled")
    expiration_policy: Optional[Dict[str, Any]] = Field(None, description="Expiration policy")
    dead_letter_policy: Optional[Dict[str, Any]] = Field(None, description="Dead letter policy")
    retry_policy: Optional[Dict[str, Any]] = Field(None, description="Retry policy")
    push_config: Optional[Dict[str, Any]] = Field(None, description="Push configuration (for push subscriptions)")
    bigquery_config: Optional[Dict[str, Any]] = Field(None, description="BigQuery configuration")
    cloud_storage_config: Optional[Dict[str, Any]] = Field(None, description="Cloud Storage configuration")

