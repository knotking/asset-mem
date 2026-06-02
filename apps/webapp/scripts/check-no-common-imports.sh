#!/usr/bin/env bash
# Fail if webapp src imports @homeapp/common (App Hosting does not bundle it).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Match import/require lines only (not doc comments mentioning @homeapp/common).
IMPORT_PATTERN='(from|import|require\()[[:space:]]*['\''"]@homeapp/common'

find_imports() {
  if command -v rg >/dev/null 2>&1; then
    rg -n "$IMPORT_PATTERN" src --glob '*.{ts,tsx}' || true
  else
    grep -RInE "$IMPORT_PATTERN" src --include='*.ts' --include='*.tsx' || true
  fi
}

matches="$(find_imports)"
if [ -n "$matches" ]; then
  echo "error: webapp must not import @homeapp/common (Firebase App Hosting)." >&2
  echo "Mirror the module under src/lib or src/hooks — see docs/CHAT.md." >&2
  echo "$matches" >&2
  exit 1
fi

echo "OK: no @homeapp/common imports in apps/webapp/src"
