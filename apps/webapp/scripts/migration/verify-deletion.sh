#!/usr/bin/env bash
# Wrapper for verify-deletion.py (uses migration venv when present).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="${SCRIPT_DIR}/venv/bin/python3"

if [[ -x "$VENV_PYTHON" ]]; then
  exec "$VENV_PYTHON" "${SCRIPT_DIR}/verify-deletion.py" "$@"
fi

if command -v python3.11 &>/dev/null; then
  exec python3.11 "${SCRIPT_DIR}/verify-deletion.py" "$@"
fi

exec python3 "${SCRIPT_DIR}/verify-deletion.py" "$@"
