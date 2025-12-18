#!/bin/bash
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


# Script to grant RAG Corpus access permissions (for both user upload and knowledge base corpora)

set -e

# Load environment variables from .env file
SCRIPT_DIR="$(dirname "$0")"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
else
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

# Get the project ID from environment variable
PROJECT_ID="$GOOGLE_CLOUD_PROJECT"
if [ -z "$PROJECT_ID" ]; then
  echo "No project ID found. Please set GOOGLE_CLOUD_PROJECT in .env file"
  exit 1
fi

# Get the project number
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
if [ -z "$PROJECT_NUMBER" ]; then
  echo "Failed to retrieve project number for project $PROJECT_ID"
  exit 1
fi

# Get RAG Corpus from the USER_UPLOAD_RAG_CORPUS environment variable
if [ -z "$USER_UPLOAD_RAG_CORPUS" ]; then
  echo "USER_UPLOAD_RAG_CORPUS environment variable is not set in the .env file"
  exit 1
fi

# Extract location from the corpus path
# Format: projects/{project}/locations/{location}/ragCorpora/{corpus_id}
CORPUS_LOCATION=$(echo "$USER_UPLOAD_RAG_CORPUS" | sed -n 's|.*/locations/\([^/]*\)/.*|\1|p')
if [ -z "$CORPUS_LOCATION" ]; then
  echo "Could not extract location from USER_UPLOAD_RAG_CORPUS: $USER_UPLOAD_RAG_CORPUS"
  exit 1
fi

echo "Detected RAG Corpus location: $CORPUS_LOCATION"
echo "RAG Corpus: $USER_UPLOAD_RAG_CORPUS"

# Define the service accounts that need access
REASONING_ENGINE_SA="service-${PROJECT_NUMBER}@gcp-sa-aiplatform-re.iam.gserviceaccount.com"

echo ""
echo "Service accounts that will be granted permissions:"
echo "  1. Reasoning Engine SA: $REASONING_ENGINE_SA"

# Ensure the AI Platform service identity exists
echo ""
echo "Ensuring AI Platform service identity exists..."
gcloud alpha services identity create --service=aiplatform.googleapis.com --project="$PROJECT_ID"

# Create a custom role with RAG access permissions (applies to all RAG corpora in project)
ROLE_ID="ragCorpusAccessRole"
ROLE_TITLE="RAG Corpus Access Role"
ROLE_DESCRIPTION="Custom role with permissions to access all RAG corpora (user upload and knowledge base)"

# Required permissions for RAG queries
PERMISSIONS="aiplatform.ragCorpora.get,aiplatform.ragCorpora.query,aiplatform.ragFiles.get,aiplatform.ragFiles.list"

# Check if the custom role already exists
echo ""
echo "Checking if custom role $ROLE_ID exists..."
if gcloud iam roles describe "$ROLE_ID" --project="$PROJECT_ID" &>/dev/null; then
  echo "Custom role $ROLE_ID already exists. Updating permissions..."
  gcloud iam roles update "$ROLE_ID" \
    --project="$PROJECT_ID" \
    --permissions="$PERMISSIONS"
  echo "Custom role updated successfully."
else
  echo "Custom role $ROLE_ID does not exist. Creating it..."
  gcloud iam roles create "$ROLE_ID" \
    --project="$PROJECT_ID" \
    --title="$ROLE_TITLE" \
    --description="$ROLE_DESCRIPTION" \
    --permissions="$PERMISSIONS"
  echo "Custom role $ROLE_ID created successfully."
fi

# Grant the custom role to the Reasoning Engine service account
echo ""
echo "Granting custom role to Reasoning Engine service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$REASONING_ENGINE_SA" \
  --role="projects/$PROJECT_ID/roles/$ROLE_ID"

# Grant Firestore permissions for checkpoint access
echo ""
echo "Granting Firestore permissions to Reasoning Engine service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$REASONING_ENGINE_SA" \
  --role="roles/datastore.user"

echo ""
echo "✅ Permissions granted successfully!"
echo ""
echo "Summary:"
echo "  - Service Account: $REASONING_ENGINE_SA"
echo "  - RAG Corpus Role: $ROLE_ID"
echo "  - RAG Corpus Permissions: $PERMISSIONS"
echo "  - Firestore Role: roles/datastore.user"
echo "  - RAG Corpus Location: $CORPUS_LOCATION"
echo "  - RAG Corpus: $USER_UPLOAD_RAG_CORPUS"
echo ""
echo "The deployed agent can now:"
echo "  - Access the User Docs RAG Corpus"
echo "  - Read checkpoints from Firestore"
