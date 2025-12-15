#!/bin/bash
set -e

# Get the directory of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Install test dependencies if needed (optional check)
# pip install -r requirements.txt

echo "Running tests..."
# Set PYTHONPATH to include the api directory
export PYTHONPATH=$PYTHONPATH:$DIR

# Run pytest
pytest tests/ -v

