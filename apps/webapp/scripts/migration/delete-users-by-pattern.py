#!/usr/bin/env python3

"""
Script to delete Firebase users matching a specific pattern
Deletes:
1. All Firestore documents under users/{userId}/ (recursive)
2. llm_token_usage/{userId} (+ periods)
3. support_requests/{userId} (+ messages)
4. sharedChats where originalUserId == userId
5. All Storage files under uploads/{userId}/ and documents/{userId}/
6. Vertex RAG files for user doc gsURIs (when RAG_CORPUS env is set)
7. The Firebase Auth user account

Usage:
    python delete-users-by-pattern.py --project PROJECT --pattern PATTERN [--dry-run]
"""

import os
import sys
import argparse
import re
import fnmatch
import firebase_admin
from firebase_admin import credentials, firestore, auth, storage
from google.cloud import storage as gcs_storage
from google.cloud.firestore_v1.base_query import FieldFilter


def initialize_firebase(project_id):
    """Initialize Firebase Admin SDK"""
    try:
        # Initialize Firebase with project ID
        if not firebase_admin._apps:
            firebase_admin.initialize_app(options={'projectId': project_id})

        # Get clients
        db = firestore.client()
        bucket = storage.bucket(f"{project_id}.firebasestorage.app")

        print(f"🔗 Connected to Firebase Project: {project_id}")
        print("")

        return db, bucket
    except Exception as e:
        print(f"❌ Error initializing Firebase: {e}")
        sys.exit(1)


def list_users_by_pattern(pattern):
    """
    List all Firebase Auth users matching the email pattern

    Args:
        pattern: Email pattern to match (supports wildcards like "test-*", "*@example.com")

    Returns:
        List of user records matching the pattern
    """
    matching_users = []

    print(f"🔍 Searching for users matching pattern: {pattern}")
    print("")

    try:
        # List all users
        page = auth.list_users()
        total_users = 0

        while page:
            for user in page.users:
                total_users += 1
                email = user.email or ""

                # Match pattern (supports wildcards)
                if fnmatch.fnmatch(email, pattern):
                    matching_users.append(user)
                    print(f"   ✓ Found: {email} (UID: {user.uid})")

            # Get next batch of users
            page = page.get_next_page()

        print("")
        print(f"📊 Scanned {total_users} total users")
        print(f"   Matched {len(matching_users)} users")
        print("")

        return matching_users

    except Exception as e:
        print(f"❌ Error listing users: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def delete_document_recursively(doc_ref, dry_run=False, indent=2):
    """
    Recursively delete a document and all its subcollections

    Args:
        doc_ref: Document reference to delete
        dry_run: If True, only show what would be deleted
        indent: Indentation level for logging

    Returns:
        Tuple of (documents_deleted, errors)
    """
    documents_deleted = 0
    errors = 0
    indent_str = "   " * indent

    try:
        # Get all subcollections of this document
        subcollections = doc_ref.collections()

        for subcollection in subcollections:
            subcollection_name = subcollection.id
            print(f"{indent_str}└─ Subcollection: {subcollection_name}/")

            # Get all documents in this subcollection
            docs = list(subcollection.stream())

            for doc in docs:
                # Recursively delete this document and its subcollections
                sub_deleted, sub_errors = delete_document_recursively(
                    doc.reference,
                    dry_run=dry_run,
                    indent=indent + 1
                )
                documents_deleted += sub_deleted
                errors += sub_errors

                # Delete the document itself
                if dry_run:
                    print(f"{indent_str}   [DRY-RUN] Would delete: {doc.id}")
                else:
                    try:
                        doc.reference.delete()
                        documents_deleted += 1
                    except Exception as e:
                        errors += 1
                        print(f"{indent_str}   ❌ Error deleting {doc.id}: {e}")

            if docs:
                if dry_run:
                    print(f"{indent_str}   [DRY-RUN] Would delete {len(docs)} document(s)")
                else:
                    print(f"{indent_str}   ✓ Deleted {len(docs)} document(s)")

        return documents_deleted, errors

    except Exception as e:
        print(f"{indent_str}❌ Error processing subcollections: {e}")
        return documents_deleted, errors


def collect_user_doc_gs_uris(db, user_id):
    """Collect gsURI values from users/{userId}/docs before Firestore wipe."""
    uris = []
    user_ref = db.collection("users").document(user_id)
    for snap in user_ref.collection("docs").stream():
        data = snap.to_dict() or {}
        if data.get("gsURI"):
            uris.append(str(data["gsURI"]))
    return list(dict.fromkeys(uris))


def delete_rag_files_for_user(gs_uris, dry_run=False):
    """Best-effort RAG cleanup when RAG_CORPUS / USER_UPLOAD_RAG_CORPUS is configured."""
    if not gs_uris:
        return 0, 0
    if dry_run:
        print(f"      [DRY-RUN] Would delete up to {len(gs_uris)} RAG file(s)")
        return 0, 0
    try:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
        if repo_root not in sys.path:
            sys.path.insert(0, repo_root)
        from common.rag.delete import delete_rag_files_by_gcs_uris

        deleted, warnings = delete_rag_files_by_gcs_uris(gs_uris)
        for w in warnings:
            print(f"      ⚠️  RAG: {w}")
        if deleted:
            print(f"      ✓ Deleted {deleted} RAG file(s)")
        return deleted, len(warnings)
    except Exception as e:
        print(f"      ⚠️  RAG cleanup skipped: {e}")
        return 0, 1


def delete_llm_token_usage(db, user_id, dry_run=False):
    """Delete llm_token_usage/{userId} and periods subcollection."""
    deleted = 0
    errors = 0
    root = db.collection("llm_token_usage").document(user_id)
    for period in root.collection("periods").stream():
        if dry_run:
            print(f"      [DRY-RUN] Would delete llm_token_usage period {period.id}")
        else:
            try:
                period.reference.delete()
                deleted += 1
            except Exception as e:
                errors += 1
                print(f"      ❌ llm_token_usage period {period.id}: {e}")
    if root.get().exists:
        if dry_run:
            print("      [DRY-RUN] Would delete llm_token_usage root doc")
        else:
            try:
                root.delete()
                deleted += 1
            except Exception as e:
                errors += 1
                print(f"      ❌ llm_token_usage root: {e}")
    return deleted, errors


def delete_support_requests(db, user_id, dry_run=False):
    deleted = 0
    errors = 0
    ref = db.collection("support_requests").document(user_id)
    for msg in ref.collection("messages").stream():
        if dry_run:
            print(f"      [DRY-RUN] Would delete support message {msg.id}")
        else:
            try:
                msg.reference.delete()
                deleted += 1
            except Exception as e:
                errors += 1
                print(f"      ❌ support message {msg.id}: {e}")
    if ref.get().exists:
        if dry_run:
            print("      [DRY-RUN] Would delete support_requests parent")
        else:
            try:
                ref.delete()
                deleted += 1
            except Exception as e:
                errors += 1
                print(f"      ❌ support_requests parent: {e}")
    return deleted, errors


def delete_shared_chats_for_user(db, user_id, dry_run=False):
    deleted = 0
    errors = 0
    query = db.collection("sharedChats").where(
        filter=FieldFilter("originalUserId", "==", user_id)
    )
    for snap in query.stream():
        if dry_run:
            print(f"      [DRY-RUN] Would delete sharedChat {snap.id}")
            deleted += 1
            continue
        try:
            for msg in snap.reference.collection("messages").stream():
                msg.reference.delete()
            snap.reference.delete()
            deleted += 1
        except Exception as e:
            errors += 1
            print(f"      ❌ sharedChat {snap.id}: {e}")
    return deleted, errors


def delete_firestore_user_data(db, user_id, dry_run=False):
    """
    Delete all Firestore documents under users/{userId}/ recursively

    Args:
        db: Firestore client
        user_id: User ID to delete data for
        dry_run: If True, only show what would be deleted

    Returns:
        Tuple of (documents_deleted, errors)
    """
    print(f"   📄 Firestore: users/{user_id}/")

    documents_deleted = 0
    errors = 0

    try:
        user_ref = db.collection("users").document(user_id)

        # Get all subcollections of the user document
        subcollections = user_ref.collections()

        for subcollection in subcollections:
            subcollection_name = subcollection.id
            print(f"      Collection: {subcollection_name}/")

            # Get all documents in subcollection
            docs = list(subcollection.stream())

            for doc in docs:
                # Recursively delete this document and all its subcollections
                sub_deleted, sub_errors = delete_document_recursively(
                    doc.reference,
                    dry_run=dry_run,
                    indent=3
                )
                documents_deleted += sub_deleted
                errors += sub_errors

                # Delete the document itself
                doc_count = 1
                if dry_run:
                    print(f"         [DRY-RUN] Would delete: {doc.id}")
                else:
                    try:
                        doc.reference.delete()
                        documents_deleted += 1
                    except Exception as e:
                        errors += 1
                        print(f"         ❌ Error deleting {doc.id}: {e}")

            if docs:
                if dry_run:
                    print(f"         [DRY-RUN] Would delete {len(docs)} document(s) in this collection")
                else:
                    print(f"         ✓ Deleted {len(docs)} document(s) from this collection")

        # Delete the user document itself
        user_doc = user_ref.get()
        if user_doc.exists:
            if dry_run:
                print(f"      [DRY-RUN] Would delete user document")
            else:
                try:
                    user_ref.delete()
                    documents_deleted += 1
                    print(f"      ✓ Deleted user document")
                except Exception as e:
                    errors += 1
                    print(f"      ❌ Error deleting user document: {e}")

        return documents_deleted, errors

    except Exception as e:
        print(f"      ❌ Error processing Firestore data: {e}")
        import traceback
        traceback.print_exc()
        return documents_deleted, errors


def delete_storage_user_data(bucket, user_id, dry_run=False):
    """
    Delete all Storage files under uploads/{userId}/ and documents/{userId}/

    Args:
        bucket: Storage bucket
        user_id: User ID to delete files for
        dry_run: If True, only show what would be deleted

    Returns:
        Tuple of (files_deleted, errors)
    """
    print(f"   🗂️  Storage:")

    files_deleted = 0
    errors = 0

    paths = [f"uploads/{user_id}/", f"documents/{user_id}/"]

    try:
        for path in paths:
            print(f"      Path: {path}")

            # List all blobs in the path
            blobs = list(bucket.list_blobs(prefix=path))

            if not blobs:
                print(f"         No files found")
                continue

            for blob in blobs:
                if dry_run:
                    print(f"         [DRY-RUN] Would delete: {blob.name}")
                else:
                    try:
                        blob.delete()
                        files_deleted += 1
                    except Exception as e:
                        errors += 1
                        print(f"         ❌ Error deleting {blob.name}: {e}")

            if dry_run:
                print(f"         [DRY-RUN] Would delete {len(blobs)} file(s)")
            else:
                print(f"         ✓ Deleted {len(blobs)} file(s)")

        return files_deleted, errors

    except Exception as e:
        print(f"      ⚠️  Error accessing Storage (may not have permissions): {e}")
        # Don't fail the entire process if storage fails
        return files_deleted, errors


def delete_auth_user(user_id, dry_run=False):
    """
    Delete the Firebase Auth user account

    Args:
        user_id: User ID to delete
        dry_run: If True, only show what would be deleted

    Returns:
        Tuple of (success, error)
    """
    print(f"   👤 Auth: Deleting user account")

    if dry_run:
        print(f"      [DRY-RUN] Would delete user: {user_id}")
        return True, None

    try:
        auth.delete_user(user_id)
        print(f"      ✓ Deleted user account")
        return True, None
    except Exception as e:
        print(f"      ❌ Error deleting user account: {e}")
        return False, str(e)


def delete_users_by_pattern(project_id, pattern, dry_run=False):
    """
    Main function to delete users matching a pattern

    Args:
        project_id: Firebase project ID
        pattern: Email pattern to match
        dry_run: If True, only preview without deleting
    """
    # Initialize Firebase
    db, bucket = initialize_firebase(project_id)

    # Find matching users
    matching_users = list_users_by_pattern(pattern)

    if not matching_users:
        print("ℹ️  No users found matching the pattern.")
        return

    # Confirm before proceeding (unless dry-run)
    if not dry_run:
        print("")
        print("=" * 70)
        print(f"⚠️  WARNING: About to delete {len(matching_users)} user(s) and all their data!")
        print("=" * 70)
        print("")
        print("This will permanently delete:")
        print("  • All Firestore documents under users/{userId}/")
        print("  • All Storage files under uploads/{userId}/ and documents/{userId}/")
        print("  • The Firebase Authentication account")
        print("")

        response = input("Type 'DELETE' (in capitals) to confirm: ")
        if response != "DELETE":
            print("")
            print("❌ Deletion cancelled.")
            sys.exit(0)
        print("")

    # Process each user
    total_stats = {
        'users_processed': 0,
        'users_deleted': 0,
        'firestore_docs_deleted': 0,
        'storage_files_deleted': 0,
        'errors': 0
    }

    print("🗑️  Processing users...")
    print("")

    for user in matching_users:
        user_id = user.uid
        email = user.email or "(no email)"

        print(f"👤 User: {email}")
        print(f"   UID: {user_id}")

        total_stats['users_processed'] += 1

        gs_uris = collect_user_doc_gs_uris(db, user_id)
        _, rag_errors = delete_rag_files_for_user(gs_uris, dry_run=dry_run)
        total_stats['errors'] += rag_errors

        # Delete Firestore user tree
        docs_deleted, firestore_errors = delete_firestore_user_data(db, user_id, dry_run)
        total_stats['firestore_docs_deleted'] += docs_deleted
        total_stats['errors'] += firestore_errors

        llm_deleted, llm_errors = delete_llm_token_usage(db, user_id, dry_run)
        total_stats['firestore_docs_deleted'] += llm_deleted
        total_stats['errors'] += llm_errors

        support_deleted, support_errors = delete_support_requests(db, user_id, dry_run)
        total_stats['firestore_docs_deleted'] += support_deleted
        total_stats['errors'] += support_errors

        shared_deleted, shared_errors = delete_shared_chats_for_user(db, user_id, dry_run)
        total_stats['firestore_docs_deleted'] += shared_deleted
        total_stats['errors'] += shared_errors

        # Delete Storage data
        files_deleted, storage_errors = delete_storage_user_data(bucket, user_id, dry_run)
        total_stats['storage_files_deleted'] += files_deleted
        total_stats['errors'] += storage_errors

        # Delete Auth user
        success, error = delete_auth_user(user_id, dry_run)
        if success:
            total_stats['users_deleted'] += 1
        else:
            total_stats['errors'] += 1

        print("")

    # Print summary
    print("=" * 70)
    print("📊 Summary:")
    print(f"   Users processed: {total_stats['users_processed']}")

    if dry_run:
        print(f"   [DRY-RUN] Would delete {total_stats['users_processed']} user(s)")
        print(f"   [DRY-RUN] Would delete ~{total_stats['firestore_docs_deleted']} Firestore document(s)")
        print(f"   [DRY-RUN] Would delete ~{total_stats['storage_files_deleted']} Storage file(s)")
    else:
        print(f"   Users deleted: {total_stats['users_deleted']}")
        print(f"   Firestore documents deleted: {total_stats['firestore_docs_deleted']}")
        print(f"   Storage files deleted: {total_stats['storage_files_deleted']}")

        if total_stats['errors'] > 0:
            print(f"   ⚠️  Errors encountered: {total_stats['errors']}")

    print("=" * 70)

    return total_stats


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description="Delete Firebase users matching a specific pattern",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to preview what would be deleted
  python delete-users-by-pattern.py --project my-project --pattern "test-*" --dry-run

  # Delete all users with emails starting with "test-"
  python delete-users-by-pattern.py --project my-project --pattern "test-*"

  # Delete all users from a specific domain
  python delete-users-by-pattern.py --project my-project --pattern "*@example.com"

  # Delete a specific user by email
  python delete-users-by-pattern.py --project my-project --pattern "user@example.com"
        """
    )

    parser.add_argument(
        "--project",
        required=True,
        help="Firebase project ID"
    )

    parser.add_argument(
        "--pattern",
        required=True,
        help="Email pattern to match (supports wildcards: *, ?)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be deleted without actually deleting"
    )

    args = parser.parse_args()

    try:
        # Delete users
        stats = delete_users_by_pattern(args.project, args.pattern, dry_run=args.dry_run)

        if args.dry_run:
            print("")
            print("ℹ️  This was a dry-run. No changes were made.")
            print("   Run without --dry-run flag to perform actual deletions.")
        elif stats and stats['errors'] > 0:
            print("")
            print(f"⚠️  Completed with {stats['errors']} error(s)")
            sys.exit(1)
        else:
            print("")
            print("✅ All operations completed successfully!")

    except KeyboardInterrupt:
        print("")
        print("")
        print("⚠️  Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print("")
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
