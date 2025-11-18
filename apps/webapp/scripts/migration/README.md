# Firebase Migration Scripts

Automated scripts to migrate from `goggle-gab` to `homegeekdemo` Firebase project.

## ⚠️ Important: Manual Setup Required First

**Before running any migration scripts**, you must complete the manual Firebase Console setup.

📋 **Follow this checklist**: [SETUP-CHECKLIST.md](SETUP-CHECKLIST.md)

The checklist covers:
- Enabling Firebase Authentication and providers
- Creating Firestore database
- Creating Storage bucket
- Configuring IAM permissions
- Verifying setup

**Then run the verification script:**
```bash
./0-verify-setup.sh
```

Once the verification passes, proceed with the migration scripts below.

---

## Prerequisites

### Install Dependencies

```bash
# Required tools:
# - gcloud CLI: https://cloud.google.com/sdk/docs/install
# - Firebase CLI: npm install -g firebase-tools
# - gsutil (included with gcloud)
# - jq (JSON processor): brew install jq (macOS) or apt-get install jq (Linux)
```

### Authentication

```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud auth application-default login

# Authenticate with Firebase
firebase login
```

### Set Default Project

```bash
# Set default project for gcloud
gcloud config set project goggle-gab

# Verify access to both projects
gcloud projects list
```

### Configure Migration (Optional)

The scripts use environment variables with sensible defaults (`goggle-gab` → `homegeekdemo`). To use different projects:

**Option 1: Use environment variables directly**
```bash
export SOURCE_PROJECT="your-source-project"
export TARGET_PROJECT="your-target-project"
```

**Option 2: Use configuration file (recommended)**
```bash
# Copy the example config
cp migration.env.example migration.env

# Edit migration.env with your project IDs
nano migration.env

# Source the config before running scripts
source migration.env
```

The `migration.env` file is in `.gitignore` to prevent accidentally committing credentials.

## Migration Steps

Run these scripts in order:

### 1. Export Authentication Users (WITH Password Hashes)

```bash
chmod +x 1-export-auth-firebase-cli.sh
./1-export-auth-firebase-cli.sh
```

**What it does:**
- Exports all users from `goggle-gab` Authentication using Firebase CLI
- **Includes password hashes** so users can login with existing passwords
- Preserves UIDs, emails, OAuth providers, and all metadata
- Saves to `auth-users-export.json`

**Output:** `auth-users-export.json` (contains all user data INCLUDING password hashes)

---

### 2. Import Authentication Users (WITH Password Hashes)

**⚠️ Important: Get SCRYPT Parameters First**

To migrate passwords successfully, you need the Firebase SCRYPT signer key from your source project.

**📋 Follow these steps:** [get-scrypt-params.md](get-scrypt-params.md)

Quick summary:
1. Go to Firebase Console → `goggle-gab` project → Authentication → Users
2. Click the three dots menu (⋮) in upper-right corner
3. Select "Password Hash Parameters"
4. Copy the `base64_signer_key`

Then run:

```bash
# Set the SCRYPT key from Firebase Console
export FIREBASE_SCRYPT_KEY="<your_base64_signer_key_here>"

# Run import script
chmod +x 2-import-auth-firebase-cli.sh
./2-import-auth-firebase-cli.sh
```

**What it does:**
- Imports users to `homegeekdemo` Authentication using Firebase CLI
- Preserves exact same UIDs
- **Migrates password hashes** (users can login with existing passwords immediately)
- OAuth users will work seamlessly
- No password reset required!

**Requirements:**
- Must run script 1 first
- Need FIREBASE_SCRYPT_KEY environment variable (or choose to import without passwords)

**Alternative:** If you can't get the SCRYPT key, the script offers an option to import without password hashes. Users will need to use "Forgot Password" to set new passwords.

---

### 3. Deploy Security Rules

⚠️ **Deploy rules BEFORE testing** - This ensures authentication and data access work correctly during testing.

```bash
chmod +x 3-deploy-rules.sh
./3-deploy-rules.sh
```

**What it does:**
- Switches Firebase CLI to target project
- Deploys Firestore security rules
- Deploys Storage security rules
- Verifies deployment success

**Why now?** You need security rules in place to:
- Test user authentication
- Allow the app to read/write Firestore data
- Allow the app to access Storage files

---

### 4. Export Firestore Data

```bash
chmod +x 4-export-firestore.sh
./4-export-firestore.sh
```

**What it does:**
- Exports all Firestore collections/documents to goggle-gab bucket
- Preserves exact document IDs and structure
- Monitors export progress

**Duration:** 5-30 minutes depending on data size

---

### 5. Import Firestore Data

```bash
chmod +x 5-import-firestore.sh
./5-import-firestore.sh
```

**What it does:**
- Copies export from goggle-gab bucket to homegeekdemo bucket using `gsutil cp`
- Imports all Firestore data with exact same IDs
- Monitors import progress
- Verifies successful completion

**Duration:** 5-30 minutes depending on data size

**Note:** Uses single-process mode for macOS compatibility.

You can also specify a custom export path:
```bash
./5-import-firestore.sh gs://goggle-gab.firebasestorage.app/firestore-migration/firestore-2025-11-18-1951
```

---

### 6. Migrate Storage Files

```bash
chmod +x 6-migrate-storage.sh

# Preview what will be copied (recommended first)
./6-migrate-storage.sh --dry-run

# Actual migration
./6-migrate-storage.sh
```

**What it does:**
- Copies all files from goggle-gab Storage to homegeekdemo
- Preserves exact file paths and names
- Excludes Firestore backup folders
- Uses single-process mode to avoid macOS issues
- Verifies sizes match

**Duration:** Varies by file size (could be 10 minutes to hours)

**Note:** Uses single-process mode for macOS compatibility. For large migrations, this may take longer but avoids Python multiprocessing crashes.

---

### 7. Update Storage URLs in Firestore

⚠️ **Important**: After migrating storage files, Firestore documents may still contain URLs pointing to the old project bucket. This script updates all references.

```bash
chmod +x 7-update-storage-urls.sh

# Preview what will be updated (recommended first)
./7-update-storage-urls.sh --dry-run

# Apply changes to all collections
./7-update-storage-urls.sh

# Or update specific collection only
./7-update-storage-urls.sh --collection=users
./7-update-storage-urls.sh --dry-run --collection=sharedChats
```

**What it does:**
- Scans all Firestore collections (or specific collection) for storage URLs
- Replaces old bucket URLs with new ones
- Handles multiple URL formats:
  - `gs://goggle-gab.firebasestorage.app` → `gs://homegeekdemo.firebasestorage.app`
  - `https://firebasestorage.googleapis.com/v0/b/goggle-gab...` → `https://firebasestorage.googleapis.com/v0/b/homegeekdemo...`
- Updates nested objects and arrays
- Recursively processes subcollections (like `users/{userId}/chats`)
- Shows summary of changed documents

**Options:**
- `--dry-run` - Preview changes without applying them
- `--collection=NAME` - Only process specific collection

**Requirements:**
- Node.js installed
- Firebase Admin SDK (installed automatically)
- Application Default Credentials configured (`gcloud auth application-default login`)

**Duration:** 1-5 minutes depending on data size

---

### 8. Migrate Firestore Indexes

```bash
chmod +x 8-migrate-indexes.sh
./8-migrate-indexes.sh
```

**What it does:**
- Exports index definitions from source project
- Converts to Firebase deployment format
- Deploys indexes to target project
- Backs up existing target indexes
- Monitors deployment status

**Duration:**
- Deployment: 1 minute
- Index building: 5 minutes to several hours (depending on data size)

**Note:** Apps continue to work during index creation. Queries requiring indexes may be slower until building completes.

**Alternative:** If you have `firestore.indexes.json` in your codebase, you can deploy directly:
```bash
firebase deploy --only firestore:indexes --project homegeekdemo
```

---

## Verification

After running all scripts, verify the migration:

### Check Authentication
```bash
# List users in new project
firebase --project homegeekdemo auth:export users.csv
wc -l users.csv  # Should match original user count
```

### Check Firestore
```bash
# List collections
gcloud firestore collections list --project=homegeekdemo

# Compare document counts (example)
gcloud firestore documents list --collection=users --project=goggle-gab | wc -l
gcloud firestore documents list --collection=users --project=homegeekdemo | wc -l
```

### Check Storage
```bash
# Compare sizes
gsutil du -s gs://goggle-gab.firebasestorage.app
gsutil du -s gs://homegeekdemo.firebasestorage.app

# List files
gsutil ls -r gs://homegeekdemo.firebasestorage.app | head -20
```

## Troubleshooting

### Permission Errors

If you get permission errors:

```bash
# Grant yourself necessary roles
gcloud projects add-iam-policy-binding goggle-gab \
  --member="user:your-email@gmail.com" \
  --role="roles/datastore.importExportAdmin"

gcloud projects add-iam-policy-binding homegeekdemo \
  --member="user:your-email@gmail.com" \
  --role="roles/datastore.importExportAdmin"
```

### Authentication Script Fails

```bash
# Ensure you're authenticated with Firebase CLI
firebase login

# If you get "reauth required" errors:
firebase login --reauth
```

### Firestore Import Hangs

Check operation status manually:

```bash
# List operations
gcloud firestore operations list --project=homegeekdemo

# Check specific operation
gcloud firestore operations describe [OPERATION_NAME] --project=homegeekdemo
```

### Storage Copy Fails

For large files, increase timeout:

```bash
# Set longer timeout
gsutil -o "GSUtil:http_socket_timeout=300" -m cp -r \
  gs://goggle-gab.firebasestorage.app/* \
  gs://homegeekdemo.firebasestorage.app/
```

## Rollback

If something goes wrong:

1. **Authentication**: Delete imported users in Firebase Console
2. **Firestore**: Delete collections (or entire database)
3. **Storage**: Delete files in Storage bucket

To keep old project active while testing:
```bash
# Switch back to old config
cd apps/webapp
firebase use goggle-gab
```

## Post-Migration

After successful migration:

1. ✅ Test web app with new project
2. ✅ Deploy mobile app updates
3. ✅ Monitor for errors for 24-48 hours
4. ✅ Keep goggle-gab project active for 30 days as backup
5. ✅ After 30 days, archive or delete goggle-gab project

## Script Outputs

All scripts create these files in `scripts/migration/`:

- `auth-users-export.json` - Exported authentication users
- Shell scripts create exports in GCS buckets
- All scripts log progress to console

## Safety Features

All scripts include:
- ✅ Progress monitoring
- ✅ Error handling and rollback info
- ✅ Dry-run mode (where applicable)
- ✅ Confirmation prompts for destructive operations
- ✅ Verification steps after each operation

---

## Support

For issues or questions:
1. Check the main [FIREBASE_MIGRATION.md](../../FIREBASE_MIGRATION.md) guide
2. Review Firebase documentation
3. Check script output for specific error messages
