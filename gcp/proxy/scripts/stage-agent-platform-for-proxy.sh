#!/usr/bin/env bash
# Stage agent_platform core contracts + gateway for Cloud Run source deploy.
set -euo pipefail
PROXY_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GCP_ROOT="$(cd "$PROXY_ROOT/.." && pwd)"
REPO_ROOT="$(cd "$GCP_ROOT/.." && pwd)"
DEST="$PROXY_ROOT/api/agent_platform"

resolve_platform_root() {
  if [[ -n "${AGENT_PLATFORM_ROOT:-}" && -d "${AGENT_PLATFORM_ROOT}/packages/gateway" ]]; then
    echo "${AGENT_PLATFORM_ROOT}"
    return
  fi
  if [[ -d "$REPO_ROOT/agent-platform/packages/gateway" ]]; then
    echo "$REPO_ROOT/agent-platform"
    return
  fi
  if [[ -d "$REPO_ROOT/../agent-platform/packages/gateway" ]]; then
    cd "$REPO_ROOT/../agent-platform" && pwd
    return
  fi
  echo "agent-platform not found (set AGENT_PLATFORM_ROOT or checkout beside HomeApp)" >&2
  exit 1
}

PLATFORM_ROOT="$(resolve_platform_root)"
CORE_SRC="$PLATFORM_ROOT/packages/core/src/agent_platform/core"
GATEWAY_SRC="$PLATFORM_ROOT/packages/gateway/src/agent_platform/gateway"

rm -rf "$DEST"
mkdir -p "$DEST/core" "$DEST/gateway"
cp -R "$CORE_SRC/contracts" "$DEST/core/"
cp -R "$GATEWAY_SRC/." "$DEST/gateway/"

echo "Staged agent_platform (contracts + gateway) → $DEST"
