#!/bin/bash

##
# Update Firestore documents to replace old Storage URLs with new ones
#
# This script updates any references to the old Firebase Storage bucket
# with the new bucket URL after migration.
#
# Prerequisites:
# - Firestore data already imported to target project
# - Node.js installed
# - Firebase Admin SDK access
#
# Usage:
#   SOURCE_PROJECT=goggle-gab TARGET_PROJECT=homegeek-staging ./7-update-storage-urls.sh [options]
#   or
#   ./7-update-storage-urls.sh [options]  # uses defaults
#
# Options:
#   --dry-run              Preview what will be updated without making changes
#   --collection=NAME      Only process specific collection (e.g., --collection=users)
#
# Examples:
#   ./7-update-storage-urls.sh --dry-run --collection=users
#   ./7-update-storage-urls.sh --collection=sharedChats
##

set -e

SOURCE_PROJECT="${SOURCE_PROJECT:-goggle-gab}"
TARGET_PROJECT="${TARGET_PROJECT:-homegeek-staging}"
DRY_RUN=false
COLLECTION=""

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --collection=*)
            COLLECTION="${arg#*=}"
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Usage: $0 [--dry-run] [--collection=NAME]"
            exit 1
            ;;
    esac
done

echo ""
if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY RUN MODE - No changes will be made"
    echo ""
fi

echo "🔄 Updating Storage URLs in Firestore..."
echo ""
echo "   Old bucket: gs://${SOURCE_PROJECT}.firebasestorage.app"
echo "   New bucket: gs://${TARGET_PROJECT}.firebasestorage.app"

if [ -n "$COLLECTION" ]; then
    echo "   Collection: $COLLECTION (specific collection only)"
fi

echo ""

# Create temporary Node.js script
SCRIPT_FILE="update-urls-temp.js"

cat > "$SCRIPT_FILE" << 'EOFSCRIPT'
const admin = require('firebase-admin');

const SOURCE_PROJECT = process.env.SOURCE_PROJECT || 'goggle-gab';
const TARGET_PROJECT = process.env.TARGET_PROJECT || 'homegeek-staging';
const DRY_RUN = process.env.DRY_RUN === 'true';
const COLLECTION = process.env.COLLECTION || '';

// Initialize Firebase Admin
admin.initializeApp({
  projectId: TARGET_PROJECT,
});

const db = admin.firestore();

// URL patterns to replace
const patterns = [
  {
    old: `gs://${SOURCE_PROJECT}.firebasestorage.app`,
    new: `gs://${TARGET_PROJECT}.firebasestorage.app`,
  },
  {
    old: `https://firebasestorage.googleapis.com/v0/b/${SOURCE_PROJECT}.firebasestorage.app`,
    new: `https://firebasestorage.googleapis.com/v0/b/${TARGET_PROJECT}.firebasestorage.app`,
  },
  {
    old: `https://firebasestorage.googleapis.com/v0/b/${SOURCE_PROJECT}.appspot.com`,
    new: `https://firebasestorage.googleapis.com/v0/b/${TARGET_PROJECT}.appspot.com`,
  },
];

// Recursively find and replace URLs in an object
function replaceUrlsInObject(obj) {
  let modified = false;
  const newObj = { ...obj };

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Check each pattern
      for (const pattern of patterns) {
        if (value.includes(pattern.old)) {
          newObj[key] = value.replaceAll(pattern.old, pattern.new);
          modified = true;
        }
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively handle nested objects
      const result = replaceUrlsInObject(value);
      if (result.modified) {
        newObj[key] = result.obj;
        modified = true;
      }
    } else if (Array.isArray(value)) {
      // Handle arrays
      const newArray = value.map(item => {
        if (typeof item === 'string') {
          let newItem = item;
          for (const pattern of patterns) {
            if (item.includes(pattern.old)) {
              newItem = item.replaceAll(pattern.old, pattern.new);
              modified = true;
            }
          }
          return newItem;
        } else if (item && typeof item === 'object') {
          const result = replaceUrlsInObject(item);
          if (result.modified) {
            modified = true;
            return result.obj;
          }
        }
        return item;
      });
      if (modified) {
        newObj[key] = newArray;
      }
    }
  }

  return { obj: newObj, modified };
}

async function updateCollection(collectionPath, depth = 0) {
  const indent = '   '.repeat(depth);
  console.log(`\n${indent}📂 Processing: ${collectionPath}`);

  // Use listDocuments() to get ALL documents including empty ones with subcollections
  // (like users/{userId} which have no data but have subcollections)
  const docRefs = await db.collection(collectionPath).listDocuments();
  let updatedCount = 0;
  let totalCount = docRefs.length;

  console.log(`${indent}   Found ${totalCount} documents`);

  for (const docRef of docRefs) {
    // Get the actual document data
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      const result = replaceUrlsInObject(data);

      if (result.modified) {
        updatedCount++;
        if (DRY_RUN) {
          console.log(`${indent}   [DRY RUN] Would update: ${docRef.id}`);
        } else {
          await docRef.update(result.obj);
          console.log(`${indent}   ✓ Updated: ${docRef.id}`);
        }
      }
    }

    // Check for subcollections (important for nested data like sharedChats/messages, users/chats)
    const subcollections = await docRef.listCollections();
    for (const subcollection of subcollections) {
      const subPath = `${collectionPath}/${docRef.id}/${subcollection.id}`;
      const subStats = await updateCollection(subPath, depth + 1);
      totalCount += subStats.total;
      updatedCount += subStats.updated;
    }
  }

  console.log(`${indent}   ${updatedCount} documents ${DRY_RUN ? 'would be' : ''} updated`);
  return { total: totalCount, updated: updatedCount };
}

async function main() {
  try {
    let totalDocs = 0;
    let totalUpdated = 0;

    if (COLLECTION) {
      // Process specific collection only
      console.log(`\n📊 Processing specific collection: ${COLLECTION}\n`);
      const stats = await updateCollection(COLLECTION);
      totalDocs = stats.total;
      totalUpdated = stats.updated;
    } else {
      // Get all collections
      const collections = await db.listCollections();

      console.log(`\n📊 Found ${collections.length} top-level collections\n`);

      for (const collection of collections) {
        const stats = await updateCollection(collection.id);
        totalDocs += stats.total;
        totalUpdated += stats.updated;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   Total documents processed: ${totalDocs}`);
    console.log(`   Documents ${DRY_RUN ? 'to be ' : ''}updated: ${totalUpdated}`);

    if (DRY_RUN) {
      console.log('\n💡 Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ URL update complete!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
EOFSCRIPT

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    rm -f "$SCRIPT_FILE"
    exit 1
fi

# Check if firebase-admin is available
if [ ! -d "node_modules/firebase-admin" ]; then
    echo "📦 Installing firebase-admin..."
    npm install firebase-admin --no-save
fi

# Set environment variables and run script
export SOURCE_PROJECT="$SOURCE_PROJECT"
export TARGET_PROJECT="$TARGET_PROJECT"
export DRY_RUN="$DRY_RUN"
export COLLECTION="$COLLECTION"
export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-}"

echo "🚀 Starting URL update..."

node "$SCRIPT_FILE"

EXIT_CODE=$?

# Clean up
rm -f "$SCRIPT_FILE"

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    if [ "$DRY_RUN" = true ]; then
        echo "📝 Next step: Run without --dry-run to apply changes"
    else
        echo "📝 Next steps:"
        echo "   1. Verify updated URLs in Firebase Console"
        echo "   2. Test app functionality with new storage URLs"
        echo "   3. Continue with remaining migration steps"
    fi
    echo ""
else
    echo ""
    echo "❌ URL update failed"
    exit 1
fi
