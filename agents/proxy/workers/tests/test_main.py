import unittest
from unittest.mock import patch, MagicMock
import base64
import json
import sys
import os

# Add the parent directory (../function) to sys.path before importing main
function_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'function'))
if function_dir not in sys.path:
    sys.path.insert(0, function_dir)
import importlib.util

main_path = os.path.join(function_dir, "main.py")
spec = importlib.util.spec_from_file_location("main", main_path)
main = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main)
sys.modules["main"] = main

class TestPubSubToTelegram(unittest.TestCase):
    @patch('main.import_to_rag_corpus')
    @patch('main.requests.post')
    def test_pubsub_to_telegram_success(self, mock_post, mock_import):
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

        mock_import.return_value = (False, "'NoneType' object has no attribute 'split'")
        mock_post.return_value.status_code = 200
        mock_post.return_value.text = "OK"

        # Act
        main.pubsub_to_telegram(event, context)

        # Assert
        mock_import.assert_called_once_with(gcs_urls)
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertIn("user_id", kwargs["json"])
        self.assertEqual(kwargs["json"]["user_id"], user_id)

    @patch('main.import_to_rag_corpus')
    @patch('main.requests.post')
    def test_pubsub_to_telegram_missing_fields(self, mock_post, mock_import):
        # Arrange
        payload = {
            "user_query": "test"
        }
        event = {
            "data": base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
        }
        context = None

        # Act
        main.pubsub_to_telegram(event, context)

        # Assert
        mock_import.assert_not_called()
        mock_post.assert_not_called()

if __name__ == "__main__":
    unittest.main()