#!/usr/bin/env python3

"""
Migration State Tracker
Tracks the state of migration scripts to enable resume capability
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

STATE_FILE = Path(__file__).parent / "migration-state.json"

def load_state():
    """Load migration state from file"""
    if STATE_FILE.exists():
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {"scripts": {}, "rag_users": {}}

def save_state(state):
    """Save migration state to file"""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def mark_script_complete(script_name, details=None):
    """Mark a migration script as completed"""
    state = load_state()
    state["scripts"][script_name] = {
        "completed": True,
        "timestamp": datetime.now().isoformat(),
        "details": details or {}
    }
    save_state(state)
    print(f"✓ Marked script '{script_name}' as completed")

def is_script_complete(script_name):
    """Check if a script has been completed"""
    state = load_state()
    return state["scripts"].get(script_name, {}).get("completed", False)

def mark_rag_user_complete(user_id, file_count):
    """Mark a user's RAG migration as completed"""
    state = load_state()
    state["rag_users"][user_id] = {
        "completed": True,
        "timestamp": datetime.now().isoformat(),
        "file_count": file_count
    }
    save_state(state)

def get_completed_rag_users():
    """Get list of users whose RAG migration is complete"""
    state = load_state()
    return list(state["rag_users"].keys())

def reset_state(script_name=None):
    """Reset migration state (optionally for specific script)"""
    if script_name:
        state = load_state()
        if script_name in state["scripts"]:
            del state["scripts"][script_name]
            save_state(state)
            print(f"✓ Reset state for script '{script_name}'")
        else:
            print(f"⚠ Script '{script_name}' not found in state")
    else:
        # Reset all
        save_state({"scripts": {}, "rag_users": {}})
        print("✓ Reset all migration state")

def show_status():
    """Show current migration status"""
    state = load_state()

    print("=" * 60)
    print("Migration Status")
    print("=" * 60)
    print()

    if not state["scripts"]:
        print("No migration scripts have been run yet.")
    else:
        print("Completed Scripts:")
        for script_name, info in state["scripts"].items():
            timestamp = info.get("timestamp", "Unknown")
            print(f"  ✓ {script_name}")
            print(f"    Completed: {timestamp}")
            if info.get("details"):
                for key, value in info["details"].items():
                    print(f"    {key}: {value}")
        print()

    if state["rag_users"]:
        print(f"RAG Migration:")
        print(f"  Completed users: {len(state['rag_users'])}")
        total_files = sum(u.get("file_count", 0) for u in state["rag_users"].values())
        print(f"  Total files migrated: {total_files}")
        print()

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Migration state tracker")
    parser.add_argument("action", choices=["status", "reset", "mark-complete"],
                       help="Action to perform")
    parser.add_argument("--script", help="Script name (for mark-complete and reset)")
    parser.add_argument("--details", help="JSON details (for mark-complete)")

    args = parser.parse_args()

    if args.action == "status":
        show_status()
    elif args.action == "reset":
        reset_state(args.script)
    elif args.action == "mark-complete":
        if not args.script:
            print("Error: --script required for mark-complete")
            sys.exit(1)
        details = json.loads(args.details) if args.details else None
        mark_script_complete(args.script, details)
