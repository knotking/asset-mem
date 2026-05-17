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

"""Vertex AI ``AdkApp`` with ADK ``App``-level session compaction on Agent Engine."""

from __future__ import annotations

import logging

from google.adk.runners import Runner
from vertexai.preview.reasoning_engines import AdkApp

from property_agent.app_config import property_app

logger = logging.getLogger(__name__)


class HomecareAdkApp(AdkApp):
    """``AdkApp`` that wires ``Runner(app=property_app)`` so compaction runs post-invocation."""

    def set_up(self) -> None:
        super().set_up()
        self._wire_runners_with_property_app()

    def _wire_runners_with_property_app(self) -> None:
        app_name = self._tmpl_attrs.get("app_name")
        credential_service = self._tmpl_attrs.get("credential_service")

        self._tmpl_attrs["app"] = property_app
        self._tmpl_attrs["runner"] = Runner(
            app=property_app,
            app_name=app_name,
            session_service=self._tmpl_attrs.get("session_service"),
            artifact_service=self._tmpl_attrs.get("artifact_service"),
            memory_service=self._tmpl_attrs.get("memory_service"),
            credential_service=credential_service,
        )
        self._tmpl_attrs["in_memory_runner"] = Runner(
            app=property_app,
            app_name=app_name,
            session_service=self._tmpl_attrs.get("in_memory_session_service"),
            artifact_service=self._tmpl_attrs.get("in_memory_artifact_service"),
            memory_service=self._tmpl_attrs.get("in_memory_memory_service"),
            credential_service=credential_service,
        )
        compaction = property_app.events_compaction_config
        if compaction:
            logger.info(
                "HomecareAdkApp runners use events_compaction_config "
                "token_threshold=%s event_retention_size=%s",
                compaction.token_threshold,
                compaction.event_retention_size,
            )
        else:
            logger.info("HomecareAdkApp runners use property_app without compaction")
