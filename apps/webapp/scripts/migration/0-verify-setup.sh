#!/bin/bash

##
# Verify Firebase project setup and prerequisites
#
# This script checks if homegeek-staging project is properly configured
# before running the migration scripts.
#
# Usage:
#   ./0-verify-setup.sh
##

set -e

TARGET_PROJECT="homegeek-staging"
SOURCE_PROJECT="goggle-gab"

echo ""
echo "🔍 Firebase Migration Prerequisites Checker"
echo "==========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print status
print_check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        ((ERRORS++))
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "ℹ️  $1"
}

# Check CLI tools
echo "1. Checking CLI Tools..."
echo ""

command -v node >/dev/null 2>&1
print_check $? "Node.js installed ($(node --version 2>/dev/null || echo 'N/A'))"

command -v npm >/dev/null 2>&1
print_check $? "npm installed ($(npm --version 2>/dev/null || echo 'N/A'))"

command -v firebase >/dev/null 2>&1
print_check $? "Firebase CLI installed ($(firebase --version 2>/dev/null | head -1 || echo 'N/A'))"

command -v gcloud >/dev/null 2>&1
print_check $? "gcloud CLI installed ($(gcloud --version 2>/dev/null | head -1 || echo 'N/A'))"

command -v gsutil >/dev/null 2>&1
print_check $? "gsutil installed"

# Check for Python 3.10+
if command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

    if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 10 ]; then
        print_check 0 "Python 3.10+ installed ($(python3 --version 2>&1))"
    else
        print_warning "Python $PYTHON_VERSION found, but 3.10+ recommended for RAG migration"
    fi
else
    print_warning "Python 3 not found - Required for RAG corpus and draft chat deletion scripts"
    print_info "  Install: brew install python@3.11 (macOS) or apt install python3 (Linux)"
fi

echo ""
echo "2. Checking Authentication..."
echo ""

# Check gcloud auth
if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    GCLOUD_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
    print_check 0 "gcloud authenticated ($GCLOUD_ACCOUNT)"
else
    print_check 1 "gcloud not authenticated - run: gcloud auth login"
fi

# Check firebase auth
if firebase projects:list >/dev/null 2>&1; then
    print_check 0 "Firebase CLI authenticated"
else
    print_check 1 "Firebase CLI not authenticated - run: firebase login"
fi

echo ""
echo "3. Checking Project Access..."
echo ""

# Check source project
if gcloud projects describe "$SOURCE_PROJECT" >/dev/null 2>&1; then
    print_check 0 "Can access $SOURCE_PROJECT project"
else
    print_check 1 "Cannot access $SOURCE_PROJECT project"
fi

# Check target project
if gcloud projects describe "$TARGET_PROJECT" >/dev/null 2>&1; then
    print_check 0 "Can access $TARGET_PROJECT project"
else
    print_check 1 "Cannot access $TARGET_PROJECT project"
fi

echo ""
echo "4. Checking Firebase Services (homegeek-staging)..."
echo ""

# Function to check if Firebase service is enabled
check_firebase_service() {
    SERVICE_NAME=$1
    DISPLAY_NAME=$2

    if gcloud services list --enabled --project="$TARGET_PROJECT" --filter="name:$SERVICE_NAME" --format="value(name)" | grep -q "$SERVICE_NAME"; then
        print_check 0 "$DISPLAY_NAME enabled"
        return 0
    else
        print_warning "$DISPLAY_NAME not enabled - Enable in Firebase Console"
        return 1
    fi
}

check_firebase_service "firebaseauth.googleapis.com" "Firebase Authentication"
check_firebase_service "firestore.googleapis.com" "Cloud Firestore"
check_firebase_service "storage.googleapis.com" "Firebase Storage"

echo ""
echo "5. Checking Authentication Providers..."
echo ""

print_info "Please verify manually in Firebase Console:"
print_info "  → https://console.firebase.google.com/project/$TARGET_PROJECT/authentication/providers"
print_info ""
print_info "Required providers:"
print_info "  - Email/Password (enabled)"
print_info "  - Google (enabled with Web client ID)"

echo ""
echo "6. Checking Firestore Database..."
echo ""

if gcloud firestore databases describe --project="$TARGET_PROJECT" --database="(default)" >/dev/null 2>&1; then
    LOCATION=$(gcloud firestore databases describe --project="$TARGET_PROJECT" --database="(default)" --format="value(locationId)")
    print_check 0 "Firestore database exists (location: $LOCATION)"
else
    print_warning "Firestore database not found - Create in Firebase Console"
    print_info "  → https://console.firebase.google.com/project/$TARGET_PROJECT/firestore"
fi

echo ""
echo "7. Checking Storage Bucket..."
echo ""

if gsutil ls "gs://$TARGET_PROJECT.firebasestorage.app" >/dev/null 2>&1; then
    print_check 0 "Storage bucket exists"
else
    print_warning "Storage bucket not found - Create in Firebase Console"
    print_info "  → https://console.firebase.google.com/project/$TARGET_PROJECT/storage"
fi

echo ""
echo "8. Checking Migration Script Dependencies..."
echo ""

if [ -f "package.json" ]; then
    print_check 0 "package.json exists"

    if [ -d "node_modules" ]; then
        print_check 0 "node_modules installed"
    else
        print_warning "node_modules not installed - run: npm install"
    fi
else
    print_check 1 "package.json not found - are you in the scripts/migration directory?"
fi

# Check if firebase-admin is installed
if [ -d "node_modules/firebase-admin" ]; then
    print_check 0 "firebase-admin package installed"
else
    print_warning "firebase-admin not installed - run: npm install"
fi

echo ""
echo "9. Checking IAM Permissions..."
echo ""

print_info "Verifying you have necessary roles..."

# Check datastore import/export admin
if gcloud projects get-iam-policy "$TARGET_PROJECT" --flatten="bindings[].members" --filter="bindings.role:roles/datastore.importExportAdmin" | grep -q "$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"; then
    print_check 0 "Has Datastore Import/Export Admin role"
else
    print_warning "Missing Datastore Import/Export Admin role"
    print_info "  Grant with: gcloud projects add-iam-policy-binding $TARGET_PROJECT \\"
    print_info "    --member='user:$(gcloud auth list --filter=status:ACTIVE --format='value(account)')' \\"
    print_info "    --role='roles/datastore.importExportAdmin'"
fi

echo ""
echo "========================================="
echo "Summary"
echo "========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! You're ready to migrate.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review the manual setup items above"
    echo "  2. Run: npm run export-auth"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
    echo ""
    echo "You can proceed, but please address the warnings:"
    echo "  - Enable missing Firebase services in Console"
    echo "  - Run: npm install (if node_modules missing)"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s) and $WARNINGS warning(s) found${NC}"
    echo ""
    echo "Please fix the errors above before proceeding."
    echo ""
    echo "Common fixes:"
    echo "  - Install missing CLI tools"
    echo "  - Authenticate: gcloud auth login && firebase login"
    echo "  - Enable Firebase services in Console"
    echo "  - Run: npm install"
    echo ""
    exit 1
fi
