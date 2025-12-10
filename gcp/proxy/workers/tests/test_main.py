import unittest
from unittest.mock import patch, MagicMock
import base64
import json
import sys
import os

# Mock external dependencies before importing main
sys.modules["google"] = MagicMock()
sys.modules["google.cloud"] = MagicMock()
sys.modules["google.cloud.pubsub_v1"] = MagicMock()
sys.modules["google.cloud.aiplatform_v1"] = MagicMock()
sys.modules["google.cloud.aiplatform_v1.types"] = MagicMock()
sys.modules["google.cloud.aiplatform_v1.types.vertex_rag_data_service"] = MagicMock()
sys.modules["vertexai"] = MagicMock()
sys.modules["vertexai.rag"] = MagicMock()

# Add the parent directory (../function) to sys.path before importing main
function_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'function'))
if function_dir not in sys.path:
    sys.path.insert(0, function_dir)

import main

class TestPubSubToUserDocs(unittest.TestCase):
    @patch('main.RagService')
    @patch('main.pubsub_v1.PublisherClient')
    @patch('main.Config')
    def test_pubsub_to_user_docs_success(self, mock_config, mock_publisher_client, mock_rag_service_cls):
        # Arrange
        gcs_urls = ["gs://bucket/file1.txt"]
        user_id = "123"
        user_query = "test query"
        payload = {
            "gcs_urls": gcs_urls,
            "user_id": user_id,
            "user_query": user_query
        }
        event = {
            "data": base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
        }
        context = None

        mock_rag_instance = mock_rag_service_cls.return_value
        mock_rag_instance.import_files.return_value = {"document_import_result": "success"}
        
        mock_config.USER_UPLOAD_RESULT_TOPIC = "projects/test/topics/test-topic"
        
        mock_publisher = MagicMock()
        mock_publisher_client.return_value = mock_publisher
        future = MagicMock()
        mock_publisher.publish.return_value = future
        future.result.return_value = "msg_id"

        # Act
        main.pubsub_to_user_docs(event, context)

        # Assert
        mock_rag_service_cls.assert_called_once()
        mock_rag_instance.import_files.assert_called_once_with(gcs_urls, user_id)
        mock_publisher.publish.assert_called_once()
        args, kwargs = mock_publisher.publish.call_args
        self.assertEqual(kwargs["topic"], "projects/test/topics/test-topic")
        data = json.loads(kwargs["data"].decode("utf-8"))
        self.assertEqual(data["user_id"], user_id)
        self.assertEqual(data["success"], True)

    @patch('main.RagService')
    @patch('main.pubsub_v1.PublisherClient')
    def test_pubsub_to_user_docs_missing_fields(self, mock_publisher_client, mock_rag_service_cls):
        # Arrange
        payload = {
            "user_query": "test"
        }
        event = {
            "data": base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
        }
        context = None

        # Act
        main.pubsub_to_user_docs(event, context)

        # Assert
        mock_rag_service_cls.assert_not_called()
        mock_publisher_client.assert_not_called()

if __name__ == "__main__":
    unittest.main()
