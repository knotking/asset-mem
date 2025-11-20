#!/bin/bash

##
# Import Firebase Authentication users using Firebase CLI
# This preserves password hashes and all user data
#
# Prerequisites:
# - Run 1-export-auth-firebase-cli.sh first
# - Firebase CLI installed (firebase-tools)
# - Authenticated with firebase login
# - FIREBASE_SCRYPT_KEY environment variable set with the signer key
#
# Usage:
#   export FIREBASE_SCRYPT_KEY="your_base64_signer_key_here"
#   TARGET_PROJECT=homegeekdemo ./2-import-auth-firebase-cli.sh
#   or
#   ./2-import-auth-firebase-cli.sh  # uses default: homegeekdemo
#
# Resume mode (skip already-imported users):
#   ./2-import-auth-firebase-cli.sh --resume
#
# Force mode (ignore duplicates, may fail on existing UIDs):
#   ./2-import-auth-firebase-cli.sh --force
#
# To get the SCRYPT parameters:
#   See get-scrypt-params.md for instructions
##

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_PROJECT="${TARGET_PROJECT:-homegeekdemo}"
SOURCE_PROJECT="${SOURCE_PROJECT:-goggle-gab}"
INPUT_FILE="auth-users-export.json"
RESUME_MODE=false
FORCE_MODE=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --resume) RESUME_MODE=true ;;
        --force) FORCE_MODE=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

echo ""
echo "🔄 Importing Firebase Authentication users to $TARGET_PROJECT..."
if [ "$RESUME_MODE" = true ]; then
    echo "   [RESUME MODE: Will skip already-imported users]"
fi
if [ "$FORCE_MODE" = true ]; then
    echo "   [FORCE MODE: Will attempt to import all users]"
fi
echo ""

# Check if export file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Export file not found: $INPUT_FILE"
    echo "Please run 1-export-auth-firebase-cli.sh first"
    exit 1
fi

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi

# Filter for resume mode (skip already-imported users)
FILTERED_FILE="$INPUT_FILE"
if [ "$RESUME_MODE" = true ] && [ "$FORCE_MODE" = false ]; then
    echo "🔍 Checking for already-imported users..."
    FILTERED_FILE="auth-users-export-filtered.json"

    # Check for Python 3
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python 3 required for resume mode"
        exit 1
    fi

    # Run filter script
    if python3 "$SCRIPT_DIR/filter-auth-export.py" "$INPUT_FILE" "$FILTERED_FILE" --project "$TARGET_PROJECT"; then
        echo "✓ Filtered export created"
    else
        echo "ℹ️  All users already imported - nothing to do"
        exit 0
    fi
    echo ""
fi

# Show what will be imported
USER_COUNT=$(jq '.users | length' "$FILTERED_FILE")
echo "📊 Found $USER_COUNT users to import"
echo ""

# Check for SCRYPT key
if [ -z "$FIREBASE_SCRYPT_KEY" ]; then
    echo "⚠️  FIREBASE_SCRYPT_KEY environment variable not set"
    echo ""
    echo "Firebase SCRYPT parameters are required for password migration."
    echo "See get-scrypt-params.md for how to obtain them."
    echo ""
    read -p "Continue with import WITHOUT password hashes? Users will need to reset passwords (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Import cancelled"
        echo ""
        echo "To import with passwords, set FIREBASE_SCRYPT_KEY:"
        echo "  export FIREBASE_SCRYPT_KEY=\"your_base64_key\""
        echo "  ./2-import-auth-firebase-cli.sh"
        exit 0
    fi
    IMPORT_WITH_PASSWORDS=false
else
    IMPORT_WITH_PASSWORDS=true
    echo "✓ FIREBASE_SCRYPT_KEY found"
fi

echo ""

# Confirm
read -p "⚠️  Import $USER_COUNT users to $TARGET_PROJECT? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Import cancelled"
    exit 0
fi

echo ""

if [ "$IMPORT_WITH_PASSWORDS" = true ]; then
    # Import WITH password hashes
    echo "📥 Starting import WITH password hashes..."
    echo "   Using Firebase SCRYPT parameters from environment"
    echo ""

    # Firebase SCRYPT parameters
    # Key: from environment
    # Salt separator: Firebase default (Bw==)
    # Rounds: Firebase default (8)
    # MemCost: Firebase default (14)
    firebase auth:import "$FILTERED_FILE" \
        --hash-algo=SCRYPT \
        --hash-key="$FIREBASE_SCRYPT_KEY" \
        --salt-separator="Bw==" \
        --rounds=8 \
        --mem-cost=14 \
        --project "$TARGET_PROJECT"

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully imported users WITH passwords!"
        echo ""
        echo "⚠️  Important Notes:"
        echo "   - User UIDs have been preserved"
        echo "   - Password hashes have been migrated"
        echo "   - Users can sign in with existing credentials"
        echo "   - OAuth users will work seamlessly"
        echo ""
    else
        echo ""
        echo "❌ Import failed"
        echo "   This likely means the SCRYPT key is incorrect"
        echo "   See get-scrypt-params.md for help"
        exit 1
    fi
else
    # Import WITHOUT password hashes
    echo "📥 Starting import WITHOUT password hashes..."
    echo "   Users will need to use 'Forgot Password' to set new passwords"
    echo ""

    # Create a modified export without password hashes
    TEMP_FILE="auth-users-export-no-passwords.json"
    jq 'del(.users[].passwordHash, .users[].salt)' "$FILTERED_FILE" > "$TEMP_FILE"

    firebase auth:import "$TEMP_FILE" \
        --project "$TARGET_PROJECT"

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully imported users WITHOUT passwords!"
        echo ""
        echo "⚠️  Important Notes:"
        echo "   - User UIDs have been preserved"
        echo "   - Password hashes were NOT migrated"
        echo "   - Users MUST reset their passwords to sign in"
        echo "   - OAuth users will work seamlessly (no password needed)"
        echo ""
        echo "📝 Recommended: Send password reset emails to all users"
        echo ""
    else
        echo ""
        echo "❌ Import failed"
        exit 1
    fi

    # Clean up temp file
    rm -f "$TEMP_FILE"
fi

# Clean up filtered file if created
if [ "$FILTERED_FILE" != "$INPUT_FILE" ]; then
    rm -f "$FILTERED_FILE"
fi

echo "📝 Next steps:"
echo "   1. Run 3-deploy-rules.sh to deploy security rules (required for testing)"
echo "   2. Test authentication in Firebase Console"
if [ "$IMPORT_WITH_PASSWORDS" = false ]; then
    echo "   3. Send password reset emails to users"
    echo "   4. Run 4-export-firestore.sh to migrate data"
else
    echo "   3. Run 4-export-firestore.sh to migrate data"
fi
