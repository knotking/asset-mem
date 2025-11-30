"""
Tests for PubSubClient.

Note: These are basic unit tests. Integration tests require real GCP credentials.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime

from ..client import PubSubClient, PubSubError
from ..config import PubSubConfig
from ..models import (
    Topic,
    Subscription,
    Message,
    TopicMetadata,
    SubscriptionMetadata,
    PublishConfig,
    PullConfig,
    SubscriptionConfig,
)


@pytest.fixture
def config():
    """Create a test configuration."""
    return PubSubConfig(
        project_id="test-project",
        timeout=60.0,
        enable_message_ordering=False,
    )


@pytest.fixture
def client(config):
    """Create a test client."""
    return PubSubClient(config)


@pytest.mark.asyncio
async def test_create_topic(client, config):
    """Test creating a topic."""
    with patch.object(client, '_get_publisher') as mock_get_publisher, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_publisher = Mock()
        mock_topic = Mock()
        mock_topic.name = f"projects/{config.project_id}/topics/test-topic"
        mock_topic.labels = {}
        mock_topic.message_retention_duration = None
        mock_topic.kms_key_name = None
        mock_topic.schema_settings = None
        mock_topic.satisfies_pzs = False
        
        mock_publisher.create_topic.return_value = mock_topic
        mock_get_publisher.return_value = mock_publisher
        
        topic = await client.create_topic("test-topic")
        
        assert topic.name == "test-topic"
        assert topic.metadata is not None
        mock_publisher.create_topic.assert_called_once()


@pytest.mark.asyncio
async def test_list_topics(client, config):
    """Test listing topics."""
    with patch.object(client, '_get_publisher') as mock_get_publisher, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_publisher = Mock()
        mock_topic1 = Mock()
        mock_topic1.name = f"projects/{config.project_id}/topics/topic1"
        mock_topic1.labels = {}
        mock_topic1.message_retention_duration = None
        mock_topic1.kms_key_name = None
        mock_topic1.schema_settings = None
        mock_topic1.satisfies_pzs = False
        
        mock_topic2 = Mock()
        mock_topic2.name = f"projects/{config.project_id}/topics/topic2"
        mock_topic2.labels = {}
        mock_topic2.message_retention_duration = None
        mock_topic2.kms_key_name = None
        mock_topic2.schema_settings = None
        mock_topic2.satisfies_pzs = False
        
        mock_publisher.list_topics.return_value = [mock_topic1, mock_topic2]
        mock_get_publisher.return_value = mock_publisher
        
        topics = await client.list_topics()
        
        assert len(topics) == 2
        assert topics[0].name == "topic1"
        assert topics[1].name == "topic2"


@pytest.mark.asyncio
async def test_get_topic(client, config):
    """Test getting a topic."""
    with patch.object(client, '_get_publisher') as mock_get_publisher, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_publisher = Mock()
        mock_topic = Mock()
        mock_topic.name = f"projects/{config.project_id}/topics/test-topic"
        mock_topic.labels = {}
        mock_topic.message_retention_duration = None
        mock_topic.kms_key_name = None
        mock_topic.schema_settings = None
        mock_topic.satisfies_pzs = False
        
        mock_publisher.get_topic.return_value = mock_topic
        mock_get_publisher.return_value = mock_publisher
        
        topic = await client.get_topic("test-topic")
        
        assert topic.name == "test-topic"
        mock_publisher.get_topic.assert_called_once()


@pytest.mark.asyncio
async def test_delete_topic(client, config):
    """Test deleting a topic."""
    with patch.object(client, '_get_publisher') as mock_get_publisher, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_publisher = Mock()
        mock_publisher.delete_topic.return_value = None
        mock_get_publisher.return_value = mock_publisher
        
        await client.delete_topic("test-topic")
        
        mock_publisher.delete_topic.assert_called_once()


@pytest.mark.asyncio
async def test_create_subscription(client, config):
    """Test creating a subscription."""
    with patch.object(client, '_get_subscriber') as mock_get_subscriber, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_subscriber = Mock()
        mock_subscription = Mock()
        mock_subscription.name = f"projects/{config.project_id}/subscriptions/test-subscription"
        mock_subscription.topic = f"projects/{config.project_id}/topics/test-topic"
        mock_subscription.ack_deadline_seconds = 10
        mock_subscription.retain_acked_messages = False
        mock_subscription.message_retention_duration = None
        mock_subscription.labels = {}
        mock_subscription.enable_message_ordering = False
        mock_subscription.expiration_policy = None
        mock_subscription.dead_letter_policy = None
        mock_subscription.retry_policy = None
        mock_subscription.push_config = None
        mock_subscription.bigquery_config = None
        mock_subscription.cloud_storage_config = None
        
        mock_subscriber.create_subscription.return_value = mock_subscription
        mock_get_subscriber.return_value = mock_subscriber
        
        subscription = await client.create_subscription(
            subscription_name="test-subscription",
            topic_name="test-topic"
        )
        
        assert subscription.name == "test-subscription"
        assert subscription.topic == "test-topic"
        mock_subscriber.create_subscription.assert_called_once()


@pytest.mark.asyncio
async def test_list_subscriptions(client, config):
    """Test listing subscriptions."""
    with patch.object(client, '_get_subscriber') as mock_get_subscriber, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_subscriber = Mock()
        mock_subscription1 = Mock()
        mock_subscription1.name = f"projects/{config.project_id}/subscriptions/sub1"
        mock_subscription1.topic = f"projects/{config.project_id}/topics/topic1"
        mock_subscription1.ack_deadline_seconds = 10
        mock_subscription1.retain_acked_messages = False
        mock_subscription1.message_retention_duration = None
        mock_subscription1.labels = {}
        mock_subscription1.enable_message_ordering = False
        mock_subscription1.expiration_policy = None
        mock_subscription1.dead_letter_policy = None
        mock_subscription1.retry_policy = None
        mock_subscription1.push_config = None
        mock_subscription1.bigquery_config = None
        mock_subscription1.cloud_storage_config = None
        
        mock_subscription2 = Mock()
        mock_subscription2.name = f"projects/{config.project_id}/subscriptions/sub2"
        mock_subscription2.topic = f"projects/{config.project_id}/topics/topic2"
        mock_subscription2.ack_deadline_seconds = 10
        mock_subscription2.retain_acked_messages = False
        mock_subscription2.message_retention_duration = None
        mock_subscription2.labels = {}
        mock_subscription2.enable_message_ordering = False
        mock_subscription2.expiration_policy = None
        mock_subscription2.dead_letter_policy = None
        mock_subscription2.retry_policy = None
        mock_subscription2.push_config = None
        mock_subscription2.bigquery_config = None
        mock_subscription2.cloud_storage_config = None
        
        mock_subscriber.list_subscriptions.return_value = [mock_subscription1, mock_subscription2]
        mock_get_subscriber.return_value = mock_subscriber
        
        subscriptions = await client.list_subscriptions()
        
        assert len(subscriptions) == 2
        assert subscriptions[0].name == "sub1"
        assert subscriptions[1].name == "sub2"


@pytest.mark.asyncio
async def test_get_subscription(client, config):
    """Test getting a subscription."""
    with patch.object(client, '_get_subscriber') as mock_get_subscriber, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_subscriber = Mock()
        mock_subscription = Mock()
        mock_subscription.name = f"projects/{config.project_id}/subscriptions/test-subscription"
        mock_subscription.topic = f"projects/{config.project_id}/topics/test-topic"
        mock_subscription.ack_deadline_seconds = 10
        mock_subscription.retain_acked_messages = False
        mock_subscription.message_retention_duration = None
        mock_subscription.labels = {}
        mock_subscription.enable_message_ordering = False
        mock_subscription.expiration_policy = None
        mock_subscription.dead_letter_policy = None
        mock_subscription.retry_policy = None
        mock_subscription.push_config = None
        mock_subscription.bigquery_config = None
        mock_subscription.cloud_storage_config = None
        
        mock_subscriber.get_subscription.return_value = mock_subscription
        mock_get_subscriber.return_value = mock_subscriber
        
        subscription = await client.get_subscription("test-subscription")
        
        assert subscription.name == "test-subscription"
        mock_subscriber.get_subscription.assert_called_once()


@pytest.mark.asyncio
async def test_update_subscription(client, config):
    """Test updating a subscription."""
    with patch.object(client, '_get_subscriber') as mock_get_subscriber, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_subscriber = Mock()
        mock_subscription = Mock()
        mock_subscription.name = f"projects/{config.project_id}/subscriptions/test-subscription"
        mock_subscription.topic = f"projects/{config.project_id}/topics/test-topic"
        mock_subscription.ack_deadline_seconds = 120
        mock_subscription.retain_acked_messages = False
        mock_subscription.message_retention_duration = None
        mock_subscription.labels = {}
        mock_subscription.enable_message_ordering = False
        mock_subscription.expiration_policy = None
        mock_subscription.dead_letter_policy = None
        mock_subscription.retry_policy = None
        mock_subscription.push_config = None
        mock_subscription.bigquery_config = None
        mock_subscription.cloud_storage_config = None
        
        mock_subscriber.update_subscription.return_value = mock_subscription
        mock_get_subscriber.return_value = mock_subscriber
        
        # Mock get_subscription for update_subscription
        with patch.object(client, 'get_subscription') as mock_get_sub:
            mock_get_sub.return_value = Subscription(
                name="test-subscription",
                topic="test-topic",
                project_id=config.project_id,
                metadata=SubscriptionMetadata(
                    name="test-subscription",
                    topic="test-topic",
                    project_id=config.project_id,
                    ack_deadline_seconds=10,
                )
            )
            
            subscription = await client.update_subscription(
                subscription_name="test-subscription",
                subscription_config=SubscriptionConfig(ack_deadline_seconds=120)
            )
            
            assert subscription.name == "test-subscription"
            mock_subscriber.update_subscription.assert_called_once()


@pytest.mark.asyncio
async def test_delete_subscription(client, config):
    """Test deleting a subscription."""
    with patch.object(client, '_get_subscriber') as mock_get_subscriber, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_subscriber = Mock()
        mock_subscriber.delete_subscription.return_value = None
        mock_get_subscriber.return_value = mock_subscriber
        
        await client.delete_subscription("test-subscription")
        
        mock_subscriber.delete_subscription.assert_called_once()


@pytest.mark.asyncio
async def test_publish_message(client, config):
    """Test publishing a message."""
    with patch.object(client, '_get_publisher') as mock_get_publisher, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_publisher = Mock()
        mock_future = Mock()
        mock_future.result.return_value = "message-id-123"
        mock_publisher.publish.return_value = mock_future
        mock_get_publisher.return_value = mock_publisher
        
        message_id = await client.publish_message(
            topic_name="test-topic",
            data=b"Hello, World!"
        )
        
        assert message_id == "message-id-123"
        mock_publisher.publish.assert_called_once()


@pytest.mark.asyncio
async def test_publish_messages(client, config):
    """Test publishing multiple messages."""
    with patch.object(client, '_get_publisher') as mock_get_publisher, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_publisher = Mock()
        mock_future1 = Mock()
        mock_future1.result.return_value = "message-id-1"
        mock_future2 = Mock()
        mock_future2.result.return_value = "message-id-2"
        mock_publisher.publish.side_effect = [mock_future1, mock_future2]
        mock_get_publisher.return_value = mock_publisher
        
        message_ids = await client.publish_messages(
            topic_name="test-topic",
            messages=[b"Message 1", b"Message 2"]
        )
        
        assert len(message_ids) == 2
        assert message_ids[0] == "message-id-1"
        assert message_ids[1] == "message-id-2"


@pytest.mark.asyncio
async def test_pull_messages(client, config):
    """Test pulling messages."""
    with patch.object(client, '_get_subscriber') as mock_get_subscriber, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_subscriber = Mock()
        mock_response = Mock()
        mock_received_message = Mock()
        mock_received_message.ack_id = "ack-id-123"
        mock_received_message.message = Mock()
        mock_received_message.message.data = b"Hello, World!"
        mock_received_message.message.attributes = {}
        mock_received_message.message.ordering_key = None
        mock_received_message.message.message_id = "msg-id-123"
        mock_received_message.message.publish_time = datetime.now()
        
        mock_response.received_messages = [mock_received_message]
        mock_subscriber.pull.return_value = mock_response
        mock_get_subscriber.return_value = mock_subscriber
        
        messages = await client.pull_messages("test-subscription")
        
        assert len(messages) == 1
        assert messages[0].data == b"Hello, World!"
        assert messages[0].ack_id == "ack-id-123"
        mock_subscriber.pull.assert_called_once()


@pytest.mark.asyncio
async def test_acknowledge_messages(client, config):
    """Test acknowledging messages."""
    with patch.object(client, '_get_subscriber') as mock_get_subscriber, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_subscriber = Mock()
        mock_subscriber.acknowledge.return_value = None
        mock_get_subscriber.return_value = mock_subscriber
        
        await client.acknowledge_messages(
            subscription_name="test-subscription",
            ack_ids=["ack-id-1", "ack-id-2"]
        )
        
        mock_subscriber.acknowledge.assert_called_once()


@pytest.mark.asyncio
async def test_modify_ack_deadline(client, config):
    """Test modifying acknowledgment deadline."""
    with patch.object(client, '_get_subscriber') as mock_get_subscriber, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_subscriber = Mock()
        mock_subscriber.modify_ack_deadline.return_value = None
        mock_get_subscriber.return_value = mock_subscriber
        
        await client.modify_ack_deadline(
            subscription_name="test-subscription",
            ack_ids=["ack-id-1"],
            ack_deadline_seconds=300
        )
        
        mock_subscriber.modify_ack_deadline.assert_called_once()


@pytest.mark.asyncio
async def test_pubsub_error_handling(client, config):
    """Test error handling."""
    with patch.object(client, '_get_publisher') as mock_get_publisher, \
         patch.object(client, '_get_project_path', return_value=f"projects/{config.project_id}"):
        mock_publisher = Mock()
        mock_publisher.get_topic.side_effect = Exception("Topic not found")
        mock_get_publisher.return_value = mock_publisher
        
        with pytest.raises(PubSubError) as exc_info:
            await client.get_topic("nonexistent-topic")
        
        assert "Failed to get topic" in str(exc_info.value)
        assert exc_info.value.details["topic_name"] == "nonexistent-topic"


@pytest.mark.asyncio
async def test_client_context_manager(client):
    """Test client context manager."""
    async with client:
        assert client._publisher is not None or client._subscriber is not None
    
    # After context exit, clients should be reset
    assert client._publisher is None
    assert client._subscriber is None

