"""Generic ADK tool / before_model guard helpers."""

from __future__ import annotations

import logging
from typing import Any, Callable, FrozenSet, Optional

logger = logging.getLogger(__name__)


def block_tools_on_flag(
    state: Any,
    *,
    flag_key: str,
    blocked_tool_names: FrozenSet[str],
    result_message: str,
    tool_name: str,
    resolved_casual: bool = False,
) -> Optional[dict]:
    """Block named tools when a session flag or resolved casual turn is set."""
    if resolved_casual or (state is not None and state.get(flag_key)):
        if tool_name in blocked_tool_names:
            logger.info(
                "tool_guards: blocked tool=%s flag=%s casual=%s",
                tool_name,
                flag_key,
                resolved_casual,
            )
            return {"result": result_message}
    return None


def fail_closed_on_resolve_error(
    ctx: Any,
    *,
    llm_request: Any = None,
    resolve_user_query: Callable[..., str],
    is_greeting_fn: Callable[[str], bool],
    normalize_query_fn: Callable[[str], str],
    build_greeting_fn: Callable[[Any], Any],
) -> Optional[Any]:
    """When resolve fails, only short-circuit obvious greetings."""
    _ = llm_request
    try:
        user_query = resolve_user_query(ctx, llm_request=llm_request)
        if user_query and is_greeting_fn(normalize_query_fn(user_query)):
            return build_greeting_fn(ctx)
    except Exception:
        logger.exception("fail_closed_on_resolve_error failed")
    return None
