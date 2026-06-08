#!/usr/bin/env bash
# Wrapper for run-deletion-scenarios.py (uses migration venv when present).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="${SCRIPT_DIR}/venv/bin/python3"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Migration venv not found. Run once: ./delete-users-by-pattern.sh --help" >&2
  echo "(that creates ${SCRIPT_DIR}/venv with firebase-admin)" >&2
  exit 1
fi

export PYTHONUNBUFFERED=1
exec "$VENV_PYTHON" "${SCRIPT_DIR}/run-deletion-scenarios.py" "$@"
