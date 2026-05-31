#!/usr/bin/env bash
# Stage only proxy-safe agent_framework contracts (no registry/routing/runtime).
set -euo pipefail
PROXY_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GCP_ROOT="$(cd "$PROXY_ROOT/.." && pwd)"
SRC="$GCP_ROOT/agent_framework"
DEST="$PROXY_ROOT/api/agent_framework"

rm -rf "$DEST"
mkdir -p "$DEST/contracts"

cp "$SRC/__init__.py" "$DEST/"
cp "$SRC/contracts/__init__.py" "$DEST/contracts/"
cp "$SRC/contracts/message_patch_types.py" "$DEST/contracts/"
cp "$SRC/contracts/message_patch_v1.py" "$DEST/contracts/"

echo "Staged agent_framework contracts → $DEST"
