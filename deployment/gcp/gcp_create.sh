#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

# Error handling function
error_exit() {
    echo "Error: $1"
    exit 1
}


# ==== CONFIG ====
PROJECT_ID="homegeekdemo"
INSTANCE_NAME="homegeekdemo"
ZONE="us-central1-a"
MACHINE_TYPE="e2-medium"
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"
TAGS="homegeek-demo"
SCRIPT_NAME="gcp_setup.sh"
SERVICE_ACCOUNT="serviceAccount:321433914812-compute@developer.gserviceaccount.com"
# =================
# e2-medium - 2 vCPU(shared) with 4 GB RAM  and 10 GB persistent disk. Approx $25.46 monthly cost
# Create a new GCP VM instance
echo "🚀 Creating GCP VM instance..."


# Function to check if the instance is running and remove it if it is
check_and_remove_instance() {
    if gcloud compute instances describe "$INSTANCE_NAME" --zone "$ZONE" &> /dev/null; then
        echo "Removing existing instance"
        gcloud compute instances delete "$INSTANCE_NAME" --zone "$ZONE" --quiet || error_exit "Failed to delete VM instance."
    fi
}
# Call the function to check and remove the instance
check_and_remove_instance

gcloud compute instances create "$INSTANCE_NAME" \
   --zone "$ZONE" \
   --machine-type "$MACHINE_TYPE" \
   --image-family "$IMAGE_FAMILY" \
   --image-project "$IMAGE_PROJECT" \
   --scopes=https://www.googleapis.com/auth/cloud-platform \
   --tags "$TAGS" || error_exit "Failed to create VM instance."


# Function to copy the setup script with retries
copy_script_with_retries() {
    local retries=3
    local count=0
    local success=0

    while [ $count -lt $retries ]; do
        echo "📁 Attempting to copy setup script to the instance (Attempt $((count + 1)) of $retries)..."
        gcloud compute scp "$SCRIPT_NAME" "$INSTANCE_NAME":~ --zone "$ZONE" && {
            success=1
            break
        }
        count=$((count + 1))
        echo "⚠️ Attempt $count failed. Retrying..."
        sleep 5  # Wait for 5 seconds before retrying
    done

    if [ $success -eq 0 ]; then
        error_exit "Failed to copy setup script to VM after $retries attempts."
    fi
}

# Copy the setup script to the instance
echo "📁 Copying setup script to the instance..."

# Call the function to copy the setup script
copy_script_with_retries || error_exit "Failed to copy setup scrip to VM."

# Run the setup script on the instance
echo "🔧 Running setup script on the instance..."
gcloud compute ssh "$INSTANCE_NAME" --zone "$ZONE" --command "bash ~/$SCRIPT_NAME" || error_exit "Failed to run setup."

echo "✅ Instance setup and deployment complete!"