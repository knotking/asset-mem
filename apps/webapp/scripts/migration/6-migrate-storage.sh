#!/bin/bash

##
# Migrate Firebase Storage files from source to target project
#
# Prerequisites:
# - gsutil CLI installed
# - Proper permissions on both projects
#
# Usage:
#   SOURCE_PROJECT=goggle-gab TARGET_PROJECT=homegeekdemo ./5-migrate-storage.sh [--dry-run]
#   or
#   ./5-migrate-storage.sh [--dry-run]  # uses defaults
#
# Options:
#   --dry-run    Preview what will be copied without actually copying
##

set -e

SOURCE_PROJECT="${SOURCE_PROJECT:-goggle-gab}"
TARGET_PROJECT="${TARGET_PROJECT:-homegeekdemo}"
SOURCE_BUCKET="gs://${SOURCE_PROJECT}.firebasestorage.app"
TARGET_BUCKET="gs://${TARGET_PROJECT}.firebasestorage.app"
DRY_RUN=false

# Parse arguments
if [ "$1" == "--dry-run" ]; then
    DRY_RUN=true
    echo ""
    echo "🔍 DRY RUN MODE - No files will be copied"
fi

echo ""
echo "🔄 Starting Firebase Storage migration..."
echo ""
echo "   Source: $SOURCE_BUCKET"
echo "   Target: $TARGET_BUCKET"
echo ""

# Check if source bucket exists and has content
echo "📦 Checking source bucket..."
if ! gsutil ls "$SOURCE_BUCKET" &> /dev/null; then
    echo "❌ Source bucket not accessible: $SOURCE_BUCKET"
    exit 1
fi

FILE_COUNT=$(gsutil ls -r "$SOURCE_BUCKET" | wc -l)
echo "   ✓ Source bucket accessible"
echo "   📊 Found approximately $FILE_COUNT items"

# Check target bucket
echo ""
echo "📦 Checking target bucket..."
if ! gsutil ls "$TARGET_BUCKET" &> /dev/null; then
    echo "❌ Target bucket not accessible: $TARGET_BUCKET"
    echo "Please ensure the bucket exists in Firebase Console → Storage"
    exit 1
fi
echo "   ✓ Target bucket accessible"

# Show sample of what will be copied
echo ""
echo "📋 Sample of files to be migrated:"
gsutil ls "$SOURCE_BUCKET/**" | head -10
echo "   ... (showing first 10 files)"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "📊 Dry run complete. Remove --dry-run flag to perform actual migration."
    exit 0
fi

# Confirm before proceeding
echo ""
read -p "⚠️  Proceed with migration? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    exit 0
fi

echo ""
echo "📤 Starting file copy..."
echo "   Using single-process mode (macOS compatible)"
echo ""

# Copy files using single-process mode to avoid macOS Python multiprocessing crashes
# -r for recursive
# -x to exclude Firestore migration/backup folders
# -o "GSUtil:parallel_process_count=1" to disable multiprocessing
START_TIME=$(date +%s)

echo "   Excluding: firestore-migration/, firestore-import/"
echo ""

gsutil -x ".*firestore-migration/.*|.*firestore-import/.*" -o "GSUtil:parallel_process_count=1" cp -r "$SOURCE_BUCKET/*" "$TARGET_BUCKET/" 2>&1 | while read line; do
    echo "   $line"
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "✅ File copy completed in ${DURATION}s"

# Verify the copy
echo ""
echo "📊 Verifying migration..."
SOURCE_SIZE=$(gsutil du -s "$SOURCE_BUCKET" | awk '{print $1}')
TARGET_SIZE=$(gsutil du -s "$TARGET_BUCKET" | awk '{print $1}')

echo "   Source bucket size: $(numfmt --to=iec-i --suffix=B $SOURCE_SIZE)"
echo "   Target bucket size: $(numfmt --to=iec-i --suffix=B $TARGET_SIZE)"

if [ "$SOURCE_SIZE" -eq "$TARGET_SIZE" ]; then
    echo "   ✓ Sizes match!"
else
    echo "   ⚠️  Sizes differ - please verify manually"
fi

echo ""
echo "✨ Storage migration complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Verify files in Firebase Console → Storage"
echo "   2. Test file uploads/downloads in your app"
echo "   3. Deploy updated app configurations"
echo ""
