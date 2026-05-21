#!/bin/bash

##
# Import Cloud Firestore data to target project
#
# Prerequisites:
# - Run 4-export-firestore.sh first
# - gcloud CLI installed and authenticated
# - Proper permissions on target project
#
# Usage:
#   TARGET_PROJECT=homegeek-staging SOURCE_PROJECT=goggle-gab ./4-import-firestore.sh [EXPORT_PATH]
#   or
#   ./4-import-firestore.sh  # uses defaults
#
# Example:
#   ./4-import-firestore.sh gs://goggle-gab.firebasestorage.app/firestore-migration/firestore-2025-11-18-1951
##

set -e

TARGET_PROJECT="${TARGET_PROJECT:-homegeek-staging}"
SOURCE_PROJECT="${SOURCE_PROJECT:-goggle-gab}"
TARGET_BUCKET="gs://${TARGET_PROJECT}.firebasestorage.app"
SOURCE_BUCKET="gs://${SOURCE_PROJECT}.firebasestorage.app"
EXPORT_PREFIX="firestore-migration"
IMPORT_PREFIX="firestore-import"

# Get export path from argument or find the latest
if [ -z "$1" ]; then
    echo "🔍 Finding latest export in source bucket..."
    LATEST_EXPORT=$(gsutil ls "$SOURCE_BUCKET/$EXPORT_PREFIX/" | grep "firestore-" | tail -1 | sed 's:/$::')

    if [ -z "$LATEST_EXPORT" ]; then
        echo "❌ No exports found in $SOURCE_BUCKET/$EXPORT_PREFIX/"
        echo "Please run 3-export-firestore.sh first"
        exit 1
    fi

    EXPORT_PATH="$LATEST_EXPORT"
    echo "   Found: $EXPORT_PATH"
else
    EXPORT_PATH="$1"
fi

EXPORT_NAME=$(basename "$EXPORT_PATH")

echo ""
echo "🔄 Starting Firestore import to $TARGET_PROJECT..."
echo ""

# Copy export from source bucket to target bucket
echo "📤 Copying export to homegeek-staging bucket..."
echo "   Source: $EXPORT_PATH"
echo "   Destination: $TARGET_BUCKET/$IMPORT_PREFIX/$EXPORT_NAME"
echo ""

# Use single-process mode to avoid macOS Python multiprocessing crashes
gsutil -o "GSUtil:parallel_process_count=1" cp -r "$EXPORT_PATH" "$TARGET_BUCKET/$IMPORT_PREFIX/"

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Copy failed"
    exit 1
fi

echo ""
echo "✅ Copy complete!"

# Check if target has data and warn
echo ""
echo "🔍 Checking target Firestore..."
COLLECTION_COUNT=$(gcloud firestore collections list --project="$TARGET_PROJECT" 2>/dev/null | wc -l)

if [ "$COLLECTION_COUNT" -gt 0 ]; then
    echo ""
    echo "⚠️  WARNING: Target Firestore contains $COLLECTION_COUNT collection(s)"
    echo ""
    echo "📌 IMPORTANT: Firestore import OVERWRITES existing documents with same IDs!"
    echo ""
    echo "   What will happen:"
    echo "   • Documents with matching IDs: OVERWRITTEN with import data"
    echo "   • New documents in import: ADDED to database"
    echo "   • Existing documents not in import: REMAIN UNCHANGED"
    echo ""
    echo "   ⚠️  Any changes made in target project since last import will be LOST!"
    echo ""
    read -p "Continue with import? This will OVERWRITE matching documents (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Import cancelled"
        exit 0
    fi
fi

# Start import
echo ""
echo "📥 Starting Firestore import..."
echo "   Source: $TARGET_BUCKET/$IMPORT_PREFIX/$EXPORT_NAME"
echo "   Destination: $TARGET_PROJECT"
echo ""

OPERATION=$(gcloud firestore import "$TARGET_BUCKET/$IMPORT_PREFIX/$EXPORT_NAME" \
    --project="$TARGET_PROJECT" \
    --async \
    --format="value(name)")

echo "✓ Import operation started: $OPERATION"
echo ""
echo "⏳ Monitoring import progress..."
echo "   (This may take several minutes depending on data size)"
echo ""

# Wait for operation to complete
while true; do
    # Check if operation is done first
    DONE=$(gcloud firestore operations describe "$OPERATION" \
        --project="$TARGET_PROJECT" \
        --format="value(done)")

    if [ "$DONE" == "True" ]; then
        # Get the final state
        STATE=$(gcloud firestore operations describe "$OPERATION" \
            --project="$TARGET_PROJECT" \
            --format="value(metadata.operationState)")

        if [ "$STATE" == "SUCCESSFUL" ]; then
            echo ""
            echo "✅ Firestore import completed successfully!"
            break
        else
            echo ""
            echo "❌ Firestore import failed!"
            gcloud firestore operations describe "$OPERATION" --project="$TARGET_PROJECT"
            exit 1
        fi
    else
        echo -n "."
        sleep 5
    fi
done

# Verify import
echo ""
echo "✨ Import complete!"
echo ""
echo "📊 Verify the import:"
echo "   Firebase Console: https://console.firebase.google.com/project/$TARGET_PROJECT/firestore"
echo ""
echo "📝 Next steps:"
echo "   1. Verify data in Firebase Console"
echo "   2. Run 6-migrate-storage.sh to migrate Storage files"
echo ""
