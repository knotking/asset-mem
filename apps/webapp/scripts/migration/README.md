# Firebase Migration Scripts

> **Historical:** One-off migration from `goggle-gab` to `homegeek-staging`. GCP project IDs (`homegeek-*`) are unchanged; the live product brand is **AssetMem AI** (`asset-mem.com`).

Automated scripts to migrate from `goggle-gab` to `homegeek-staging` Firebase project.

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

The scripts use environment variables with sensible defaults (`goggle-gab` → `homegeek-staging`). To use different projects:

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

## Re-running Migrations Safely

All migration scripts now support safe re-runs with resume capabilities. If a migration fails partway through or you need to re-import data:

### Check Migration Status

```bash
./check-migration-status.sh
```

Shows completed migrations and tracks user-specific imports (RAG corpus).

### Resume vs Force Mode

Most scripts support two modes:

- **`--resume`** (recommended): Skips already-imported items, only imports new data
- **`--force`**: Re-imports everything (may create duplicates!)

**When to use resume mode:**

- Migration script failed midway
- Source data has changed and you want to import only new items
- Want to verify nothing was missed

**When to use force mode:**

- Need to completely reimport data (accepts duplicates/overwrites)
- Testing migration process
- Source data structure changed

### Script-Specific Behavior

| Script                        | Re-run Safe? | Resume Flag | Notes                                |
| ----------------------------- | ------------ | ----------- | ------------------------------------ |
| 2-import-auth-firebase-cli.sh | ⚠️ Partial   | `--resume`  | Resume skips existing users          |
| 5-import-firestore.sh         | ⚠️ Warning   | N/A         | Shows warning, requires confirmation |
| 9-migrate-rag-corpus.sh       | ✅ Yes       | `--resume`  | Resume checks import result files    |
| 10-delete-draft-chats.sh      | ✅ Yes       | N/A         | Idempotent by nature                 |

See individual script sections below for detailed usage.

---

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

- Imports users to `homegeek-staging` Authentication using Firebase CLI
- Preserves exact same UIDs
- **Migrates password hashes** (users can login with existing passwords immediately)
- OAuth users will work seamlessly
- No password reset required!

**Requirements:**

- Must run script 1 first
- Need FIREBASE_SCRYPT_KEY environment variable (or choose to import without passwords)

**Alternative:** If you can't get the SCRYPT key, the script offers an option to import without password hashes. Users will need to use "Forgot Password" to set new passwords.

**Re-running Authentication Import:**

If the import fails partway through or you need to add new users:

```bash
# Resume mode (recommended): Skip already-imported users
./2-import-auth-firebase-cli.sh --resume

# Force mode: Attempt to import all users (will fail on duplicate UIDs)
./2-import-auth-firebase-cli.sh --force
```

**Resume mode behavior:**

1. Exports existing users from target project
2. Compares UIDs with export file
3. Creates filtered export with only new users
4. Imports only the new users
5. Shows count of skipped vs new users

**Use cases:**

- ✅ Import failed midway → Use `--resume` to continue
- ✅ New users added to source → Use `--resume` to import only new ones
- ⚠️ Testing full reimport → Use `--force` (may fail on existing UIDs)

**Note:** Firebase CLI does not support updating existing users during import. If users already exist in the target, the import will fail for those UIDs unless using `--resume` mode.

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

- Copies export from goggle-gab bucket to homegeek-staging bucket using `gsutil cp`
- Imports all Firestore data with exact same IDs
- Monitors import progress
- Verifies successful completion

**Duration:** 5-30 minutes depending on data size

**Note:** Uses single-process mode for macOS compatibility.

You can also specify a custom export path:

```bash
./5-import-firestore.sh gs://goggle-gab.firebasestorage.app/firestore-migration/firestore-2025-11-18-1951
```

**Re-running Firestore Import:**

⚠️ **Important:** Firestore import uses document ID matching to overwrite data.

**Overwrite behavior:**

- Documents with matching IDs: **OVERWRITTEN** with import data
- New documents in import: **ADDED** to database
- Existing documents not in import: **REMAIN UNCHANGED**

**Safety features:**

1. Script checks if target Firestore has existing data
2. Shows warning with collection count and overwrite explanation
3. Requires explicit confirmation before proceeding
4. Any changes made in target since last import will be **LOST**

**Use cases:**

- ✅ Source data updated → Reimport to sync changes
- ⚠️ Made changes in target → Backup first or changes will be lost
- ⚠️ Testing → OK to overwrite, but understand data will reset

**Best practice:** If you've made changes in the target project that you want to keep, export that data first before reimporting:

```bash
# Backup current target data
./4-export-firestore.sh  # Run with TARGET_PROJECT=homegeek-staging

# Then reimport source data
./5-import-firestore.sh
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

- Copies all files from goggle-gab Storage to homegeek-staging
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
  - `gs://goggle-gab.firebasestorage.app` → `gs://homegeek-staging.firebasestorage.app`
  - `https://firebasestorage.googleapis.com/v0/b/goggle-gab...` → `https://firebasestorage.googleapis.com/v0/b/homegeek-staging...`
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
firebase deploy --only firestore:indexes --project homegeek-staging
```

---

### 9. Migrate Vertex AI RAG Corpus

⚠️ **Important**: This migrates user-uploaded documents to a new RAG corpus in the target project.

**Prerequisites:**

1. Create new RAG corpus manually in Vertex AI Console
2. Firestore and Storage data already migrated (steps 1-6)
3. Tools required:
   - Python 3.10+ installed (recommended for best compatibility)
   - `gcloud` CLI with application-default credentials
   - Python packages: `google-cloud-firestore`, `google-cloud-storage`, `google-cloud-aiplatform`

**Note:** This script uses Python with the official Vertex AI SDK since the RAG import operations are not available via REST API. A virtual environment is automatically created to avoid package conflicts.

```bash
chmod +x 9-migrate-rag-corpus.sh

# Set the new corpus ID (get from Vertex AI Console)
export NEW_RAG_CORPUS="projects/homegeek-staging/locations/us-central1/ragCorpora/YOUR_CORPUS_ID"

# Preview what will be imported (recommended first)
./9-migrate-rag-corpus.sh --dry-run

# Actual migration
./9-migrate-rag-corpus.sh
```

**What it does:**

- Uses Python with Vertex AI SDK to query Firestore `users/{userId}/docs` subcollections
- Verifies each file exists in migrated storage (`gs://homegeek-staging.firebasestorage.app`)
- Separates documents and media files (images, audio, video)
- Batch imports files per user to new RAG corpus using `vertexai.rag.import_files()`
- Generates new import result NDJSON files in `gs://homegeek-user-data/uploads/{userId}/import-results/`
- Preserves same structure as original imports

**Duration:** Varies by document count (1-2 hours for 1000+ documents)

**Re-running RAG Corpus Migration:**

The RAG migration script fully supports safe re-runs:

```bash
# Resume mode (recommended): Skip already-migrated users
./9-migrate-rag-corpus.sh --resume

# Force mode: Reimport all users (creates duplicates!)
./9-migrate-rag-corpus.sh --force
```

**Resume mode behavior:**

1. Checks GCS for import result files: `uploads/{userId}/import-results/*-migration*.ndjson`
2. If migration files exist for a user → **Skip** that user
3. Only imports users without migration files
4. Shows count of skipped vs new users

**Use cases:**

- ✅ Migration failed midway → Use `--resume` to continue from where it stopped
- ✅ New users added to source → Use `--resume` to import only new users
- ✅ Specific user import failed → Delete that user's import-results files, then `--resume`
- ⚠️ Need to reimport all users → Use `--force` (creates duplicates in corpus!)

**How to reset a specific user's migration:**

```bash
# Remove import result files for specific user
gsutil rm gs://homegeek-user-data/uploads/USER_ID/import-results/*-migration*.ndjson

# Then rerun with resume flag
./9-migrate-rag-corpus.sh --resume
```

**Note:** The script checks for import result files (not corpus contents) to determine if a user was migrated. This is much faster than querying the corpus itself.

**Technical Details:**

- Uses Python with `vertexai.rag.import_files()` SDK (only available via official SDKs)
- Creates isolated virtual environment in `scripts/migration/venv/`
- Automatically installs required Python packages in the virtual environment
- Uses `list_documents()` to find all users (including those with only subcollections)
- Checks `gsURI` field for GCS file paths
- Import results map GCS URLs to RAG FileIds for per-user query filtering
- Can take several hours depending on number of files

**After migration:**

1. Verify imports in Vertex AI Console → RAG → Corpora
2. Update environment variables:

   ```bash
   # In gcp/agents/homecare/.env
   USER_UPLOAD_RAG_CORPUS=projects/homegeek-staging/locations/us-central1/ragCorpora/NEW_ID

   # In GitHub Actions secrets
   # In Cloud Function environment variables
   ```

3. Redeploy agents with new corpus ID
4. Test user document queries
5. After 30 days, delete old corpus from `goggle-gab`

---

### 10. Delete Draft Chats

⚠️ **Optional Cleanup**: This removes draft chats from the Firestore database. Draft chats are temporary chats with `name = "draft"` that may have been left old AGENT Engine deployments.

**Prerequisites:**

- Firestore data already migrated (steps 1-6)
- Python 3.10+ installed
- Application Default Credentials configured (`gcloud auth application-default login`)

```bash
chmod +x 10-delete-draft-chats.sh

# Preview what will be deleted (recommended first)
./10-delete-draft-chats.sh --dry-run

# Delete draft chats
./10-delete-draft-chats.sh
```

**What it does:**

- Scans all users in `users` collection
- Queries each user's `chats` subcollection for documents where `name = "draft"`
- Shows draft chat details (ID, creation date)
- Deletes all found draft chats (unless in dry-run mode)
- Provides summary statistics

**Duration:** 1-2 minutes depending on user count

**Technical Details:**

- Uses Firebase Admin SDK with Python
- Uses Firestore query filters to find only draft chats (efficient)
- Processes users sequentially
- Automatically uses existing virtual environment from RAG migration

**When to run:**

- After migrating to clean up any draft chats
- Periodically as a maintenance task
- Before production deployment to ensure clean database

**Safety:**

- Dry-run mode shows what would be deleted without making changes
- Only deletes chats where `name` field exactly equals `"draft"`
- Does not affect regular user chats

---

## Verification

After running all scripts, verify the migration:

### Check Authentication

```bash
# List users in new project
firebase --project homegeek-staging auth:export users.csv
wc -l users.csv  # Should match original user count
```

### Check Firestore

```bash
# List collections
gcloud firestore collections list --project=homegeek-staging

# Compare document counts (example)
gcloud firestore documents list --collection=users --project=goggle-gab | wc -l
gcloud firestore documents list --collection=users --project=homegeek-staging | wc -l
```

### Check Storage

```bash
# Compare sizes
gsutil du -s gs://goggle-gab.firebasestorage.app
gsutil du -s gs://homegeek-staging.firebasestorage.app

# List files
gsutil ls -r gs://homegeek-staging.firebasestorage.app | head -20
```

### Check Vertex AI RAG Corpus

```bash
# List files in new RAG corpus
gcloud ai indexes list --project=homegeek-staging --region=us-central1

# Check import results exist
gsutil ls gs://homegeek-user-data/uploads/*/import-results/*-migration*.ndjson

# Verify file count in corpus (via Python)
python3 -c "
from vertexai import rag
import vertexai
vertexai.init(project='homegeek-staging', location='us-central1')
files = list(rag.list_files(corpus_name='YOUR_CORPUS_ID'))
print(f'Total files in corpus: {len(files)}')
"
```

## Troubleshooting

### Re-run and Resume Issues

**Authentication import shows "All users already imported":**

This is expected when running with `--resume` and all users are already in the target. If you need to update users:

```bash
# Check which users exist
firebase auth:export /tmp/check-users.json --project homegeek-staging
cat /tmp/check-users.json | jq '.users | length'

# To reimport (will fail on duplicate UIDs, but adds new users)
./2-import-auth-firebase-cli.sh --force
```

**RAG migration skips all users but some are missing:**

The script checks for import result files, not corpus contents. If files were deleted or never created:

```bash
# Check import results for a specific user
gsutil ls gs://homegeek-user-data/uploads/USER_ID/import-results/

# If no migration files found but user was imported, check corpus
# Then manually create import result or use --force to reimport
```

**Firestore import keeps asking for confirmation:**

This is by design when target has existing data. To auto-confirm (use carefully):

```bash
# Option 1: Delete target data first
gcloud firestore databases delete --database="(default)" --project=homegeek-staging

# Option 2: Answer 'y' to the prompt
echo "y" | ./5-import-firestore.sh
```

**Want to reset everything and start over:**

```bash
# 1. Delete authentication users
firebase auth:export /tmp/users.json --project homegeek-staging
# Manually delete users in Firebase Console (no bulk delete in CLI)

# 2. Delete Firestore data
gcloud firestore databases delete --database="(default)" --project=homegeek-staging
# Then recreate database in Console

# 3. Delete Storage files
gsutil rm -r gs://homegeek-staging.firebasestorage.app/**

# 4. Delete RAG corpus
gcloud ai indexes delete YOUR_CORPUS_ID --region=us-central1 --project=homegeek-staging
# Then recreate corpus in Console

# 5. Reset migration state
rm migration-state.json

# Now you can run the full migration again
```

**Check what's been completed so far:**

```bash
./check-migration-status.sh
```

### Permission Errors

If you get permission errors:

```bash
# Grant yourself necessary roles
gcloud projects add-iam-policy-binding goggle-gab \
  --member="user:your-email@gmail.com" \
  --role="roles/datastore.importExportAdmin"

gcloud projects add-iam-policy-binding homegeek-staging \
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
gcloud firestore operations list --project=homegeek-staging

# Check specific operation
gcloud firestore operations describe [OPERATION_NAME] --project=homegeek-staging
```

### Storage Copy Fails

For large files, increase timeout:

```bash
# Set longer timeout
gsutil -o "GSUtil:http_socket_timeout=300" -m cp -r \
  gs://goggle-gab.firebasestorage.app/* \
  gs://homegeek-staging.firebasestorage.app/
```

### RAG Corpus Migration Issues

**Node.js not installed:**

```bash
# Check Node.js version
node --version

# Install Node.js if needed
# macOS: brew install node
# Or download from: https://nodejs.org/
```

**Firebase Admin errors:**

```bash
# The script installs firebase-admin automatically
# If you encounter package issues, try:
npm install firebase-admin --no-save
```

**Authentication errors:**

```bash
# Ensure application default credentials are set
gcloud auth application-default login

# Verify authentication
gcloud auth application-default print-access-token
```

**Firestore access errors:**

```bash
# Check if you have read access to Firestore
gcloud projects get-iam-policy homegeek-staging --flatten="bindings[].members" --filter="bindings.members:user:YOUR_EMAIL"

# Grant Firestore access if needed
gcloud projects add-iam-policy-binding homegeek-staging \
  --member="user:YOUR_EMAIL" \
  --role="roles/datastore.viewer"
```

**Corpus not found errors:**

```bash
# List available RAG corpora
gcloud ai indexes list --project=homegeek-staging --region=us-central1

# Verify corpus ID format (should be full resource name)
# Correct: projects/homegeek-staging/locations/us-central1/ragCorpora/1234567890
# Wrong: 1234567890
```

**Import fails for specific files:**

- Check file exists in storage: `gsutil ls gs://path/to/file`
- Verify file is not corrupted
- Check file size (very large files may timeout)
- Review error message for specific file issues

**Slow import performance:**

- RAG import processes files sequentially per user
- Vertex AI has rate limits on concurrent imports
- Large documents (PDFs with many pages) take longer
- Expected: 1-5 seconds per file average

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
