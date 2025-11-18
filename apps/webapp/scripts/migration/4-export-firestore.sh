#!/bin/bash

##
# Export Cloud Firestore data from source project
#
# Prerequisites:
# - gcloud CLI installed and authenticated with PERSONAL account (not service account)
# - Proper permissions on source project
#
# Before running:
#   gcloud auth login
#   gcloud config set account your-email@domain.com
#   gcloud config set project <your-source-project>
#
# Usage:
#   SOURCE_PROJECT=goggle-gab ./3-export-firestore.sh
#   or
#   ./3-export-firestore.sh  # uses default: goggle-gab
##

set -e

SOURCE_PROJECT="${SOURCE_PROJECT:-goggle-gab}"

# Check authentication
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [[ "$CURRENT_ACCOUNT" == *"iam.gserviceaccount.com"* ]]; then
    echo ""
    echo "⚠️  You're authenticated as a service account: $CURRENT_ACCOUNT"
    echo ""
    echo "Firestore export requires a personal Google account with proper permissions."
    echo ""
    echo "Please authenticate with your personal account:"
    echo "  gcloud auth login"
    echo "  gcloud config set account your-email@domain.com"
    echo "  gcloud config set project $SOURCE_PROJECT"
    echo ""
    echo "Then run this script again."
    echo ""
    exit 1
fi

# Use the existing Firebase Storage bucket instead of creating a new one
BACKUP_BUCKET="gs://${SOURCE_PROJECT}.firebasestorage.app"
EXPORT_PREFIX="firestore-migration/firestore-$(date +%Y-%m-%d-%H%M)"

echo ""
echo "🔄 Starting Firestore export from $SOURCE_PROJECT..."
echo ""

# Check if bucket is accessible
echo "📦 Checking backup bucket access..."
if ! gsutil ls "$BACKUP_BUCKET" &> /dev/null; then
    echo ""
    echo "❌ Cannot access bucket: $BACKUP_BUCKET"
    echo ""
    echo "Possible solutions:"
    echo "1. Authenticate with your Google account (not service account):"
    echo "   gcloud auth login"
    echo "   gcloud auth application-default login"
    echo ""
    echo "2. Or grant the current account access to $SOURCE_PROJECT:"
    echo "   - Go to Google Cloud Console → IAM"
    echo "   - Add 'Storage Admin' role to current account"
    echo ""
    exit 1
fi

echo "   ✓ Bucket is accessible"

# Start export
echo ""
echo "📤 Starting Firestore export..."
echo "   Source: $SOURCE_PROJECT"
echo "   Destination: $BACKUP_BUCKET/$EXPORT_PREFIX"
echo ""

OPERATION=$(gcloud firestore export "$BACKUP_BUCKET/$EXPORT_PREFIX" \
    --project="$SOURCE_PROJECT" \
    --async \
    --format="value(name)")

echo "✓ Export operation started: $OPERATION"
echo ""
echo "⏳ Monitoring export progress..."
echo "   (This may take several minutes depending on data size)"
echo ""

# Wait for operation to complete
while true; do
    # Check if operation is done first
    DONE=$(gcloud firestore operations describe "$OPERATION" \
        --project="$SOURCE_PROJECT" \
        --format="value(done)")

    if [ "$DONE" == "True" ]; then
        # Get the final state
        STATE=$(gcloud firestore operations describe "$OPERATION" \
            --project="$SOURCE_PROJECT" \
            --format="value(metadata.operationState)")

        if [ "$STATE" == "SUCCESSFUL" ]; then
            echo ""
            echo "✅ Firestore export completed successfully!"
            break
        else
            echo ""
            echo "❌ Firestore export failed!"
            gcloud firestore operations describe "$OPERATION" --project="$SOURCE_PROJECT"
            exit 1
        fi
    else
        echo -n "."
        sleep 5
    fi
done

# Verify export
echo ""
echo "📁 Verifying exported files..."
gsutil ls -r "$BACKUP_BUCKET/$EXPORT_PREFIX/" | head -20

echo ""
echo "✨ Export complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Run 5-import-firestore.sh to import to homegeekdemo"
echo "   2. Export path: $BACKUP_BUCKET/$EXPORT_PREFIX"
echo ""
