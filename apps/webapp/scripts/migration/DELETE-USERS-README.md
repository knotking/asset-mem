# Delete Users by Pattern

This script allows you to find and delete Firebase users matching a specific email pattern, along with all their associated data in Firestore and Storage.

## What Gets Deleted

When you delete a user, the script will remove:

1. **Firestore Data**: All documents under `users/{userId}/` **recursively**, including:
   - All subcollections (e.g., `users/{userId}/chats/`)
   - All nested subcollections (e.g., `users/{userId}/chats/{chatId}/messages/`)
   - The entire document tree is traversed and deleted from bottom-up
2. **Storage Files**: All files under:
   - `uploads/{userId}/`
   - `documents/{userId}/`
3. **Firebase Auth**: The user's authentication account

**Note:** The script uses recursive deletion to ensure all nested subcollections are properly removed. This is important for collections like `chats` that may contain nested `messages` subcollections.

## Prerequisites

Before running the script, ensure you have:

1. **Firebase CLI** installed:

   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **gcloud CLI** installed and authenticated:

   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

3. **Python 3.10+** with required packages (installed automatically by the script):
   - firebase-admin
   - google-cloud-firestore
   - google-cloud-storage

4. **Permissions**: Your account needs the following roles:
   - Firebase Admin
   - Cloud Datastore Owner (for Firestore)
   - Storage Admin (for Cloud Storage)

## Usage

### Basic Usage

```bash
# Using environment variables
PROJECT=your-project PATTERN="test-*" ./delete-users-by-pattern.sh

# Using command-line arguments
./delete-users-by-pattern.sh --project your-project --pattern "test-*"
```

### Dry Run (Recommended First Step)

Always run with `--dry-run` first to preview what will be deleted:

```bash
./delete-users-by-pattern.sh --project your-project --pattern "test-*" --dry-run
```

This will:

- List all matching users
- Show what data would be deleted
- **Not actually delete anything**

### Pattern Examples

The `--pattern` argument supports wildcard patterns:

```bash
# Delete all users with emails starting with "test-"
--pattern "test-*"

# Delete all users from a specific domain
--pattern "*@example.com"

# Delete all users with "demo" in their email
--pattern "*demo*"

# Delete a specific user by exact email
--pattern "user@example.com"

# Delete all users with emails starting with "temp" and ending with a number
--pattern "temp*[0-9]@*"
```

## Step-by-Step Guide

### 1. Dry Run First (Preview)

```bash
./delete-users-by-pattern.sh \
  --project homegeek-staging \
  --pattern "test-*" \
  --dry-run
```

Review the output carefully:

- Check the list of users that will be deleted
- Verify the Firestore collections
- Review the Storage files

### 2. Run the Actual Deletion

If the dry run looks correct, run without `--dry-run`:

```bash
./delete-users-by-pattern.sh \
  --project homegeek-staging \
  --pattern "test-*"
```

You will be prompted to type `DELETE` (in capitals) to confirm.

## Example Output

```
🗑️  Firebase User Deletion Script
==================================

🔍 DRY RUN MODE - No deletions will be performed

📋 Configuration:
   Project: homegeek-staging
   Pattern: test-*

🔧 Checking prerequisites...
   ✓ Firebase CLI
   ✓ gcloud CLI
   ✓ gsutil
   ✓ Python: python3.11

🔍 Searching for users matching pattern: test-*

   ✓ Found: test-user1@example.com (UID: abc123)
   ✓ Found: test-user2@example.com (UID: def456)

📊 Scanned 50 total users
   Matched 2 users

🗑️  Processing users...

👤 User: test-user1@example.com
   UID: abc123
   📄 Firestore: users/abc123/
      Collection: chats/
         └─ Subcollection: messages/
            [DRY-RUN] Would delete 15 document(s)
         [DRY-RUN] Would delete: chat-1
         [DRY-RUN] Would delete: chat-2
         [DRY-RUN] Would delete 5 document(s) in this collection
      Collection: documents/
         [DRY-RUN] Would delete: doc-1
         [DRY-RUN] Would delete: doc-2
         [DRY-RUN] Would delete 3 document(s) in this collection
      [DRY-RUN] Would delete user document
   🗂️  Storage:
      Path: uploads/abc123/
         [DRY-RUN] Would delete 10 file(s)
      Path: documents/abc123/
         [DRY-RUN] Would delete 2 file(s)
   👤 Auth: Deleting user account
      [DRY-RUN] Would delete user: abc123

======================================================================
📊 Summary:
   Users processed: 2
   [DRY-RUN] Would delete 2 user(s)
   [DRY-RUN] Would delete ~16 Firestore document(s)
   [DRY-RUN] Would delete ~24 Storage file(s)
======================================================================

✅ Dry run completed successfully!

📝 Next steps:
   Review the output above to verify the users and data to be deleted
   Run without --dry-run flag to perform actual deletions
```

## Safety Features

1. **Dry Run Mode**: Preview changes before making them
2. **Confirmation Prompt**: Must type 'DELETE' to confirm (in live mode)
3. **Detailed Logging**: See exactly what's being deleted
4. **Error Handling**: Continues processing even if individual operations fail
5. **Pattern Matching**: Only deletes users matching the exact pattern

## Troubleshooting

### Authentication Issues

If you see authentication errors:

```bash
# Re-authenticate with Firebase
firebase login

# Re-authenticate with gcloud
gcloud auth login
gcloud auth application-default login

# Set the correct project
gcloud config set project your-project
```

### Permission Errors

If you see permission errors, ensure your account has:

- Firebase Admin role
- Cloud Datastore Owner role
- Storage Admin role

Add these in the [Google Cloud Console](https://console.cloud.google.com/iam-admin/iam).

### Storage Bucket Not Found

If the storage bucket is not accessible:

1. Check the bucket exists in Firebase Console → Storage
2. Verify the bucket name matches: `{project-id}.firebasestorage.app`
3. Ensure you have Storage Admin permissions

### Python Package Issues

If you encounter Python package errors:

```bash
# Remove the virtual environment and let the script recreate it
rm -rf apps/webapp/scripts/migration/venv

# Run the script again
./delete-users-by-pattern.sh --project your-project --pattern "test-*" --dry-run
```

## Advanced Usage

### Run Python Script Directly

You can also run the Python script directly:

```bash
# Activate the virtual environment first
source apps/webapp/scripts/migration/venv/bin/activate

# Set the project
export GOOGLE_CLOUD_PROJECT=your-project

# Run the script
python apps/webapp/scripts/migration/delete-users-by-pattern.py \
  --project your-project \
  --pattern "test-*" \
  --dry-run
```

## Important Notes

⚠️ **This operation is irreversible!**

- Deleted users cannot be recovered
- Deleted Firestore documents cannot be recovered
- Deleted Storage files cannot be recovered

📝 **Best Practices:**

1. Always run with `--dry-run` first
2. Review the output carefully
3. Test on a non-production project first
4. Consider exporting data before deletion
5. Document which patterns you're deleting and why

## Related Scripts

- `1-export-auth-firebase-cli.sh` - Export users before deletion (for backup)
- `4-export-firestore.sh` - Export Firestore data before deletion (for backup)
- `10-delete-draft-chats.sh` - Delete specific data without deleting users

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all prerequisites are installed
3. Ensure you have the correct permissions
4. Review the error messages in the output
