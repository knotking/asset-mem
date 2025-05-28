#!/bin/bash
LOG_FILE="$1"
while ! grep -q "Startup script execution completed" "$LOG_FILE" 2>/dev/null; do
  tail -n 20 "$LOG_FILE" 2>/dev/null || echo "Log not found yet"
  sleep 30
done
cat "$LOG_FILE"