"""Compatibility shim — use agent_platform.gateway.persist."""

from agent_platform.gateway.persist import (  # noqa: F401
    DEFAULT_BRANCH_SECTION_KEYS,
    _strip_json_fences,
    apply_message_patch_from_state_delta,
    fence_chars_removed,
    finalize_assistant_message,
    merge_branch_into_content_json,
)
