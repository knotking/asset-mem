import base64
import json
import os
import unittest

# Adjust the import as needed for your structure
import sys
# Add the parent directory (../function) to sys.path before importing main
function_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'function'))
if function_dir not in sys.path:
    sys.path.insert(0, function_dir)
import importlib.util
os.environ["TELEGRAM_API_WEBHOOK_URL"] = "https://httpbin.org/post"  # Use httpbin for safe POST testing
os.environ["RAG_CORPUS"] = "projects/homegeekdemo/locations/us-central1/ragCorpora/1689975760170778624"
main_path = os.path.join(function_dir, "main.py")
spec = importlib.util.spec_from_file_location("main", main_path)
main = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main)
sys.modules["main"] = main

class TestIntegrationPubSubToTelegram(unittest.TestCase):
    def setUp(self):
        # Set environment variables for integration test
        os.environ["TELEGRAM_API_WEBHOOK_URL"] = "https://httpbin.org/post"  # Use httpbin for safe POST testing
        os.environ["RAG_CORPUS"] = "projects/homegeekdemo/locations/us-central1/ragCorpora/1689975760170778624"
        # Optionally set WEBHOOK_SECRET if your code requires it

    def test_pubsub_to_telegram_integration(self):
        # Prepare a realistic payload
        gcs_urls = ["gs://homegeek-user-data/telegram_uploads/538445573/photo_AgACAgUAAxkBAAIEyGiE_H28Zu0ekcqDWFVWntywsOR0AAIS0DEbP80pVGvcxuTbp-jGAQADAgADbQADNgQ.jpg"]
        user_id = "integration_test_user"
        user_query = "integration test query"
        payload = {
            "gcs_urls": gcs_urls,
            "user_id": user_id,
            "user_query": user_query
        }
        event = {
            "data": base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
        }
        context = None

        # Call the real function (this will POST to httpbin and try to call Vertex AI)
        main.pubsub_to_telegram(event, context)

        # There is no assert here because this is an integration test.
        # You can check logs or manually inspect httpbin output.
        # For a real integration, you might check for side effects or use mocks for external calls.

if __name__ == "__main__":
    unittest.main()