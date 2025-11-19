#!/bin/bash

##
# Migrate Vertex AI RAG Corpus from old to new project
#
# This script re-imports all user documents to a new RAG corpus
# by querying Firestore for active documents and batch importing them.
#
# Prerequisites:
# - New RAG corpus created in Vertex AI Console
# - gcloud authenticated (gcloud auth application-default login)
# - jq installed (for JSON parsing)
# - Firestore data already migrated
# - Storage files already migrated
#
# Usage:
#   NEW_RAG_CORPUS="projects/.../ragCorpora/XXX" ./9-migrate-rag-corpus.sh [options]
#
# Options:
#   --dry-run    Preview what will be imported without making changes
#
# Example:
#   NEW_RAG_CORPUS="projects/homegeekdemo/locations/us-central1/ragCorpora/1234567890" ./9-migrate-rag-corpus.sh
#   NEW_RAG_CORPUS="projects/homegeekdemo/locations/us-central1/ragCorpora/1234567890" ./9-migrate-rag-corpus.sh --dry-run
##

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
GCP_PROJECT_ID="${GCP_PROJECT_ID:-homegeekdemo}"
GCP_REGION="${GCP_REGION:-us-central1}"
GCS_BUCKET="${GCS_BUCKET:-homegeek-user-data}"
NEW_RAG_CORPUS="${NEW_RAG_CORPUS:-}"
DRY_RUN="false"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN="true"
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Usage: $0 [--dry-run]"
            exit 1
            ;;
    esac
done

echo ""
echo "🔄 Vertex AI RAG Corpus Migration"
echo ""

# Validate NEW_RAG_CORPUS is set
if [ -z "$NEW_RAG_CORPUS" ]; then
    echo "❌ Error: NEW_RAG_CORPUS environment variable not set"
    echo ""
    echo "Please set the new RAG corpus ID:"
    echo "  export NEW_RAG_CORPUS='projects/homegeekdemo/locations/us-central1/ragCorpora/YOUR_CORPUS_ID'"
    echo ""
    echo "To create a new corpus:"
    echo "  1. Go to Vertex AI Console → RAG"
    echo "  2. Create new corpus"
    echo "  3. Copy the corpus resource name"
    echo ""
    exit 1
fi

echo "   Project: $GCP_PROJECT_ID"
echo "   Region: $GCP_REGION"
echo "   Target Corpus: $NEW_RAG_CORPUS"
echo "   GCS Bucket: gs://$GCS_BUCKET"

if [ "$DRY_RUN" = "true" ]; then
    echo ""
    echo "   🔍 DRY RUN MODE - No actual imports will be performed"
fi

echo ""

# Check Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is required but not installed"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js is installed"

# Check gcloud is authenticated
echo "🔐 Checking authentication..."
if ! gcloud auth application-default print-access-token &> /dev/null; then
    echo "❌ Not authenticated with gcloud"
    echo ""
    echo "Please run:"
    echo "  gcloud auth application-default login"
    echo ""
    exit 1
fi
echo "✓ Authentication verified"
echo ""

# Confirmation prompt (skip in dry-run mode)
if [ "$DRY_RUN" != "true" ]; then
    echo "⚠️  This will import all user documents to the new RAG corpus:"
    echo "   $NEW_RAG_CORPUS"
    echo ""
    echo "   This operation:"
    echo "   - Queries Firestore for all user documents"
    echo "   - Verifies files exist in migrated storage"
    echo "   - Imports files to new RAG corpus"
    echo "   - Generates new import result files"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled"
        exit 0
    fi
    echo ""
fi

# Check Python availability
echo "🐍 Checking Python..."

# Try to find Python 3.10+ first (better compatibility)
PYTHON_CMD=""
for py_cmd in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$py_cmd" &> /dev/null; then
        PY_VERSION=$("$py_cmd" --version 2>&1 | awk '{print $2}')
        PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
        PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)

        if [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -ge 10 ]; then
            PYTHON_CMD="$py_cmd"
            echo "✓ Python installed: $PY_VERSION (using $py_cmd)"
            break
        fi
    fi
done

# Fallback to any python3 if no 3.10+ found
if [ -z "$PYTHON_CMD" ]; then
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
        PY_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
        echo "⚠️  Python $PY_VERSION found (Python 3.10+ recommended for better compatibility)"
    else
        echo "❌ Error: Python 3 is required but not installed"
        echo "   Install from: https://www.python.org/downloads/"
        echo "   Recommended: Python 3.10 or higher"
        exit 1
    fi
fi

# Setup virtual environment
VENV_DIR="$SCRIPT_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating virtual environment..."
    "$PYTHON_CMD" -m venv "$VENV_DIR"
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Check if required packages are available
echo "📦 Checking Python packages..."
if ! python -c "import vertexai" 2>/dev/null; then
    echo "⚠️  Installing required packages in virtual environment..."
    echo ""
    pip install google-cloud-firestore google-cloud-storage google-cloud-aiplatform || {
        echo ""
        echo "❌ Failed to install packages"
        exit 1
    }
    echo ""
fi
echo "✓ Python packages available"
echo ""

# Run Python migration script
RAG_MIGRATE_SCRIPT="$SCRIPT_DIR/rag-migrate.py"

if [ ! -f "$RAG_MIGRATE_SCRIPT" ]; then
    echo "❌ Migration script not found: $RAG_MIGRATE_SCRIPT"
    exit 1
fi

echo "🚀 Starting migration..."
echo ""

export GCP_PROJECT_ID="$GCP_PROJECT_ID"
export GCP_REGION="$GCP_REGION"
export GCS_BUCKET="$GCS_BUCKET"
export NEW_RAG_CORPUS="$NEW_RAG_CORPUS"
export DRY_RUN="$DRY_RUN"

# Run Python script (using venv's python)
python "$RAG_MIGRATE_SCRIPT"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    if [ "$DRY_RUN" = "true" ]; then
        echo "📝 Next step: Run without --dry-run to perform actual import"
    else
        echo "📝 Migration complete!"
        echo ""
        echo "Next steps:"
        echo "   1. Verify imports in Vertex AI Console"
        echo "   2. Update RAG corpus environment variables:"
        echo "      - gcp/agents/homecare/.env"
        echo "      - GitHub Actions secrets"
        echo "      - Cloud Function environment"
        echo "   3. Deploy agents with new corpus ID"
        echo "   4. Test user document queries"
        echo "   5. Monitor for any errors"
        echo ""
        echo "After verification (30 days):"
        echo "   - Delete old RAG corpus from goggle-gab project"
    fi
    echo ""
else
    echo ""
    echo "❌ Migration failed"
    echo ""
    echo "Check the error messages above for details"
    exit 1
fi
