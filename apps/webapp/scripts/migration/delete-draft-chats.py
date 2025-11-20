#!/usr/bin/env python3

"""
Script to delete draft chats from Firebase users/<user-id>/chats collection
Finds and deletes documents where name = "draft"
"""

import sys
import argparse
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import FieldFilter

def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        # Initialize Firebase (uses default credentials)
        if not firebase_admin._apps:
            firebase_admin.initialize_app()

        # Get Firestore client
        db = firestore.client()

        # Get and print project ID
        project_id = firebase_admin.get_app().project_id
        print(f"🔗 Connected to Firebase Project: {project_id}")
        print("")

        return db
    except Exception as e:
        print(f"❌ Error initializing Firebase: {e}")
        sys.exit(1)

def find_and_delete_draft_chats(db, dry_run=False):
    """
    Find all draft chats across all users and delete them

    Args:
        db: Firestore client
        dry_run: If True, only show what would be deleted without actually deleting
    """
    total_users = 0
    total_drafts = 0
    deleted_drafts = 0
    errors = 0

    print("🔍 Scanning all users for draft chats...")
    print("")

    try:
        # Get all user documents
        users_ref = db.collection("users")
        user_doc_refs = users_ref.list_documents()

        for user_doc_ref in user_doc_refs:
            user_id = user_doc_ref.id
            total_users += 1

            # Query for draft chats in this user's chats collection
            chats_ref = user_doc_ref.collection("chats")

            # Query for documents where name = "draft"
            draft_query = chats_ref.where(filter=FieldFilter("name", "==", "draft"))
            draft_chats = list(draft_query.stream())

            if draft_chats:
                user_draft_count = len(draft_chats)
                total_drafts += user_draft_count

                print(f"👤 User: {user_id}")
                print(f"   Found {user_draft_count} draft chat(s)")

                for chat_doc in draft_chats:
                    chat_id = chat_doc.id
                    chat_data = chat_doc.to_dict()

                    # Show draft details
                    created_at = chat_data.get("createdAt", "Unknown")
                    print(f"   - Draft ID: {chat_id}")
                    print(f"     Created: {created_at}")

                    if dry_run:
                        print(f"     [DRY-RUN] Would delete this draft")
                    else:
                        try:
                            # Delete the draft chat document
                            chat_doc.reference.delete()
                            deleted_drafts += 1
                            print(f"     ✓ Deleted")
                        except Exception as e:
                            errors += 1
                            print(f"     ❌ Error deleting: {e}")

                print("")

        # Print summary
        print("=" * 60)
        print("📊 Summary:")
        print(f"   Total users scanned: {total_users}")
        print(f"   Total draft chats found: {total_drafts}")

        if dry_run:
            print(f"   [DRY-RUN] Would delete: {total_drafts} draft(s)")
        else:
            print(f"   Successfully deleted: {deleted_drafts}")
            if errors > 0:
                print(f"   Errors: {errors}")

        print("=" * 60)

        return deleted_drafts, errors

    except Exception as e:
        print(f"❌ Error scanning users: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description="Delete draft chats from Firebase users/<user-id>/chats collection"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be deleted without actually deleting"
    )

    args = parser.parse_args()

    # Initialize Firebase
    db = initialize_firebase()

    # Find and delete draft chats
    deleted, errors = find_and_delete_draft_chats(db, dry_run=args.dry_run)

    if args.dry_run:
        print("")
        print("ℹ️  This was a dry-run. No changes were made.")
        print("   Run without --dry-run flag to perform actual deletions.")
    elif errors > 0:
        print("")
        print(f"⚠️  Completed with {errors} error(s)")
        sys.exit(1)
    else:
        print("")
        print("✅ All draft chats deleted successfully!")

if __name__ == "__main__":
    main()
