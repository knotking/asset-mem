#!/bin/bash

##
# Delete Firebase users matching a specific pattern
# This script will:
# 1. Find all Firebase Auth users matching the pattern
# 2. Delete all Firestore documents under users/{userId}/
# 3. Delete all Storage files under uploads/{userId}/ and documents/{userId}/
# 4. Delete the Firebase Auth user account
#
# Prerequisites:
# - Firebase CLI installed (firebase-tools)
# - gcloud CLI installed
# - gsutil installed
# - Python 3.10+ with firebase-admin
# - Proper authentication and permissions
#
# Usage:
#   PROJECT=your-project PATTERN="test-*" ./delete-users-by-pattern.sh [--dry-run]
#   or
#   ./delete-users-by-pattern.sh --pattern "test-*" --project your-project [--dry-run]
#
# Options:
#   --pattern PATTERN    Email pattern to match (e.g., "test-*", "*@example.com")
#   --project PROJECT    Firebase project ID
#   --dry-run           Preview what will be deleted without actually deleting
##

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default values
PROJECT="${PROJECT:-}"
PATTERN="${PATTERN:-}"
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --pattern)
            PATTERN="$2"
            shift 2
            ;;
        --project)
            PROJECT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 --pattern PATTERN --project PROJECT [--dry-run]"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$PROJECT" ]; then
    echo "❌ Error: PROJECT is required"
    echo "Usage: PROJECT=your-project PATTERN='test-*' $0 [--dry-run]"
    echo "   or: $0 --pattern 'test-*' --project your-project [--dry-run]"
    exit 1
fi

if [ -z "$PATTERN" ]; then
    echo "❌ Error: PATTERN is required"
    echo "Usage: PROJECT=your-project PATTERN='test-*' $0 [--dry-run]"
    echo "   or: $0 --pattern 'test-*' --project your-project [--dry-run]"
    exit 1
fi

echo ""
echo "🗑️  Firebase User Deletion Script"
echo "=================================="
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN MODE - No deletions will be performed"
else
    echo "⚠️  LIVE MODE - Data will be permanently deleted!"
    echo "   Use --dry-run flag to preview changes first"
fi

echo ""
echo "📋 Configuration:"
echo "   Project: $PROJECT"
echo "   Pattern: $PATTERN"
echo ""

# Check required tools
echo "🔧 Checking prerequisites..."

if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi
echo "   ✓ Firebase CLI"

if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
echo "   ✓ gcloud CLI"

if ! command -v gsutil &> /dev/null; then
    echo "❌ gsutil not found. Install gcloud SDK."
    exit 1
fi
echo "   ✓ gsutil"

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
echo "   ✓ Python: $PYTHON_CMD"

# Setup virtual environment
VENV_DIR="$SCRIPT_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo ""
    echo "📦 Creating virtual environment..."
    "$PYTHON_CMD" -m venv "$VENV_DIR"
    echo "✓ Virtual environment created"
else
    echo "   ✓ Virtual environment exists"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Check if required packages are available
if ! python -c "import firebase_admin" 2>/dev/null; then
    echo ""
    echo "📦 Installing required packages..."
    pip install -q google-cloud-firestore google-cloud-storage firebase-admin
    echo "✓ Packages installed"
else
    echo "   ✓ Required packages installed"
fi

echo ""
echo "🔗 Verifying Firebase connection..."

# Set gcloud project
gcloud config set project "$PROJECT" --quiet

# Verify Firebase Authentication
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null)
echo "   Authenticated as: $CURRENT_ACCOUNT"

# Verify bucket access
BUCKET="gs://${PROJECT}.firebasestorage.app"
if ! gsutil ls "$BUCKET" &> /dev/null 2>&1; then
    echo "⚠️  Warning: Cannot access storage bucket: $BUCKET"
    echo "   Storage deletion may fail. Continuing with Firestore and Auth..."
else
    echo "   ✓ Storage bucket accessible: $BUCKET"
fi

echo ""
echo "🚀 Starting user deletion process..."
echo ""

# Run the Python script
if [ "$DRY_RUN" = true ]; then
    python "$SCRIPT_DIR/delete-users-by-pattern.py" \
        --project "$PROJECT" \
        --pattern "$PATTERN" \
        --dry-run
else
    python "$SCRIPT_DIR/delete-users-by-pattern.py" \
        --project "$PROJECT" \
        --pattern "$PATTERN"
fi

EXIT_CODE=$?

# Deactivate virtual environment
deactivate

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    if [ "$DRY_RUN" = true ]; then
        echo "✅ Dry run completed successfully!"
        echo ""
        echo "📝 Next steps:"
        echo "   Review the output above to verify the users and data to be deleted"
        echo "   Run without --dry-run flag to perform actual deletions"
    else
        echo "✅ User deletion process completed!"
    fi
else
    echo "❌ User deletion process failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
fi

echo ""
