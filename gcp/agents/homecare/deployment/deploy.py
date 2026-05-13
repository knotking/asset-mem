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

import logging
import os
import pathlib
import sys
import tomllib

import vertexai
from dotenv import load_dotenv, set_key
from vertexai import agent_engines
from vertexai.preview.reasoning_engines import AdkApp

from property_agent.agent import root_agent

# Distributions present in pyproject.toml that should NOT be sent to the
# Agent Engine runtime: stale package, or local CLI/eval helpers only.
_AGENT_ENGINE_EXCLUDED_DISTS = frozenset({"adk", "tabulate", "tool", "tools", "tqdm"})


def _requirement_distribution_name(requirement: str) -> str:
    """Extract the distribution name from a PEP 508 requirement string."""
    name = requirement
    for sep in ("[", "=", ">", "<", "!", "~", ";", " "):
        name = name.split(sep, 1)[0]
    return name.strip()


def _load_agent_engine_requirements() -> list[str]:
    """Return ``project.dependencies`` from pyproject.toml minus local-only deps.

    Keeping the deploy-time list in sync with the local environment used to be a
    manual chore; this reads the same pins ``uv`` resolves against so the two
    can no longer drift.
    """
    pyproject_path = pathlib.Path(__file__).resolve().parent.parent / "pyproject.toml"
    with pyproject_path.open("rb") as fh:
        pyproject = tomllib.load(fh)
    dependencies = pyproject.get("project", {}).get("dependencies", [])
    return [
        req
        for req in dependencies
        if _requirement_distribution_name(req) not in _AGENT_ENGINE_EXCLUDED_DISTS
    ]


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
load_dotenv()
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = 'global' # Google Cloud Location is always global for Agent Engine
DEPLOY_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION") # Deploy Location is the location where the Agent Engine is deployed
STAGING_BUCKET = os.getenv("STAGING_BUCKET")
AGENT_ENGINE_ID = os.getenv("AGENT_ENGINE_ID")
# Define the path to the .env file relative to this script
ENV_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
vertexai.init(
    project=GOOGLE_CLOUD_PROJECT,
    location=DEPLOY_LOCATION,
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

def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "update"
    environment = sys.argv[2] if len(sys.argv) > 2 else "staging"
    logger.info(f"Action: {action}, Environment: {environment}")

    # Production dependencies are sourced from pyproject.toml so deploy-time
    # pins always match what's resolved into uv.lock locally.
    common_requirements = _load_agent_engine_requirements()
    required_env_vars = [
        "GOOGLE_CLOUD_BUCKET",
        "USER_UPLOAD_FOLDER",
        "USER_UPLOAD_RAG_CORPUS",
        "KNOWLEDGE_BASE_RAG_CORPUS",
        "USER_UPLOAD_TOPIC",
        "SERP_API_KEY",
    ]
    optional_env_vars = ["YOUTUBE_API_KEY"]
    common_env_vars = required_env_vars + [
        name for name in optional_env_vars if os.getenv(name)
    ]
    display_name = f"HomecareAgent-{environment}"
    extra_packages = ["./property_agent"]

    # Validate environment variables
    missing_env_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_env_vars:
        logger.error(f"Missing required environment variables: {missing_env_vars}")
        raise ValueError(f"Missing required environment variables: {missing_env_vars}")

    if action == "create":
        # try:
        #     current_engine = agent_engines.get(AGENT_ENGINE_ID)
        #     if current_engine:
        #         try:
        #             logger.info(f"Deleting existing engine: {AGENT_ENGINE_ID}")
        #             current_engine.delete(force=True)
        #             logger.info("Existing engine deleted successfully")
        #         except Exception as e:
        #             logger.error(f"Error deleting current engine: {e}")
        # except Exception as e:
        #     logger.warning(f"Could not retrieve existing engine (this is expected if it doesn't exist): {e}")

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
 
        updated_app = agent_engines.update(
            resource_name=AGENT_ENGINE_ID,
            agent_engine=app,
            env_vars=common_env_vars,
            requirements=common_requirements,
            extra_packages=extra_packages
        )
        logging.info(f"Updated agent on Vertex AI Agent Engine successfully, resource name: {updated_app.resource_name}")
        update_env_file(updated_app.resource_name, ENV_FILE_PATH)
    else:
        logger.error("Invalid action. Use 'create' or 'update'.")

if __name__ == "__main__":
    main()