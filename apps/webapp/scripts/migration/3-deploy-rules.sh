#!/bin/bash

##
# Deploy Firestore and Storage security rules to target project
#
# Prerequisites:
# - Firebase CLI installed (firebase-tools)
# - Authenticated with firebase login
# - In the apps/webapp directory
#
# Usage:
#   TARGET_PROJECT=homegeekdemo ./6-deploy-rules.sh
#   or
#   ./6-deploy-rules.sh  # uses default: homegeekdemo
##

set -e

TARGET_PROJECT="${TARGET_PROJECT:-homegeekdemo}"
WEBAPP_DIR="../../"

echo ""
echo "🔄 Deploying security rules to $TARGET_PROJECT..."
echo ""

# Change to webapp directory
cd "$WEBAPP_DIR" || exit 1
echo "📁 Working directory: $(pwd)"

# Check if firebase.json exists
if [ ! -f "firebase.json" ]; then
    echo "❌ firebase.json not found in $(pwd)"
    exit 1
fi

# Check if rules files exist
echo ""
echo "📋 Checking rules files..."

if [ -f "firestore.rules" ]; then
    echo "   ✓ firestore.rules found"
    LINES=$(wc -l < firestore.rules)
    echo "     ($LINES lines)"
else
    echo "   ⚠️  firestore.rules not found"
fi

if [ -f "storage.rules" ]; then
    echo "   ✓ storage.rules found"
    LINES=$(wc -l < storage.rules)
    echo "     ($LINES lines)"
else
    echo "   ⚠️  storage.rules not found"
fi

# Switch to correct Firebase project
echo ""
echo "🔧 Switching Firebase CLI to $TARGET_PROJECT..."
firebase use "$TARGET_PROJECT"

# Verify current project
CURRENT_PROJECT=$(firebase use 2>/dev/null | head -1)
if [ "$CURRENT_PROJECT" != "$TARGET_PROJECT" ]; then
    echo "❌ Failed to switch to $TARGET_PROJECT"
    echo "   Current project: $CURRENT_PROJECT"
    exit 1
fi
echo "   ✓ Using project: $CURRENT_PROJECT"

# Deploy Firestore rules
echo ""
echo "📤 Deploying Firestore rules..."
if firebase deploy --only firestore:rules; then
    echo "   ✅ Firestore rules deployed successfully"
else
    echo "   ❌ Failed to deploy Firestore rules"
    exit 1
fi

# Deploy Storage rules
echo ""
echo "📤 Deploying Storage rules..."
if firebase deploy --only storage; then
    echo "   ✅ Storage rules deployed successfully"
else
    echo "   ❌ Failed to deploy Storage rules"
    exit 1
fi

echo ""
echo "✨ All rules deployed successfully!"
echo ""
echo "📝 Verification steps:"
echo "   1. Go to Firebase Console → Firestore Database → Rules"
echo "   2. Check the deployment timestamp"
echo "   3. Go to Firebase Console → Storage → Rules"
echo "   4. Verify the storage rules are active"
echo ""
echo "📝 Next steps:"
echo "   1. Test authentication and verify users can login"
echo "   2. Run 4-export-firestore.sh to export Firestore data"
echo ""
