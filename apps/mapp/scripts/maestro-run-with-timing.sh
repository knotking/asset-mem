#!/usr/bin/env bash
# Run a Maestro flow and print a per-step timing report from commands-*.json.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLOW="${1:-.maestro/audit-authenticated.yaml}"
shift || true

DEBUG_DIR="${ROOT}/.maestro/debug/latest"
mkdir -p "$DEBUG_DIR"

echo "▶ Maestro: $FLOW"
echo "  debug output → $DEBUG_DIR"

cd "$ROOT"
maestro test "$FLOW" \
  --config .maestro/config.yaml \
  --platform ios \
  --debug-output "$DEBUG_DIR" \
  "$@"

COMMANDS=$(find "$DEBUG_DIR" -name 'commands-*.json' -print0 | xargs -0 ls -t 2>/dev/null | head -1)
if [[ -z "$COMMANDS" ]]; then
  echo "No commands-*.json in $DEBUG_DIR; try ~/.maestro/tests"
  node scripts/maestro-timing-report.mjs --latest
else
  node scripts/maestro-timing-report.mjs "$COMMANDS"
fi
