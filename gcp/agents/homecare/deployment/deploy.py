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
import sys
from contextlib import contextmanager
from typing import Iterator, Sequence

import vertexai
from dotenv import load_dotenv, set_key
from vertexai import agent_engines
from vertexai.agent_engines import _agent_engines as agent_engine_sdk

from agent_engine_bundle import (
    build_extra_packages_tar,
    load_agent_engine_requirements,
    stage_extra_packages,
    validate_agent_engine_requirements,
    validate_extra_packages_tar,
)
from property_agent.runtime.agent import root_agent
from property_agent.vertex_app import HomecareAdkApp

_EXTRA_PACKAGES_FILE = "dependencies.tar.gz"


@contextmanager
def _flat_extra_packages_upload(
    staged_paths: Sequence[str],
) -> Iterator[None]:
    """Patch Vertex SDK upload so bundled packages use flat import roots."""

    original_upload = agent_engine_sdk._upload_extra_packages

    def _upload_flat(
        *,
        extra_packages: Sequence[str],
        gcs_bucket,
        gcs_dir_name: str,
        logger: logging.Logger = agent_engine_sdk._LOGGER,
    ) -> None:
        del extra_packages
        tar_bytes = build_extra_packages_tar(staged_paths)
        validate_extra_packages_tar(tar_bytes)
        logger.info("Creating in-memory tarfile of extra_packages")
        blob = gcs_bucket.blob(f"{gcs_dir_name}/{_EXTRA_PACKAGES_FILE}")
        blob.upload_from_string(tar_bytes)
        dir_name = f"gs://{gcs_bucket.name}/{gcs_dir_name}"
        logger.info(f"Writing to {dir_name}/{_EXTRA_PACKAGES_FILE}")

    agent_engine_sdk._upload_extra_packages = _upload_flat
    try:
        yield
    finally:
        agent_engine_sdk._upload_extra_packages = original_upload


_deploy_log_level = os.getenv("AGENT_DEPLOY_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _deploy_log_level, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)
load_dotenv()
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = (
    "global"  # Google Cloud Location is always global for Agent Engine
)
DEPLOY_LOCATION = os.getenv(
    "GOOGLE_CLOUD_LOCATION"
)  # Deploy Location is the location where the Agent Engine is deployed
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
app = HomecareAdkApp(
    agent=root_agent,
    enable_tracing=True,
)


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "update"
    environment = sys.argv[2] if len(sys.argv) > 2 else "staging"
    logger.info(f"Action: {action}, Environment: {environment}")

    # Production dependencies are sourced from pyproject.toml so deploy-time
    # pins always match what's resolved into uv.lock locally.
    common_requirements = load_agent_engine_requirements()
    validate_agent_engine_requirements(common_requirements)
    required_env_vars = [
        "GOOGLE_CLOUD_BUCKET",
        "USER_UPLOAD_FOLDER",
        "USER_UPLOAD_RAG_CORPUS",
        "KNOWLEDGE_BASE_RAG_CORPUS",
        "USER_UPLOAD_TOPIC",
        "SERP_API_KEY",
    ]
    optional_env_vars = ["YOUTUBE_API_KEY"]
    # Always pushed to Agent Engine on create/update (values from local env or defaults).
    runtime_env_defaults = {
        "HOMEAPP_CHECKPOINT_PROGRESS_RUNNER": "1",
        "CHECKPOINT_TIMING_METRICS": "1",
    }
    for name, default in runtime_env_defaults.items():
        os.environ.setdefault(name, default)
    runtime_env_vars = list(runtime_env_defaults.keys())
    common_env_vars = (
        required_env_vars
        + runtime_env_vars
        + [name for name in optional_env_vars if os.getenv(name)]
    )
    logger.info(
        "Agent Engine runtime env: %s",
        ", ".join(f"{k}={os.environ.get(k)!r}" for k in runtime_env_vars),
    )
    display_name = f"HomecareAgent-{environment}"

    # Validate environment variables
    missing_env_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_env_vars:
        logger.error(f"Missing required environment variables: {missing_env_vars}")
        raise ValueError(f"Missing required environment variables: {missing_env_vars}")

    staging_dir, extra_packages = stage_extra_packages()
    logger.info(
        "Staged Agent Engine extra packages in %s: %s",
        staging_dir,
        extra_packages,
    )

    try:
        with _flat_extra_packages_upload(extra_packages):
            if action == "create":
                remote_app = agent_engines.create(
                    app,
                    requirements=common_requirements,
                    extra_packages=extra_packages,
                    display_name=display_name,
                    env_vars=common_env_vars,
                )
                logging.info(
                    "Deployed agent to Vertex AI Agent Engine successfully, "
                    "resource name: %s",
                    remote_app.resource_name,
                )
                update_env_file(remote_app.resource_name, ENV_FILE_PATH)
            elif action == "update":
                updated_app = agent_engines.update(
                    resource_name=AGENT_ENGINE_ID,
                    agent_engine=app,
                    env_vars=common_env_vars,
                    requirements=common_requirements,
                    extra_packages=extra_packages,
                )
                logging.info(
                    "Updated agent on Vertex AI Agent Engine successfully, "
                    "resource name: %s",
                    updated_app.resource_name,
                )
                update_env_file(updated_app.resource_name, ENV_FILE_PATH)
            else:
                logger.error("Invalid action. Use 'create' or 'update'.")
    finally:
        import shutil

        shutil.rmtree(staging_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
