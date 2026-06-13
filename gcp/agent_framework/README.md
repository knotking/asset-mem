# Deprecated — use agent-platform

Homecare and the proxy now depend on **`agent-platform`** directly (`agent_platform.core`, `agent_platform.adk`, `agent_platform.gateway`).

This directory remains as a **compatibility shim** for any external code still importing `agent_framework.*`. Each submodule re-exports from `agent_platform.*`.

**Do not add new imports of `agent_framework` in HomeApp.**
