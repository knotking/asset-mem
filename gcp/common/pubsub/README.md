# GCP Pub/Sub - Cloud Pub/Sub CRUD Operations

A comprehensive Google Cloud Pub/Sub integration module for topic, subscription, and message CRUD operations.

## Features

- **Topic Management** - Create, list, get, and delete topics
- **Subscription Management** - Create, list, get, delete, and update subscriptions
- **Message Publishing** - Publish single or multiple messages to topics
- **Message Pulling** - Pull messages from subscriptions
- **Message Acknowledgment** - Acknowledge and modify acknowledgment deadlines
- **Async Support** - Full async/await support for high-performance applications
- **Metadata Handling** - Comprehensive metadata support for topics and subscriptions

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Or install individually:

```bash
pip install google-cloud-pubsub pydantic google-cloud-secret-manager
```

## Configuration

### Environment Variables

Set the following environment variables:

```bash
# Required
export PUBSUB_PROJECT_ID="your-gcp-project-id"

# Optional
export PUBSUB_TIMEOUT="60"
export PUBSUB_ENABLE_MESSAGE_ORDERING="false"
```

**Note:** `PUBSUB_PROJECT_ID` is optional as it can be inferred from Application Default Credentials (ADC).

### Using .env File

Create a `.env` file in your project root:

```env
PUBSUB_PROJECT_ID=your-gcp-project-id
PUBSUB_TIMEOUT=60
PUBSUB_ENABLE_MESSAGE_ORDERING=false
```

Then load it in your code:

```python
from dotenv import load_dotenv
load_dotenv()

from pubsub import PubSubConfig, PubSubClient

config = PubSubConfig.from_env()
```

### Using Google Cloud Secret Manager

For production deployments, store configuration in GCP Secret Manager:

```bash
# Create secret with JSON config
echo '{"project_id": "...", "timeout": 60.0, "enable_message_ordering": false}' | \
  gcloud secrets create pubsub-config --data-file=-
```

Then load in code:

```python
from pubsub import PubSubConfig, PubSubClient

config = PubSubConfig.from_gcp_secret_manager(
    project_id="your-secrets-project-id",
    config_secret="pubsub-config",
)
```

## Usage

### Basic Setup

```python
import asyncio
from pubsub import PubSubClient, PubSubConfig

# Load configuration
config = PubSubConfig.from_env()

# Create client
client = PubSubClient(config)
```

### Topic Operations

#### Create a Topic

```python
async def create_topic_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        topic = await client.create_topic(
            topic_name="my-topic",
            labels={"environment": "production"}
        )
        print(f"Created topic: {topic.name}")

asyncio.run(create_topic_example())
```

#### List Topics

```python
async def list_topics_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        topics = await client.list_topics()
        print(f"Found {len(topics)} topics")
        for topic in topics:
            print(f"  - {topic.name}")

asyncio.run(list_topics_example())
```

#### Get a Topic

```python
async def get_topic_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        topic = await client.get_topic("my-topic")
        print(f"Topic: {topic.name}")
        print(f"Full name: {topic.full_name}")

asyncio.run(get_topic_example())
```

#### Delete a Topic

```python
async def delete_topic_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        await client.delete_topic("my-topic")
        print("Topic deleted")

asyncio.run(delete_topic_example())
```

### Subscription Operations

#### Create a Subscription

```python
async def create_subscription_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        from pubsub import SubscriptionConfig
        
        subscription = await client.create_subscription(
            subscription_name="my-subscription",
            topic_name="my-topic",
            subscription_config=SubscriptionConfig(
                ack_deadline_seconds=60,
                labels={"environment": "production"}
            )
        )
        print(f"Created subscription: {subscription.name}")

asyncio.run(create_subscription_example())
```

#### List Subscriptions

```python
async def list_subscriptions_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        # List all subscriptions
        subscriptions = await client.list_subscriptions()
        print(f"Found {len(subscriptions)} subscriptions")
        
        # List subscriptions for a specific topic
        subscriptions = await client.list_subscriptions(topic_name="my-topic")
        for subscription in subscriptions:
            print(f"  - {subscription.name} -> {subscription.topic}")

asyncio.run(list_subscriptions_example())
```

#### Get a Subscription

```python
async def get_subscription_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        subscription = await client.get_subscription("my-subscription")
        print(f"Subscription: {subscription.name}")
        print(f"Ack deadline: {subscription.metadata.ack_deadline_seconds}s")

asyncio.run(get_subscription_example())
```

#### Update a Subscription

```python
async def update_subscription_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        from pubsub import SubscriptionConfig
        
        subscription = await client.update_subscription(
            subscription_name="my-subscription",
            subscription_config=SubscriptionConfig(
                ack_deadline_seconds=120
            )
        )
        print(f"Updated subscription: {subscription.name}")

asyncio.run(update_subscription_example())
```

#### Delete a Subscription

```python
async def delete_subscription_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        await client.delete_subscription("my-subscription")
        print("Subscription deleted")

asyncio.run(delete_subscription_example())
```

### Message Operations

#### Publish a Message

```python
async def publish_message_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        from pubsub import PublishConfig
        
        message_id = await client.publish_message(
            topic_name="my-topic",
            data=b"Hello, World!",
            publish_config=PublishConfig(
                attributes={"source": "api", "priority": "high"}
            )
        )
        print(f"Published message: {message_id}")

asyncio.run(publish_message_example())
```

#### Publish Multiple Messages

```python
async def publish_messages_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        message_ids = await client.publish_messages(
            topic_name="my-topic",
            messages=[
                b"Message 1",
                b"Message 2",
                b"Message 3"
            ]
        )
        print(f"Published {len(message_ids)} messages")

asyncio.run(publish_messages_example())
```

#### Pull Messages

```python
async def pull_messages_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        from pubsub import PullConfig
        
        messages = await client.pull_messages(
            subscription_name="my-subscription",
            pull_config=PullConfig(max_messages=10)
        )
        
        print(f"Pulled {len(messages)} messages")
        for message in messages:
            print(f"  - {message.decode()}")
            print(f"    Attributes: {message.attributes}")

asyncio.run(pull_messages_example())
```

#### Acknowledge Messages

```python
async def acknowledge_messages_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        # Pull messages
        messages = await client.pull_messages("my-subscription")
        
        # Process messages
        for message in messages:
            print(f"Processing: {message.decode()}")
        
        # Acknowledge messages
        ack_ids = [msg.ack_id for msg in messages if msg.ack_id]
        if ack_ids:
            await client.acknowledge_messages("my-subscription", ack_ids)
            print(f"Acknowledged {len(ack_ids)} messages")

asyncio.run(acknowledge_messages_example())
```

#### Modify Acknowledgment Deadline

```python
async def modify_ack_deadline_example():
    async with PubSubClient(PubSubConfig.from_env()) as client:
        # Pull messages
        messages = await client.pull_messages("my-subscription")
        
        # Extend ack deadline for long-running processing
        ack_ids = [msg.ack_id for msg in messages if msg.ack_id]
        if ack_ids:
            await client.modify_ack_deadline(
                subscription_name="my-subscription",
                ack_ids=ack_ids,
                ack_deadline_seconds=300  # 5 minutes
            )
            print(f"Extended ack deadline for {len(ack_ids)} messages")

asyncio.run(modify_ack_deadline_example())
```

## API Reference

### PubSubConfig

Configuration container for GCP Pub/Sub.

| Attribute | Type | Description |
|-----------|------|-------------|
| `project_id` | str | GCP project ID (optional, can be inferred from ADC) |
| `timeout` | float | Request timeout in seconds (default: 60.0) |
| `enable_message_ordering` | bool | Enable message ordering (default: False) |

### PubSubClient Methods

#### Topic Management
- `create_topic(topic_name, labels?, message_retention_duration?, kms_key_name?, schema_settings?) -> Topic`
- `list_topics() -> List[Topic]`
- `get_topic(topic_name) -> Topic`
- `delete_topic(topic_name) -> None`

#### Subscription Management
- `create_subscription(subscription_name, topic_name, subscription_config?) -> Subscription`
- `list_subscriptions(topic_name?) -> List[Subscription]`
- `get_subscription(subscription_name) -> Subscription`
- `update_subscription(subscription_name, subscription_config) -> Subscription`
- `delete_subscription(subscription_name) -> None`

#### Message Operations
- `publish_message(topic_name, data, publish_config?) -> str`
- `publish_messages(topic_name, messages, publish_config?) -> List[str]`
- `pull_messages(subscription_name, pull_config?) -> List[Message]`
- `acknowledge_messages(subscription_name, ack_ids) -> None`
- `modify_ack_deadline(subscription_name, ack_ids, ack_deadline_seconds) -> None`

### Models

#### Topic
```python
Topic(
    name: str,                    # Topic name
    project_id: Optional[str],     # GCP project ID
    metadata: Optional[TopicMetadata]  # Topic metadata
)
```

#### Subscription
```python
Subscription(
    name: str,                    # Subscription name
    topic: Optional[str],         # Topic name
    project_id: Optional[str],    # GCP project ID
    metadata: Optional[SubscriptionMetadata]  # Subscription metadata
)
```

#### Message
```python
Message(
    data: bytes,                   # Message data
    attributes: Optional[Dict[str, str]],  # Message attributes
    ordering_key: Optional[str],   # Ordering key
    message_id: Optional[str],     # Message ID (set after publishing)
    publish_time: Optional[datetime],  # Publish timestamp
    ack_id: Optional[str],         # Acknowledgment ID (for pulled messages)
    metadata: Optional[MessageMetadata]  # Message metadata
)
```

#### PublishConfig
```python
PublishConfig(
    ordering_key: Optional[str],           # Ordering key for ordered delivery
    attributes: Optional[Dict[str, str]]  # Message attributes
)
```

#### PullConfig
```python
PullConfig(
    max_messages: int = 1,         # Maximum number of messages (default: 1, max: 1000)
    return_immediately: bool = False,  # Return immediately if no messages
    timeout: Optional[float]      # Timeout in seconds
)
```

#### SubscriptionConfig
```python
SubscriptionConfig(
    ack_deadline_seconds: Optional[int],  # Ack deadline (default: 10)
    retain_acked_messages: Optional[bool],  # Retain acked messages
    message_retention_duration: Optional[str],  # Retention duration (e.g., '7d')
    labels: Optional[Dict[str, str]],  # Subscription labels
    enable_message_ordering: Optional[bool],  # Enable message ordering
    expiration_policy: Optional[Dict[str, Any]],  # Expiration policy
    dead_letter_policy: Optional[Dict[str, Any]],  # Dead letter policy
    retry_policy: Optional[Dict[str, Any]],  # Retry policy
    push_config: Optional[Dict[str, Any]],  # Push configuration
    bigquery_config: Optional[Dict[str, Any]],  # BigQuery configuration
    cloud_storage_config: Optional[Dict[str, Any]]  # Cloud Storage configuration
)
```

## Authentication

The client uses Google Cloud Application Default Credentials (ADC). Set up authentication:

```bash
# Service Account (Recommended for Production)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# User Credentials (Development)
gcloud auth application-default login
```

### Required IAM Roles

The service account needs these roles:
- `roles/pubsub.publisher` - For publishing messages
- `roles/pubsub.subscriber` - For pulling messages
- `roles/pubsub.admin` - For full topic and subscription management
- `roles/pubsub.editor` - For creating and updating topics/subscriptions
- `roles/pubsub.viewer` - For read-only access

## Error Handling

```python
from pubsub import PubSubClient, PubSubConfig
from pubsub.client import PubSubError

async def safe_operation():
    try:
        async with PubSubClient(PubSubConfig.from_env()) as client:
            topic = await client.create_topic(topic_name="my-topic")
            print(f"Created topic: {topic.name}")
    except PubSubError as e:
        print(f"Pub/Sub error: {e}")
        print(f"Status code: {e.status_code}")
        print(f"Details: {e.details}")
    except Exception as e:
        print(f"Unexpected error: {e}")

asyncio.run(safe_operation())
```

## Testing

Run tests with pytest:

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_client.py

# Run integration tests (requires real credentials)
pytest -m integration
```

## Troubleshooting

### Common Issues

**Error: "Project ID is required but not configured"**
- Set `PUBSUB_PROJECT_ID` environment variable
- Or ensure Application Default Credentials are configured with a project

**Error: "Permission denied"**
- Verify service account has required IAM roles
- Check that `GOOGLE_APPLICATION_CREDENTIALS` is set correctly

**Error: "Topic not found"**
- Verify the topic name is correct
- Check that the topic exists in the specified project

**Error: "Subscription not found"**
- Verify the subscription name is correct
- Check that the subscription exists in the specified project

**Messages not being delivered**
- Check subscription configuration
- Verify topic and subscription are in the same project
- Check dead letter policy if messages are being moved to dead letter topic

## Best Practices

### 1. Topic Naming

```python
# Use descriptive, hierarchical names
topic_name = f"{project_id}-{environment}-{service}-{purpose}"
# Example: "my-project-prod-api-events"
```

### 2. Subscription Management

```python
# Use meaningful subscription names
subscription_name = f"{topic_name}-{consumer_name}"
# Example: "my-topic-processor-service"
```

### 3. Message Acknowledgment

```python
# Always acknowledge messages after processing
try:
    messages = await client.pull_messages("my-subscription")
    for message in messages:
        process_message(message)
    # Acknowledge only after successful processing
    ack_ids = [msg.ack_id for msg in messages if msg.ack_id]
    await client.acknowledge_messages("my-subscription", ack_ids)
except Exception as e:
    # On error, messages will be redelivered after ack deadline
    logger.error(f"Failed to process messages: {e}")
```

### 4. Error Handling

```python
try:
    message_id = await client.publish_message("my-topic", data)
except PubSubError as e:
    logger.error(f"Failed to publish: {e}")
    # Implement retry logic or dead letter handling
```

### 5. Resource Cleanup

```python
# Use async context manager for automatic cleanup
async with PubSubClient(config) as client:
    # Operations here
    pass
# Client is automatically closed
```

### 6. Message Ordering

```python
# Use ordering keys for ordered message delivery
await client.publish_message(
    topic_name="my-topic",
    data=b"Message",
    publish_config=PublishConfig(ordering_key="user-123")
)
```

### 7. Dead Letter Topics

```python
# Configure dead letter policy for failed messages
subscription_config = SubscriptionConfig(
    dead_letter_policy={
        "dead_letter_topic": "projects/my-project/topics/dead-letter-topic",
        "max_delivery_attempts": 5
    }
)
```

## License

Internal use only.

## References

- [Google Cloud Pub/Sub Python Client Library](https://cloud.google.com/python/docs/reference/pubsub/latest)
- [Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)

