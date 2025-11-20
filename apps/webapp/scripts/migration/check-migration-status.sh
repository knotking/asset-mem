#!/bin/bash

# Check Migration Status
# Quick utility to check current migration state

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for Python 3
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    echo "❌ Error: Python 3 is required"
    exit 1
fi

echo "🔍 Checking Migration Status..."
echo ""

"$PYTHON_CMD" "$SCRIPT_DIR/migration-state-tracker.py" status
