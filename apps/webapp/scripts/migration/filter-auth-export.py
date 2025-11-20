#!/usr/bin/env python3

"""
Filter Authentication Export
Removes users that already exist in target project to enable resume
"""

import json
import sys
import subprocess

def get_existing_users(project_id):
    """Get list of existing user UIDs in target project"""
    try:
        # Export existing users from target
        result = subprocess.run(
            ["firebase", "auth:export", f"/tmp/existing-users-{project_id}.json", "--project", project_id],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"Warning: Could not fetch existing users: {result.stderr}", file=sys.stderr)
            return set()

        # Parse existing users
        with open(f"/tmp/existing-users-{project_id}.json", 'r') as f:
            existing_data = json.load(f)
            existing_uids = {user['localId'] for user in existing_data.get('users', [])}

        print(f"✓ Found {len(existing_uids)} existing users in {project_id}", file=sys.stderr)
        return existing_uids

    except Exception as e:
        print(f"Warning: Error fetching existing users: {e}", file=sys.stderr)
        return set()

def filter_export(input_file, output_file, project_id, skip_check=False):
    """Filter export file to remove already-imported users"""

    # Load export
    with open(input_file, 'r') as f:
        export_data = json.load(f)

    total_users = len(export_data.get('users', []))
    print(f"📊 Total users in export: {total_users}", file=sys.stderr)

    if skip_check:
        print("⚠️  Skipping duplicate check (--force flag used)", file=sys.stderr)
        with open(output_file, 'w') as f:
            json.dump(export_data, f, indent=2)
        return total_users, 0

    # Get existing users
    print("🔍 Checking for existing users in target...", file=sys.stderr)
    existing_uids = get_existing_users(project_id)

    # Filter users
    new_users = [
        user for user in export_data.get('users', [])
        if user['localId'] not in existing_uids
    ]

    skipped_count = total_users - len(new_users)

    # Create filtered export
    filtered_export = {
        **export_data,
        'users': new_users
    }

    with open(output_file, 'w') as f:
        json.dump(filtered_export, f, indent=2)

    print(f"✓ New users to import: {len(new_users)}", file=sys.stderr)
    print(f"✓ Users to skip (already exist): {skipped_count}", file=sys.stderr)

    return len(new_users), skipped_count

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Filter authentication export for resume capability")
    parser.add_argument("input_file", help="Input export JSON file")
    parser.add_argument("output_file", help="Output filtered JSON file")
    parser.add_argument("--project", required=True, help="Target project ID")
    parser.add_argument("--force", action="store_true", help="Skip duplicate check, import all users")

    args = parser.parse_args()

    new_count, skipped_count = filter_export(
        args.input_file,
        args.output_file,
        args.project,
        args.force
    )

    # Exit code indicates if there are new users to import
    sys.exit(0 if new_count > 0 else 1)
