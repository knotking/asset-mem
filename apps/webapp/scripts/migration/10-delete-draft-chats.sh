#!/bin/bash

# Script to delete draft chats from Firebase
# Checks users/<user-id>/chats collection for documents with name = "draft"
# Usage: ./10-delete-draft-chats.sh [--dry-run]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 Running in DRY-RUN mode (no deletions will be performed)"
else
    echo "⚠️  Running in LIVE mode (draft chats will be deleted)"
    echo "   Use --dry-run flag to preview changes without deleting"
fi

echo ""
echo "📋 Configuration:"
echo "   Old Project: goggle-gab"
echo "   New Project: homegeekdemo"
echo "   Target Collection: users/<user-id>/chats (where name = 'draft')"
echo ""

# Check for Python 3
PYTHON_CMD=""
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
elif command -v python3.10 &> /dev/null; then
    PYTHON_CMD="python3.10"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
else
    echo "❌ Error: Python 3.10+ is required but not found"
    exit 1
fi

echo "✓ Using Python: $PYTHON_CMD"

# Setup virtual environment
VENV_DIR="$SCRIPT_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating virtual environment..."
    "$PYTHON_CMD" -m venv "$VENV_DIR"
    echo "✓ Virtual environment created"
else
    echo "✓ Using existing virtual environment"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Check if required packages are available
if ! python -c "import firebase_admin" 2>/dev/null; then
    echo "📦 Installing required packages..."
    pip install -q google-cloud-firestore firebase-admin
    echo "✓ Packages installed"
else
    echo "✓ Required packages already installed"
fi

echo ""
echo "🚀 Starting draft chat deletion process..."
echo ""

# Run the Python script
if [ "$DRY_RUN" = true ]; then
    python "$SCRIPT_DIR/delete-draft-chats.py" --dry-run
else
    python "$SCRIPT_DIR/delete-draft-chats.py"
fi

# Deactivate virtual environment
deactivate

echo ""
echo "✅ Draft chat deletion process completed!"
