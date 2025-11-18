#!/bin/bash

##
# Export Firebase Authentication users using Firebase CLI
# This is the ONLY way to export password hashes from Firebase
#
# Prerequisites:
# - Firebase CLI installed (firebase-tools)
# - Authenticated with firebase login
#
# Usage:
#   SOURCE_PROJECT=goggle-gab ./1-export-auth-firebase-cli.sh
#   or
#   ./1-export-auth-firebase-cli.sh  # uses default: goggle-gab
##

set -e

SOURCE_PROJECT="${SOURCE_PROJECT:-goggle-gab}"
OUTPUT_FILE="auth-users-export.json"

echo ""
echo "🔄 Exporting Firebase Authentication users from $SOURCE_PROJECT..."
echo ""

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi

# Export users
echo "📤 Starting export..."
firebase auth:export "$OUTPUT_FILE" \
    --project "$SOURCE_PROJECT" \
    --format JSON

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully exported users to: $OUTPUT_FILE"
    echo ""

    # Show summary
    USER_COUNT=$(jq '.users | length' "$OUTPUT_FILE")
    echo "📊 Summary:"
    echo "   Total users: $USER_COUNT"

    # Count users with passwords
    PASSWORD_USERS=$(jq '[.users[] | select(.passwordHash != null)] | length' "$OUTPUT_FILE")
    echo "   With passwords: $PASSWORD_USERS"

    # Count OAuth users
    GOOGLE_USERS=$(jq '[.users[] | select(.providerUserInfo[]? | select(.providerId == "google.com"))] | length' "$OUTPUT_FILE")
    echo "   Google OAuth: $GOOGLE_USERS"

    echo ""
    echo "📝 Next step: Run 2-import-auth-firebase-cli.sh"
else
    echo ""
    echo "❌ Export failed"
    exit 1
fi
