"""
GCP Pub/Sub Client for Cloud Pub/Sub CRUD operations.

Provides async methods for:
- Topic management (create, list, get, delete)
- Subscription management (create, list, get, delete, update)
- Message publishing and pulling
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List, Union
from datetime import datetime

from .config import PubSubConfig
from .models import (
    Topic,
    Subscription,
    Message,
    TopicMetadata,
    SubscriptionMetadata,
    MessageMetadata,
    PublishConfig,
    PullConfig,
    SubscriptionConfig,
)

logger = logging.getLogger(__name__)


class PubSubError(Exception):
    """Base exception for Pub/Sub client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class PubSubClient:
    """
    Client for GCP Pub/Sub operations.
    
    Supports topic and subscription CRUD operations with async/await support.
    
    Example:
        config = PubSubConfig.from_env()
        client = PubSubClient(config)
        
        # Create a topic
        topic = await client.create_topic("my-topic")
        
        # Publish a message
        message_id = await client.publish_message(
            topic_name="my-topic",
            data=b"Hello, World!"
        )
        
        # Create a subscription
        subscription = await client.create_subscription(
            subscription_name="my-subscription",
            topic_name="my-topic"
        )
        
        # Pull messages
        messages = await client.pull_messages("my-subscription", max_messages=10)
    """
    
    def __init__(self, config: PubSubConfig):
        """
        Initialize Pub/Sub client.
        
        Args:
            config: PubSubConfig instance
        """
        self.config = config
        self._publisher = None
        self._subscriber = None
    
    def _get_publisher(self):
        """Get or create the Publisher client."""
        if self._publisher is None:
            from google.cloud import pubsub_v1
            
            if self.config.project_id:
                self._publisher = pubsub_v1.PublisherClient()
            else:
                self._publisher = pubsub_v1.PublisherClient()
        
        return self._publisher
    
    def _get_subscriber(self):
        """Get or create the Subscriber client."""
        if self._subscriber is None:
            from google.cloud import pubsub_v1
            
            if self.config.project_id:
                self._subscriber = pubsub_v1.SubscriberClient()
            else:
                self._subscriber = pubsub_v1.SubscriberClient()
        
        return self._subscriber
    
    def _get_project_path(self) -> str:
        """Get the project path."""
        project_id = self.config.project_id
        if not project_id:
            # Try to get from Google Cloud default project
            try:
                from google.auth import default
                _, project_id = default()
            except Exception:
                pass
        
        if not project_id:
            raise PubSubError(
                "Project ID is required but not configured. "
                "Set PUBSUB_PROJECT_ID environment variable or configure project_id in PubSubConfig."
            )
        
        return f"projects/{project_id}"
    
    def _get_topic_path(self, topic_name: str) -> str:
        """Get the full topic path."""
        project_path = self._get_project_path()
        return f"{project_path}/topics/{topic_name}"
    
    def _get_subscription_path(self, subscription_name: str) -> str:
        """Get the full subscription path."""
        project_path = self._get_project_path()
        return f"{project_path}/subscriptions/{subscription_name}"
    
    async def close(self):
        """Close the client connections."""
        if self._publisher:
            self._publisher.close()
            self._publisher = None
        if self._subscriber:
            self._subscriber.close()
            self._subscriber = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    # Topic operations
    
    async def create_topic(
        self,
        topic_name: str,
        labels: Optional[Dict[str, str]] = None,
        message_retention_duration: Optional[str] = None,
        kms_key_name: Optional[str] = None,
        schema_settings: Optional[Dict[str, Any]] = None,
    ) -> Topic:
        """
        Create a new topic.
        
        Args:
            topic_name: Name of the topic
            labels: Optional labels dictionary
            message_retention_duration: Message retention duration (e.g., '7d')
            kms_key_name: KMS key name for encryption
            schema_settings: Schema settings dictionary
            
        Returns:
            Topic: Created topic
            
        Example:
            topic = await client.create_topic(
                topic_name="my-topic",
                labels={"environment": "production"}
            )
        """
        publisher = self._get_publisher()
        topic_path = self._get_topic_path(topic_name)
        
        try:
            topic_config = {}
            if labels:
                topic_config["labels"] = labels
            if message_retention_duration:
                topic_config["message_retention_duration"] = message_retention_duration
            if kms_key_name:
                topic_config["kms_key_name"] = kms_key_name
            if schema_settings:
                topic_config["schema_settings"] = schema_settings
            
            topic = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: publisher.create_topic(
                    request={
                        "name": topic_path,
                        **topic_config
                    }
                )
            )
            
            logger.info(f"Created topic: {topic_name}")
            
            return Topic(
                name=topic_name,
                project_id=self.config.project_id,
                metadata=TopicMetadata(
                    name=topic_name,
                    project_id=self.config.project_id,
                    labels=dict(topic.labels) if topic.labels else None,
                    message_retention_duration=str(topic.message_retention_duration) if topic.message_retention_duration else None,
                    kms_key_name=topic.kms_key_name if topic.kms_key_name else None,
                    schema_settings={
                        "schema": topic.schema_settings.schema if topic.schema_settings else None,
                        "encoding": topic.schema_settings.encoding if topic.schema_settings else None,
                    } if topic.schema_settings else None,
                    satisfies_pzs=topic.satisfies_pzs if hasattr(topic, "satisfies_pzs") else None,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to create topic: {e}")
            raise PubSubError(
                message=f"Failed to create topic: {e}",
                details={"topic_name": topic_name}
            )
    
    async def list_topics(self) -> List[Topic]:
        """
        List all topics in the project.
        
        Returns:
            List[Topic]: List of topics
            
        Example:
            topics = await client.list_topics()
            for topic in topics:
                print(topic.name)
        """
        publisher = self._get_publisher()
        project_path = self._get_project_path()
        
        try:
            topics = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: list(publisher.list_topics(request={"project": project_path}))
            )
            
            result = []
            for topic in topics:
                # Extract topic name from full path
                topic_name = topic.name.split("/")[-1]
                result.append(Topic(
                    name=topic_name,
                    project_id=self.config.project_id,
                    metadata=TopicMetadata(
                        name=topic_name,
                        project_id=self.config.project_id,
                        labels=dict(topic.labels) if topic.labels else None,
                        message_retention_duration=str(topic.message_retention_duration) if topic.message_retention_duration else None,
                        kms_key_name=topic.kms_key_name if topic.kms_key_name else None,
                        schema_settings={
                            "schema": topic.schema_settings.schema if topic.schema_settings else None,
                            "encoding": topic.schema_settings.encoding if topic.schema_settings else None,
                        } if topic.schema_settings else None,
                        satisfies_pzs=topic.satisfies_pzs if hasattr(topic, "satisfies_pzs") else None,
                    )
                ))
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to list topics: {e}")
            raise PubSubError(
                message=f"Failed to list topics: {e}"
            )
    
    async def get_topic(self, topic_name: str) -> Topic:
        """
        Get a topic by name.
        
        Args:
            topic_name: Name of the topic
            
        Returns:
            Topic: Topic information
            
        Example:
            topic = await client.get_topic("my-topic")
        """
        publisher = self._get_publisher()
        topic_path = self._get_topic_path(topic_name)
        
        try:
            topic = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: publisher.get_topic(request={"topic": topic_path})
            )
            
            return Topic(
                name=topic_name,
                project_id=self.config.project_id,
                metadata=TopicMetadata(
                    name=topic_name,
                    project_id=self.config.project_id,
                    labels=dict(topic.labels) if topic.labels else None,
                    message_retention_duration=str(topic.message_retention_duration) if topic.message_retention_duration else None,
                    kms_key_name=topic.kms_key_name if topic.kms_key_name else None,
                    schema_settings={
                        "schema": topic.schema_settings.schema if topic.schema_settings else None,
                        "encoding": topic.schema_settings.encoding if topic.schema_settings else None,
                    } if topic.schema_settings else None,
                    satisfies_pzs=topic.satisfies_pzs if hasattr(topic, "satisfies_pzs") else None,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to get topic: {e}")
            raise PubSubError(
                message=f"Failed to get topic: {e}",
                details={"topic_name": topic_name}
            )
    
    async def delete_topic(self, topic_name: str) -> None:
        """
        Delete a topic.
        
        Args:
            topic_name: Name of the topic to delete
            
        Example:
            await client.delete_topic("my-topic")
        """
        publisher = self._get_publisher()
        topic_path = self._get_topic_path(topic_name)
        
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: publisher.delete_topic(request={"topic": topic_path})
            )
            
            logger.info(f"Deleted topic: {topic_name}")
            
        except Exception as e:
            logger.error(f"Failed to delete topic: {e}")
            raise PubSubError(
                message=f"Failed to delete topic: {e}",
                details={"topic_name": topic_name}
            )
    
    # Subscription operations
    
    async def create_subscription(
        self,
        subscription_name: str,
        topic_name: str,
        subscription_config: Optional[SubscriptionConfig] = None,
    ) -> Subscription:
        """
        Create a new subscription.
        
        Args:
            subscription_name: Name of the subscription
            topic_name: Name of the topic to subscribe to
            subscription_config: Optional subscription configuration
            
        Returns:
            Subscription: Created subscription
            
        Example:
            subscription = await client.create_subscription(
                subscription_name="my-subscription",
                topic_name="my-topic",
                subscription_config=SubscriptionConfig(
                    ack_deadline_seconds=60
                )
            )
        """
        subscriber = self._get_subscriber()
        subscription_path = self._get_subscription_path(subscription_name)
        topic_path = self._get_topic_path(topic_name)
        
        try:
            request = {
                "name": subscription_path,
                "topic": topic_path,
            }
            
            if subscription_config:
                if subscription_config.ack_deadline_seconds is not None:
                    request["ack_deadline_seconds"] = subscription_config.ack_deadline_seconds
                if subscription_config.retain_acked_messages is not None:
                    request["retain_acked_messages"] = subscription_config.retain_acked_messages
                if subscription_config.message_retention_duration:
                    request["message_retention_duration"] = subscription_config.message_retention_duration
                if subscription_config.labels:
                    request["labels"] = subscription_config.labels
                if subscription_config.enable_message_ordering is not None:
                    request["enable_message_ordering"] = subscription_config.enable_message_ordering
                if subscription_config.expiration_policy:
                    request["expiration_policy"] = subscription_config.expiration_policy
                if subscription_config.dead_letter_policy:
                    request["dead_letter_policy"] = subscription_config.dead_letter_policy
                if subscription_config.retry_policy:
                    request["retry_policy"] = subscription_config.retry_policy
                if subscription_config.push_config:
                    request["push_config"] = subscription_config.push_config
                if subscription_config.bigquery_config:
                    request["bigquery_config"] = subscription_config.bigquery_config
                if subscription_config.cloud_storage_config:
                    request["cloud_storage_config"] = subscription_config.cloud_storage_config
            
            subscription = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subscriber.create_subscription(request=request)
            )
            
            logger.info(f"Created subscription: {subscription_name}")
            
            return Subscription(
                name=subscription_name,
                topic=topic_name,
                project_id=self.config.project_id,
                metadata=SubscriptionMetadata(
                    name=subscription_name,
                    topic=topic_name,
                    project_id=self.config.project_id,
                    ack_deadline_seconds=subscription.ack_deadline_seconds,
                    retain_acked_messages=subscription.retain_acked_messages if hasattr(subscription, "retain_acked_messages") else None,
                    message_retention_duration=str(subscription.message_retention_duration) if subscription.message_retention_duration else None,
                    labels=dict(subscription.labels) if subscription.labels else None,
                    enable_message_ordering=subscription.enable_message_ordering if hasattr(subscription, "enable_message_ordering") else None,
                    expiration_policy={
                        "ttl": str(subscription.expiration_policy.ttl) if subscription.expiration_policy and hasattr(subscription.expiration_policy, "ttl") else None,
                    } if subscription.expiration_policy else None,
                    dead_letter_policy={
                        "dead_letter_topic": subscription.dead_letter_policy.dead_letter_topic if subscription.dead_letter_policy and hasattr(subscription.dead_letter_policy, "dead_letter_topic") else None,
                        "max_delivery_attempts": subscription.dead_letter_policy.max_delivery_attempts if subscription.dead_letter_policy and hasattr(subscription.dead_letter_policy, "max_delivery_attempts") else None,
                    } if subscription.dead_letter_policy else None,
                    retry_policy={
                        "minimum_backoff": str(subscription.retry_policy.minimum_backoff) if subscription.retry_policy and hasattr(subscription.retry_policy, "minimum_backoff") else None,
                        "maximum_backoff": str(subscription.retry_policy.maximum_backoff) if subscription.retry_policy and hasattr(subscription.retry_policy, "maximum_backoff") else None,
                    } if subscription.retry_policy else None,
                    push_config={
                        "push_endpoint": subscription.push_config.push_endpoint if subscription.push_config and hasattr(subscription.push_config, "push_endpoint") else None,
                        "attributes": dict(subscription.push_config.attributes) if subscription.push_config and hasattr(subscription.push_config, "attributes") else None,
                    } if subscription.push_config else None,
                    bigquery_config=dict(subscription.bigquery_config) if subscription.bigquery_config else None,
                    cloud_storage_config=dict(subscription.cloud_storage_config) if subscription.cloud_storage_config else None,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to create subscription: {e}")
            raise PubSubError(
                message=f"Failed to create subscription: {e}",
                details={
                    "subscription_name": subscription_name,
                    "topic_name": topic_name
                }
            )
    
    async def list_subscriptions(self, topic_name: Optional[str] = None) -> List[Subscription]:
        """
        List all subscriptions in the project, optionally filtered by topic.
        
        Args:
            topic_name: Optional topic name to filter subscriptions
            
        Returns:
            List[Subscription]: List of subscriptions
            
        Example:
            # List all subscriptions
            subscriptions = await client.list_subscriptions()
            
            # List subscriptions for a specific topic
            subscriptions = await client.list_subscriptions(topic_name="my-topic")
        """
        subscriber = self._get_subscriber()
        project_path = self._get_project_path()
        
        try:
            if topic_name:
                topic_path = self._get_topic_path(topic_name)
                subscriptions = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: list(subscriber.list_subscriptions(request={"project": project_path, "topic": topic_path}))
                )
            else:
                subscriptions = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: list(subscriber.list_subscriptions(request={"project": project_path}))
                )
            
            result = []
            for subscription in subscriptions:
                # Extract subscription name from full path
                subscription_name = subscription.name.split("/")[-1]
                # Extract topic name from full path
                topic_full_name = subscription.topic.split("/")[-1] if subscription.topic else None
                
                result.append(Subscription(
                    name=subscription_name,
                    topic=topic_full_name,
                    project_id=self.config.project_id,
                    metadata=SubscriptionMetadata(
                        name=subscription_name,
                        topic=topic_full_name,
                        project_id=self.config.project_id,
                        ack_deadline_seconds=subscription.ack_deadline_seconds,
                        retain_acked_messages=subscription.retain_acked_messages if hasattr(subscription, "retain_acked_messages") else None,
                        message_retention_duration=str(subscription.message_retention_duration) if subscription.message_retention_duration else None,
                        labels=dict(subscription.labels) if subscription.labels else None,
                        enable_message_ordering=subscription.enable_message_ordering if hasattr(subscription, "enable_message_ordering") else None,
                        expiration_policy={
                            "ttl": str(subscription.expiration_policy.ttl) if subscription.expiration_policy and hasattr(subscription.expiration_policy, "ttl") else None,
                        } if subscription.expiration_policy else None,
                        dead_letter_policy={
                            "dead_letter_topic": subscription.dead_letter_policy.dead_letter_topic if subscription.dead_letter_policy and hasattr(subscription.dead_letter_policy, "dead_letter_topic") else None,
                            "max_delivery_attempts": subscription.dead_letter_policy.max_delivery_attempts if subscription.dead_letter_policy and hasattr(subscription.dead_letter_policy, "max_delivery_attempts") else None,
                        } if subscription.dead_letter_policy else None,
                        retry_policy={
                            "minimum_backoff": str(subscription.retry_policy.minimum_backoff) if subscription.retry_policy and hasattr(subscription.retry_policy, "minimum_backoff") else None,
                            "maximum_backoff": str(subscription.retry_policy.maximum_backoff) if subscription.retry_policy and hasattr(subscription.retry_policy, "maximum_backoff") else None,
                        } if subscription.retry_policy else None,
                        push_config={
                            "push_endpoint": subscription.push_config.push_endpoint if subscription.push_config and hasattr(subscription.push_config, "push_endpoint") else None,
                            "attributes": dict(subscription.push_config.attributes) if subscription.push_config and hasattr(subscription.push_config, "attributes") else None,
                        } if subscription.push_config else None,
                        bigquery_config=dict(subscription.bigquery_config) if subscription.bigquery_config else None,
                        cloud_storage_config=dict(subscription.cloud_storage_config) if subscription.cloud_storage_config else None,
                    )
                ))
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to list subscriptions: {e}")
            raise PubSubError(
                message=f"Failed to list subscriptions: {e}"
            )
    
    async def get_subscription(self, subscription_name: str) -> Subscription:
        """
        Get a subscription by name.
        
        Args:
            subscription_name: Name of the subscription
            
        Returns:
            Subscription: Subscription information
            
        Example:
            subscription = await client.get_subscription("my-subscription")
        """
        subscriber = self._get_subscriber()
        subscription_path = self._get_subscription_path(subscription_name)
        
        try:
            subscription = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subscriber.get_subscription(request={"subscription": subscription_path})
            )
            
            subscription_name_short = subscription_name
            topic_full_name = subscription.topic.split("/")[-1] if subscription.topic else None
            
            return Subscription(
                name=subscription_name_short,
                topic=topic_full_name,
                project_id=self.config.project_id,
                metadata=SubscriptionMetadata(
                    name=subscription_name_short,
                    topic=topic_full_name,
                    project_id=self.config.project_id,
                    ack_deadline_seconds=subscription.ack_deadline_seconds,
                    retain_acked_messages=subscription.retain_acked_messages if hasattr(subscription, "retain_acked_messages") else None,
                    message_retention_duration=str(subscription.message_retention_duration) if subscription.message_retention_duration else None,
                    labels=dict(subscription.labels) if subscription.labels else None,
                    enable_message_ordering=subscription.enable_message_ordering if hasattr(subscription, "enable_message_ordering") else None,
                    expiration_policy={
                        "ttl": str(subscription.expiration_policy.ttl) if subscription.expiration_policy and hasattr(subscription.expiration_policy, "ttl") else None,
                    } if subscription.expiration_policy else None,
                    dead_letter_policy={
                        "dead_letter_topic": subscription.dead_letter_policy.dead_letter_topic if subscription.dead_letter_policy and hasattr(subscription.dead_letter_policy, "dead_letter_topic") else None,
                        "max_delivery_attempts": subscription.dead_letter_policy.max_delivery_attempts if subscription.dead_letter_policy and hasattr(subscription.dead_letter_policy, "max_delivery_attempts") else None,
                    } if subscription.dead_letter_policy else None,
                    retry_policy={
                        "minimum_backoff": str(subscription.retry_policy.minimum_backoff) if subscription.retry_policy and hasattr(subscription.retry_policy, "minimum_backoff") else None,
                        "maximum_backoff": str(subscription.retry_policy.maximum_backoff) if subscription.retry_policy and hasattr(subscription.retry_policy, "maximum_backoff") else None,
                    } if subscription.retry_policy else None,
                    push_config={
                        "push_endpoint": subscription.push_config.push_endpoint if subscription.push_config and hasattr(subscription.push_config, "push_endpoint") else None,
                        "attributes": dict(subscription.push_config.attributes) if subscription.push_config and hasattr(subscription.push_config, "attributes") else None,
                    } if subscription.push_config else None,
                    bigquery_config=dict(subscription.bigquery_config) if subscription.bigquery_config else None,
                    cloud_storage_config=dict(subscription.cloud_storage_config) if subscription.cloud_storage_config else None,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to get subscription: {e}")
            raise PubSubError(
                message=f"Failed to get subscription: {e}",
                details={"subscription_name": subscription_name}
            )
    
    async def update_subscription(
        self,
        subscription_name: str,
        subscription_config: SubscriptionConfig,
    ) -> Subscription:
        """
        Update a subscription.
        
        Args:
            subscription_name: Name of the subscription to update
            subscription_config: Subscription configuration with fields to update
            
        Returns:
            Subscription: Updated subscription
            
        Example:
            subscription = await client.update_subscription(
                subscription_name="my-subscription",
                subscription_config=SubscriptionConfig(
                    ack_deadline_seconds=120
                )
            )
        """
        subscriber = self._get_subscriber()
        subscription_path = self._get_subscription_path(subscription_name)
        
        try:
            # Get current subscription to build update mask
            current_subscription = await self.get_subscription(subscription_name)
            
            # Build update mask based on provided config
            update_mask = []
            request = {"subscription": {"name": subscription_path}}
            
            if subscription_config.ack_deadline_seconds is not None:
                update_mask.append("ack_deadline_seconds")
                request["subscription"]["ack_deadline_seconds"] = subscription_config.ack_deadline_seconds
            if subscription_config.retain_acked_messages is not None:
                update_mask.append("retain_acked_messages")
                request["subscription"]["retain_acked_messages"] = subscription_config.retain_acked_messages
            if subscription_config.message_retention_duration:
                update_mask.append("message_retention_duration")
                request["subscription"]["message_retention_duration"] = subscription_config.message_retention_duration
            if subscription_config.labels:
                update_mask.append("labels")
                request["subscription"]["labels"] = subscription_config.labels
            if subscription_config.enable_message_ordering is not None:
                update_mask.append("enable_message_ordering")
                request["subscription"]["enable_message_ordering"] = subscription_config.enable_message_ordering
            if subscription_config.expiration_policy:
                update_mask.append("expiration_policy")
                request["subscription"]["expiration_policy"] = subscription_config.expiration_policy
            if subscription_config.dead_letter_policy:
                update_mask.append("dead_letter_policy")
                request["subscription"]["dead_letter_policy"] = subscription_config.dead_letter_policy
            if subscription_config.retry_policy:
                update_mask.append("retry_policy")
                request["subscription"]["retry_policy"] = subscription_config.retry_policy
            if subscription_config.push_config:
                update_mask.append("push_config")
                request["subscription"]["push_config"] = subscription_config.push_config
            if subscription_config.bigquery_config:
                update_mask.append("bigquery_config")
                request["subscription"]["bigquery_config"] = subscription_config.bigquery_config
            if subscription_config.cloud_storage_config:
                update_mask.append("cloud_storage_config")
                request["subscription"]["cloud_storage_config"] = subscription_config.cloud_storage_config
            
            request["update_mask"] = {"paths": update_mask}
            
            subscription = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subscriber.update_subscription(request=request)
            )
            
            logger.info(f"Updated subscription: {subscription_name}")
            
            subscription_name_short = subscription_name
            topic_full_name = subscription.topic.split("/")[-1] if subscription.topic else None
            
            return Subscription(
                name=subscription_name_short,
                topic=topic_full_name,
                project_id=self.config.project_id,
                metadata=SubscriptionMetadata(
                    name=subscription_name_short,
                    topic=topic_full_name,
                    project_id=self.config.project_id,
                    ack_deadline_seconds=subscription.ack_deadline_seconds,
                    retain_acked_messages=subscription.retain_acked_messages if hasattr(subscription, "retain_acked_messages") else None,
                    message_retention_duration=str(subscription.message_retention_duration) if subscription.message_retention_duration else None,
                    labels=dict(subscription.labels) if subscription.labels else None,
                    enable_message_ordering=subscription.enable_message_ordering if hasattr(subscription, "enable_message_ordering") else None,
                    expiration_policy={
                        "ttl": str(subscription.expiration_policy.ttl) if subscription.expiration_policy and hasattr(subscription.expiration_policy, "ttl") else None,
                    } if subscription.expiration_policy else None,
                    dead_letter_policy={
                        "dead_letter_topic": subscription.dead_letter_policy.dead_letter_topic if subscription.dead_letter_policy and hasattr(subscription.dead_letter_policy, "dead_letter_topic") else None,
                        "max_delivery_attempts": subscription.dead_letter_policy.max_delivery_attempts if subscription.dead_letter_policy and hasattr(subscription.dead_letter_policy, "max_delivery_attempts") else None,
                    } if subscription.dead_letter_policy else None,
                    retry_policy={
                        "minimum_backoff": str(subscription.retry_policy.minimum_backoff) if subscription.retry_policy and hasattr(subscription.retry_policy, "minimum_backoff") else None,
                        "maximum_backoff": str(subscription.retry_policy.maximum_backoff) if subscription.retry_policy and hasattr(subscription.retry_policy, "maximum_backoff") else None,
                    } if subscription.retry_policy else None,
                    push_config={
                        "push_endpoint": subscription.push_config.push_endpoint if subscription.push_config and hasattr(subscription.push_config, "push_endpoint") else None,
                        "attributes": dict(subscription.push_config.attributes) if subscription.push_config and hasattr(subscription.push_config, "attributes") else None,
                    } if subscription.push_config else None,
                    bigquery_config=dict(subscription.bigquery_config) if subscription.bigquery_config else None,
                    cloud_storage_config=dict(subscription.cloud_storage_config) if subscription.cloud_storage_config else None,
                )
            )
            
        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")
            raise PubSubError(
                message=f"Failed to update subscription: {e}",
                details={"subscription_name": subscription_name}
            )
    
    async def delete_subscription(self, subscription_name: str) -> None:
        """
        Delete a subscription.
        
        Args:
            subscription_name: Name of the subscription to delete
            
        Example:
            await client.delete_subscription("my-subscription")
        """
        subscriber = self._get_subscriber()
        subscription_path = self._get_subscription_path(subscription_name)
        
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subscriber.delete_subscription(request={"subscription": subscription_path})
            )
            
            logger.info(f"Deleted subscription: {subscription_name}")
            
        except Exception as e:
            logger.error(f"Failed to delete subscription: {e}")
            raise PubSubError(
                message=f"Failed to delete subscription: {e}",
                details={"subscription_name": subscription_name}
            )
    
    # Message operations
    
    async def publish_message(
        self,
        topic_name: str,
        data: Union[bytes, str],
        publish_config: Optional[PublishConfig] = None,
    ) -> str:
        """
        Publish a message to a topic.
        
        Args:
            topic_name: Name of the topic
            data: Message data (bytes or string)
            publish_config: Optional publish configuration
            
        Returns:
            str: Message ID
            
        Example:
            message_id = await client.publish_message(
                topic_name="my-topic",
                data=b"Hello, World!",
                publish_config=PublishConfig(
                    attributes={"source": "api"}
                )
            )
        """
        publisher = self._get_publisher()
        topic_path = self._get_topic_path(topic_name)
        
        try:
            # Convert string to bytes if needed
            if isinstance(data, str):
                data_bytes = data.encode("utf-8")
            else:
                data_bytes = data
            
            config = publish_config or PublishConfig()
            
            future = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: publisher.publish(
                    topic_path,
                    data_bytes,
                    ordering_key=config.ordering_key,
                    **config.attributes or {}
                )
            )
            
            message_id = await asyncio.get_event_loop().run_in_executor(
                None,
                future.result
            )
            
            logger.info(f"Published message to topic: {topic_name}, message_id: {message_id}")
            
            return message_id
            
        except Exception as e:
            logger.error(f"Failed to publish message: {e}")
            raise PubSubError(
                message=f"Failed to publish message: {e}",
                details={"topic_name": topic_name}
            )
    
    async def publish_messages(
        self,
        topic_name: str,
        messages: List[Union[bytes, str, Message]],
        publish_config: Optional[PublishConfig] = None,
    ) -> List[str]:
        """
        Publish multiple messages to a topic.
        
        Args:
            topic_name: Name of the topic
            messages: List of messages (bytes, strings, or Message objects)
            publish_config: Optional publish configuration (applied to all messages)
            
        Returns:
            List[str]: List of message IDs
            
        Example:
            message_ids = await client.publish_messages(
                topic_name="my-topic",
                messages=[b"Message 1", b"Message 2", b"Message 3"]
            )
        """
        publisher = self._get_publisher()
        topic_path = self._get_topic_path(topic_name)
        
        try:
            config = publish_config or PublishConfig()
            futures = []
            
            for msg in messages:
                if isinstance(msg, Message):
                    data_bytes = msg.data
                    attrs = msg.attributes or {}
                    ordering_key = msg.ordering_key or config.ordering_key
                elif isinstance(msg, str):
                    data_bytes = msg.encode("utf-8")
                    attrs = config.attributes or {}
                    ordering_key = config.ordering_key
                else:
                    data_bytes = msg
                    attrs = config.attributes or {}
                    ordering_key = config.ordering_key
                
                future = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda d=data_bytes, o=ordering_key, a=attrs: publisher.publish(
                        topic_path,
                        d,
                        ordering_key=o,
                        **a
                    )
                )
                futures.append(future)
            
            # Wait for all messages to be published
            message_ids = []
            for future in futures:
                message_id = await asyncio.get_event_loop().run_in_executor(
                    None,
                    future.result
                )
                message_ids.append(message_id)
            
            logger.info(f"Published {len(message_ids)} messages to topic: {topic_name}")
            
            return message_ids
            
        except Exception as e:
            logger.error(f"Failed to publish messages: {e}")
            raise PubSubError(
                message=f"Failed to publish messages: {e}",
                details={"topic_name": topic_name, "message_count": len(messages)}
            )
    
    async def pull_messages(
        self,
        subscription_name: str,
        pull_config: Optional[PullConfig] = None,
    ) -> List[Message]:
        """
        Pull messages from a subscription.
        
        Args:
            subscription_name: Name of the subscription
            pull_config: Optional pull configuration
            
        Returns:
            List[Message]: List of messages
            
        Example:
            messages = await client.pull_messages(
                subscription_name="my-subscription",
                pull_config=PullConfig(max_messages=10)
            )
            for message in messages:
                print(message.decode())
        """
        subscriber = self._get_subscriber()
        subscription_path = self._get_subscription_path(subscription_name)
        
        try:
            config = pull_config or PullConfig()
            
            request = {
                "subscription": subscription_path,
                "max_messages": min(config.max_messages, 1000),  # Cap at 1000
                "return_immediately": config.return_immediately,
            }
            
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subscriber.pull(request=request)
            )
            
            messages = []
            for received_message in response.received_messages:
                message = Message(
                    data=received_message.message.data,
                    attributes=dict(received_message.message.attributes) if received_message.message.attributes else None,
                    ordering_key=received_message.message.ordering_key if received_message.message.ordering_key else None,
                    ack_id=received_message.ack_id,
                    message_id=received_message.message.message_id,
                    publish_time=received_message.message.publish_time if received_message.message.publish_time else None,
                    metadata=MessageMetadata(
                        message_id=received_message.message.message_id,
                        publish_time=received_message.message.publish_time if received_message.message.publish_time else None,
                        ordering_key=received_message.message.ordering_key if received_message.message.ordering_key else None,
                        attributes=dict(received_message.message.attributes) if received_message.message.attributes else None,
                    )
                )
                messages.append(message)
            
            logger.info(f"Pulled {len(messages)} messages from subscription: {subscription_name}")
            
            return messages
            
        except Exception as e:
            logger.error(f"Failed to pull messages: {e}")
            raise PubSubError(
                message=f"Failed to pull messages: {e}",
                details={"subscription_name": subscription_name}
            )
    
    async def acknowledge_messages(
        self,
        subscription_name: str,
        ack_ids: List[str],
    ) -> None:
        """
        Acknowledge messages (mark as processed).
        
        Args:
            subscription_name: Name of the subscription
            ack_ids: List of acknowledgment IDs from pulled messages
            
        Example:
            await client.acknowledge_messages(
                subscription_name="my-subscription",
                ack_ids=[message.ack_id for message in messages]
            )
        """
        subscriber = self._get_subscriber()
        subscription_path = self._get_subscription_path(subscription_name)
        
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subscriber.acknowledge(
                    request={
                        "subscription": subscription_path,
                        "ack_ids": ack_ids,
                    }
                )
            )
            
            logger.info(f"Acknowledged {len(ack_ids)} messages for subscription: {subscription_name}")
            
        except Exception as e:
            logger.error(f"Failed to acknowledge messages: {e}")
            raise PubSubError(
                message=f"Failed to acknowledge messages: {e}",
                details={
                    "subscription_name": subscription_name,
                    "ack_count": len(ack_ids)
                }
            )
    
    async def modify_ack_deadline(
        self,
        subscription_name: str,
        ack_ids: List[str],
        ack_deadline_seconds: int,
    ) -> None:
        """
        Modify the acknowledgment deadline for messages.
        
        Args:
            subscription_name: Name of the subscription
            ack_ids: List of acknowledgment IDs
            ack_deadline_seconds: New acknowledgment deadline in seconds
            
        Example:
            await client.modify_ack_deadline(
                subscription_name="my-subscription",
                ack_ids=[message.ack_id for message in messages],
                ack_deadline_seconds=300
            )
        """
        subscriber = self._get_subscriber()
        subscription_path = self._get_subscription_path(subscription_name)
        
        try:
            await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: subscriber.modify_ack_deadline(
                    request={
                        "subscription": subscription_path,
                        "ack_ids": ack_ids,
                        "ack_deadline_seconds": ack_deadline_seconds,
                    }
                )
            )
            
            logger.info(f"Modified ack deadline for {len(ack_ids)} messages in subscription: {subscription_name}")
            
        except Exception as e:
            logger.error(f"Failed to modify ack deadline: {e}")
            raise PubSubError(
                message=f"Failed to modify ack deadline: {e}",
                details={
                    "subscription_name": subscription_name,
                    "ack_count": len(ack_ids)
                }
            )

