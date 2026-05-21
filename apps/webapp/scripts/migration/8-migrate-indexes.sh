#!/bin/bash

##
# Migrate Firestore indexes from source to target project
#
# This script exports index definitions from the source project
# and deploys them to the target project.
#
# Prerequisites:
# - Firebase CLI installed (firebase-tools)
# - Authenticated with firebase login
#
# Usage:
#   SOURCE_PROJECT=goggle-gab TARGET_PROJECT=homegeek-staging ./8-migrate-indexes.sh
#   or
#   ./8-migrate-indexes.sh  # uses defaults
##

set -e

SOURCE_PROJECT="${SOURCE_PROJECT:-goggle-gab}"
TARGET_PROJECT="${TARGET_PROJECT:-homegeek-staging}"
INDEX_FILE="firestore.indexes.json"
BACKUP_FILE="firestore.indexes.backup.json"

echo ""
echo "🔄 Migrating Firestore indexes..."
echo ""
echo "   Source: $SOURCE_PROJECT"
echo "   Target: $TARGET_PROJECT"
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi

# Step 1: Export indexes from source project
echo "📤 Exporting indexes from $SOURCE_PROJECT..."
echo ""

# Get current project
CURRENT_PROJECT=$(firebase use 2>/dev/null | head -1 || echo "")

# Switch to source project temporarily
firebase use "$SOURCE_PROJECT" --project "$SOURCE_PROJECT" 2>/dev/null || firebase use --add "$SOURCE_PROJECT"

echo "Fetching indexes using Firebase REST API..."
# Use Firebase REST API to get indexes since gcloud firestore indexes list doesn't exist in older versions

# Get access token
ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Could not get access token. Please run: gcloud auth login"
    exit 1
fi

# Fetch indexes via REST API
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://firestore.googleapis.com/v1/projects/$SOURCE_PROJECT/databases/(default)/collectionGroups/-/indexes" \
    > "$INDEX_FILE.temp"

# Check if we got valid JSON
if [ -f "$INDEX_FILE.temp" ] && grep -q "indexes" "$INDEX_FILE.temp" 2>/dev/null; then
    echo "✓ Successfully retrieved indexes"

    # Convert REST API format to Firebase format
    echo "📝 Converting index format..."
    node -e "
const fs = require('fs');
const data = fs.readFileSync('$INDEX_FILE.temp', 'utf-8');
let response;
try {
  response = JSON.parse(data);
} catch (e) {
  console.error('Failed to parse indexes:', e.message);
  process.exit(1);
}

const indexes = response.indexes || [];

const output = {
  indexes: indexes
    .filter(idx => idx.state === 'READY' || idx.state === 'CREATING')
    .map(idx => {
      // Extract collection group from name like: projects/.../databases/.../collectionGroups/users/indexes/...
      const match = idx.name.match(/collectionGroups\/([^\/]+)/);
      const collectionGroup = match ? match[1] : 'unknown';

      return {
        collectionGroup: collectionGroup,
        queryScope: idx.queryScope || 'COLLECTION',
        fields: (idx.fields || [])
          .filter(f => f.fieldPath !== '__name__')
          .map(f => {
            const field = { fieldPath: f.fieldPath };
            if (f.order) field.order = f.order;
            if (f.arrayConfig) field.arrayConfig = f.arrayConfig;
            return field;
          })
          .filter(f => f.order || f.arrayConfig)
      };
    })
    .filter(idx => idx.fields.length > 0),
  fieldOverrides: []
};

console.log(JSON.stringify(output, null, 2));
    " > "$INDEX_FILE" 2>/dev/null

    rm -f "$INDEX_FILE.temp"

    # Show what we found
    INDEX_COUNT=$(node -e "const data = require('./$INDEX_FILE'); console.log(data.indexes.length);" 2>/dev/null || echo "0")
    echo "✓ Found $INDEX_COUNT indexes"
    echo ""

    if [ "$INDEX_COUNT" -eq "0" ]; then
        echo "No composite indexes to migrate (single-field indexes are automatic)"
        rm -f "$INDEX_FILE"
        exit 0
    fi

    # Show index details
    echo "📋 Indexes to migrate:"
    node -e "
const data = require('./$INDEX_FILE');
data.indexes.forEach((idx, i) => {
  console.log(\`   \${i+1}. Collection: \${idx.collectionGroup}\`);
  idx.fields.forEach(f => {
    const type = f.order || f.arrayConfig || 'UNKNOWN';
    console.log(\`      - \${f.fieldPath}: \${type}\`);
  });
});
    " 2>/dev/null || cat "$INDEX_FILE"

    echo ""
else
    echo "⚠️  Could not retrieve indexes via gcloud"
    echo ""
    echo "Please manually export indexes:"
    echo "  1. Go to Firebase Console → Firestore → Indexes"
    echo "  2. Copy the index definitions"
    echo "  3. Create firestore.indexes.json manually"
    echo "  4. Run: firebase deploy --only firestore:indexes --project $TARGET_PROJECT"
    echo ""
    rm -f "$INDEX_FILE.temp"
    exit 1
fi

# Confirm
read -p "⚠️  Deploy these indexes to $TARGET_PROJECT? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    rm -f "$INDEX_FILE"
    exit 0
fi

echo ""

# Step 2: Deploy to target project
echo "📥 Deploying indexes to $TARGET_PROJECT..."
echo ""

# Find firebase.json location
WEBAPP_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FIREBASE_JSON="$WEBAPP_ROOT/firebase.json"

if [ ! -f "$FIREBASE_JSON" ]; then
    echo "❌ firebase.json not found at: $FIREBASE_JSON"
    exit 1
fi

echo "Found firebase.json at: $FIREBASE_JSON"

# Merge index file with existing one in webapp root
echo "Processing index file..."

TARGET_INDEX_FILE="$WEBAPP_ROOT/firestore.indexes.json"

# Check if existing index file is present
if [ -f "$TARGET_INDEX_FILE" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_INDEX="$WEBAPP_ROOT/firestore.indexes.json.backup.$TIMESTAMP"
    echo "⚠️  Existing firestore.indexes.json found"
    echo "   Backing up to: firestore.indexes.json.backup.$TIMESTAMP"
    cp "$TARGET_INDEX_FILE" "$BACKUP_INDEX"

    echo "   Merging indexes from source project with existing indexes..."

    # Merge indexes using node
    node -e "
const fs = require('fs');
const sourceIndexes = JSON.parse(fs.readFileSync('$INDEX_FILE', 'utf-8'));
const existingIndexes = JSON.parse(fs.readFileSync('$TARGET_INDEX_FILE', 'utf-8'));

// Create a map of existing indexes for deduplication
const indexMap = new Map();

// Add existing indexes first
(existingIndexes.indexes || []).forEach(idx => {
  const key = \`\${idx.collectionGroup}:\${JSON.stringify(idx.fields)}\`;
  indexMap.set(key, idx);
});

// Add/override with source indexes
(sourceIndexes.indexes || []).forEach(idx => {
  const key = \`\${idx.collectionGroup}:\${JSON.stringify(idx.fields)}\`;
  indexMap.set(key, idx);
});

// Merge fieldOverrides
const fieldOverrides = [
  ...(existingIndexes.fieldOverrides || []),
  ...(sourceIndexes.fieldOverrides || [])
];

const merged = {
  indexes: Array.from(indexMap.values()),
  fieldOverrides: fieldOverrides
};

fs.writeFileSync('$TARGET_INDEX_FILE', JSON.stringify(merged, null, 2) + '\n');
console.log('✓ Merged indexes: ' + merged.indexes.length + ' total');
    "
else
    echo "   No existing index file found, using source indexes"
    cp "$INDEX_FILE" "$TARGET_INDEX_FILE"
    echo "✓ Index file copied to webapp root"
fi

# Update firebase.json to include indexes if not already there
if ! grep -q '"indexes"' "$FIREBASE_JSON"; then
    echo "Updating firebase.json to include indexes configuration..."
    # Use node to update firebase.json
    node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('$FIREBASE_JSON', 'utf-8'));
if (config.firestore) {
  config.firestore.indexes = 'firestore.indexes.json';
  fs.writeFileSync('$FIREBASE_JSON', JSON.stringify(config, null, 2) + '\n');
  console.log('✓ Updated firebase.json');
} else {
  console.error('Error: firestore config not found in firebase.json');
  process.exit(1);
}
    "
else
    echo "✓ firebase.json already configured for indexes"
fi

# Switch to target project
cd "$WEBAPP_ROOT"
firebase use "$TARGET_PROJECT" --project "$TARGET_PROJECT" 2>/dev/null || firebase use --add "$TARGET_PROJECT"

# Backup existing indexes if any
curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    "https://firestore.googleapis.com/v1/projects/$TARGET_PROJECT/databases/(default)/collectionGroups/-/indexes" \
    > "$BACKUP_FILE" 2>/dev/null || echo '{"indexes": []}' > "$BACKUP_FILE"

# Deploy the indexes
firebase deploy --only firestore:indexes --project "$TARGET_PROJECT"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Index deployment initiated successfully!"
    echo ""
    echo "⚠️  Important Notes:"
    echo "   - Index creation can take several minutes to hours depending on data size"
    echo "   - You can monitor progress in Firebase Console → Firestore → Indexes"
    echo "   - Apps can continue to work during index creation (queries may be slower)"
    echo ""
    echo "📝 Backup of target project indexes saved to: $BACKUP_FILE"
    echo ""

    # Show how to check status
    echo "To check index build status:"
    echo "  firebase --project $TARGET_PROJECT firestore:indexes"
    echo "  or"
    echo "  gcloud firestore indexes list --project=$TARGET_PROJECT"
    echo ""
else
    echo ""
    echo "❌ Index deployment failed"
    echo ""
    echo "You can try deploying manually:"
    echo "  firebase deploy --only firestore:indexes --project $TARGET_PROJECT"
    exit 1
fi

# Restore original project if needed
if [ -n "$CURRENT_PROJECT" ] && [ "$CURRENT_PROJECT" != "$TARGET_PROJECT" ]; then
    firebase use "$CURRENT_PROJECT" 2>/dev/null || true
fi

echo "📝 Next steps:"
echo "   1. Monitor index creation in Firebase Console"
echo "   2. Test queries that require indexes"
echo "   3. Continue with remaining migration steps"
echo ""
