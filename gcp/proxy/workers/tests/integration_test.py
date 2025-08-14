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
os.environ["GCP_PROJECT_ID"] = "homegeekdemo"
os.environ["GCP_LOCATION"] = "us-central1"
os.environ["USER_UPLOAD_RESULT_TOPIC"] = "projects/homegeekdemo/topics/user-upload-result-topic"
os.environ["GCS_BUCKET"] = "homegeek-user-data"

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
        os.environ["GCP_PROJECT_ID"] = "homegeekdemo"
        os.environ["GCP_LOCATION"] = "us-central1"
        os.environ["USER_UPLOAD_RESULT_TOPIC"] = "projects/homegeekdemo/topics/user-upload-result-topic"
        os.environ["GCS_BUCKET"] = "homegeek-user-data"

    def test_pubsub_to_user_uploads_integration(self):
        # Prepare a realistic payload
        gcs_urls_1 = ["gs://homegeek-user-data/uploads/test_user/issue2.png"]
        gcs_urls_2 = ["gs://homegeek-user-data/uploads/538445573/ExecuteDownloadPolicyDocument.pdf"]
        user_id = "user"
        user_query = "Help me with this"
        source = "integration_test_source"
        payload = {
            "gcs_urls": gcs_urls_1,
            "user_id": user_id,
            "user_query": user_query,
            "source": source
        }
        event = {
            "data": base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
        }
        context = None
        payload2 = {
            "gcs_urls": gcs_urls_2,
            "user_id": user_id,
            "user_query": user_query,
            "source": source
        }
        event2 = {
            "data": base64.b64encode(json.dumps(payload2).encode("utf-8")).decode("utf-8")
        }
        # Call the real function (this will POST to httpbin and try to call Vertex AI)
        main.pubsub_to_user_uploads(event, context)
        main.pubsub_to_user_uploads(event2, context)

        # There is no assert here because this is an integration test.
        # You can check logs or manually inspect httpbin output.
        # For a real integration, you might check for side effects or use mocks for external calls.

if __name__ == "__main__":
    unittest.main()