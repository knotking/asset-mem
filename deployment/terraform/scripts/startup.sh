#!/bin/bash
set -e

# Log file for tracking installation
LOG_FILE="/var/log/startup_script.log"
echo "Startup script execution started at $(date)" >> $LOG_FILE

# Fetch the environment variable from metadata
echo "Fetching environment variable from metadata..." >> $LOG_FILE
ENVIRONMENT=$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/environment" -H "Metadata-Flavor: Google")
if [ $? -eq 0 ]; then
  echo "Environment variable fetched successfully: $ENVIRONMENT" >> $LOG_FILE
else
  echo "Failed to fetch environment variable." >> $LOG_FILE
  exit 1
fi

# Install Docker and Docker Compose
echo "Installing Docker and Docker Compose..." >> $LOG_FILE
apt-get update >> $LOG_FILE 2>&1
apt-get install -y docker.io docker-compose >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then
  echo "Docker and Docker Compose installed successfully." >> $LOG_FILE
else
  echo "Failed to install Docker and Docker Compose." >> $LOG_FILE
  exit 1
fi

# Add user to Docker group
echo "Adding user to Docker group..." >> $LOG_FILE
usermod -aG docker $(whoami) >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then
  echo "User added to Docker group successfully." >> $LOG_FILE
else
  echo "Failed to add user to Docker group." >> $LOG_FILE
  exit 1
fi

# Get GitHub token from Secret Manager
echo "Fetching GitHub token from Secret Manager..." >> $LOG_FILE
GITHUB_TOKEN=$(gcloud secrets versions access latest --secret=github-token 2>> $LOG_FILE)
if [ $? -eq 0 ]; then
  echo "GitHub token fetched successfully." >> $LOG_FILE
else
  echo "Failed to fetch GitHub token." >> $LOG_FILE
  exit 1
fi

# Clone repository
echo "Cloning repository..." >> $LOG_FILE
REPO_NAME="HomeAMA"
REPO="prakashbask/$REPO_NAME"
REPO_URL="https://$GITHUB_TOKEN@github.com/$REPO.git"
git clone "$REPO_URL" >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then
  echo "Repository cloned successfully." >> $LOG_FILE
else
  echo "Failed to clone repository." >> $LOG_FILE
  exit 1
fi

cd $REPO_NAME
# Copy ENV file
cp ".env.$ENVIRONMENT" .env >> $LOG_FILE 2>&1
# Start Docker Compose
echo "Starting Docker Compose..." >> $LOG_FILE
docker-compose up -d >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then
  echo "Docker Compose started successfully." >> $LOG_FILE
else
  echo "Failed to start Docker Compose." >> $LOG_FILE
  exit 1
fi

echo "Startup script execution completed at $(date)" >> $LOG_FILE