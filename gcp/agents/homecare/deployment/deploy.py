# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import vertexai
from vertexai import agent_engines
from vertexai.preview.reasoning_engines import AdkApp
from rag.agent import root_agent
import logging
import os
from dotenv import set_key
from dotenv import load_dotenv
import sys


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
load_dotenv()
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION")
STAGING_BUCKET = os.getenv("STAGING_BUCKET")
AGENT_ENGINE_ID = os.getenv("AGENT_ENGINE_ID")
# Define the path to the .env file relative to this script
ENV_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
vertexai.init(
    project=GOOGLE_CLOUD_PROJECT,
    location=GOOGLE_CLOUD_LOCATION,
    staging_bucket=STAGING_BUCKET,
)

# Function to update the .env file
def update_env_file(agent_engine_id, env_file_path):
    """Updates the .env file with the agent engine ID."""
    try:
        set_key(env_file_path, "AGENT_ENGINE_ID", agent_engine_id)
        print(f"Updated AGENT_ENGINE_ID in {env_file_path} to {agent_engine_id}")
    except Exception as e:
        print(f"Error updating .env file: {e}")

logger.info("deploying app...")
app = AdkApp(
    agent=root_agent,
    enable_tracing=True
)

def get_pickled_object_gcs_uri(agent_engine_id):
    engine = agent_engines.get(agent_engine_id)
    engine_dict = engine.to_dict()
    
    try:
        return engine_dict["spec"]["packageSpec"]["pickleObjectGcsUri"]
    except KeyError:
        logger.error("pickleObjectGcsUri not found in engine dict.")
        return None

def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "update"
    logger.info(f"Action: {action}")

    # Common configuration
    common_requirements = [
        "google-cloud-aiplatform[adk,agent-engines]==1.104.0",
        "google-adk==1.7.0",
        "python-dotenv",
        "google-auth",
        "tqdm",
        "requests",
        "llama-index",
    ]
    common_env_vars = [
        "GOOGLE_CLOUD_BUCKET",
        "USER_UPLOAD_FOLDER",
        "USER_UPLOAD_RAG_CORPUS",
        "PRODUCT_MANUAL_RAG_CORPUS",
    ]
    display_name = "OrchestratorAgent"
    extra_packages = ["./rag"]

    if action == "create":
        remote_app = agent_engines.create(
            app,
            requirements=common_requirements,
            extra_packages=extra_packages,
            display_name=display_name,
            env_vars=common_env_vars
        )
        logging.info(f"Deployed agent to Vertex AI Agent Engine successfully, resource name: {remote_app.resource_name}")
        update_env_file(remote_app.resource_name, ENV_FILE_PATH)
    elif action == "update":
        pickled_object_gcs_uri = get_pickled_object_gcs_uri(AGENT_ENGINE_ID)
        remote_agent = agent_engines.get(
            f"projects/{GOOGLE_CLOUD_PROJECT}/locations/{GOOGLE_CLOUD_LOCATION}/reasoningEngines/{AGENT_ENGINE_ID}"
        )
        if not pickled_object_gcs_uri:
            logger.error("pickled_object_gcs_uri not found for the existing engine. Cannot update.")
            return
        logger.info(f"Pickled object GCS URI: {pickled_object_gcs_uri}")
        updated_app = agent_engines.update(
            resource_name=AGENT_ENGINE_ID,
            description="OrchestratorAgentv1",
            # requirements=common_requirements,
            extra_packages=extra_packages,
            # display_name=display_name,
            # env_vars=common_env_vars,
        )
        logging.info(f"Updated agent on Vertex AI Agent Engine successfully, resource name: {updated_app.resource_name}")
        update_env_file(updated_app.resource_name, ENV_FILE_PATH)
    else:
        logger.error("Invalid action. Use 'create' or 'update'.")

if __name__ == "__main__":
    main()