"""Compatibility shim — use agent_platform.gateway.patch_state."""

from agent_platform.gateway.patch_state import (  # noqa: F401
    DEFAULT_CONTENT_JSON_DROP_PATHS,
    apply_patches_deterministically,
    build_assistant_message_patch,
    constrain_content_json_size,
    is_stale_revision,
    next_revision,
    normalize_revision,
    should_apply_patch,
    validate_assistant_message_patch,
)
