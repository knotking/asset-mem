#!/usr/bin/env bash
# Deprecated — use stage-agent-platform-for-proxy.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$SCRIPT_DIR/stage-agent-platform-for-proxy.sh"
