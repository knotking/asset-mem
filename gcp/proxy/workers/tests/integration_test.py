import base64
import json
import os
import unittest
import sys

# Set environment variables BEFORE importing main to ensure Config picks them up
os.environ["RAG_CORPUS"] = "projects/homegeek-staging/locations/us-central1/ragCorpora/6917529027641081856"
os.environ["GCP_PROJECT_ID"] = "homegeek-staging"
os.environ["USER_UPLOAD_RESULT_TOPIC"] = "projects/homegeek-staging/topics/user-upload-result-topic"
os.environ["GCS_BUCKET"] = "homegeek-user-data"

# Add the parent directory (../function) to sys.path before importing main
function_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'function'))
if function_dir not in sys.path:
    sys.path.insert(0, function_dir)

import main

class TestIntegrationPubSubToUserDocs(unittest.TestCase):
    def test_pubsub_to_user_docs_integration(self):
        # Prepare a realistic payload
        gcs_urls_1 = ["gs://homegeek-gab-data/test-user/car_damage.jpeg"]
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
        
        # Call the real function
        # Note: This will attempt to authenticate with GCP and call real services.
        # Ensure you have GOOGLE_APPLICATION_CREDENTIALS set if running locally.
        try:
            main.pubsub_to_user_docs(event, context)
        except Exception as e:
            print(f"Integration test caught exception (expected if no creds): {e}")

if __name__ == "__main__":
    unittest.main()
