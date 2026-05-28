"""Logging context bind/unbind for ADK root-agent plugins."""

from __future__ import annotations

import logging
from typing import Any

from agent_framework.observability.logging_context import (
    bind_auth_uid,
    bind_correlation_id,
    unbind_auth_uid,
    unbind_correlation_id,
)
from agent_framework.state.context_ids import (
    resolve_auth_uid_from_context,
    resolve_correlation_id_from_context,
)

logger = logging.getLogger(__name__)


class LoggingRootAgentPlugin:
    """Mixin: bind auth uid + correlation id around ADK callbacks."""

    def bind_request_context(self, ctx: Any) -> None:
        uid = resolve_auth_uid_from_context(ctx)
        cid = resolve_correlation_id_from_context(ctx)
        bind_auth_uid(uid)
        bind_correlation_id(cid)
        logger.debug(
            "ADK request context bound uid=%s correlation_id=%s",
            bool(uid),
            cid or "-",
        )

    def unbind_request_context(self) -> None:
        unbind_correlation_id()
        unbind_auth_uid()
