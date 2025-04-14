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

# Create deploy user and add to Docker group
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
if [ $? -eq 0 ]; then
  echo "Deploy user created and added to Docker group successfully." >> $LOG_FILE
else
  echo "Failed to create deploy user or add to Docker group." >> $LOG_FILE
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
REPO_NAME="HomeAMA"
# Clone repository as deploy user
echo "Cloning repository as deploy user..." >> $LOG_FILE
sudo -u deploy bash -c "
  GITHUB_TOKEN=$GITHUB_TOKEN
  cd /home/deploy &&
  git clone https://$GITHUB_TOKEN@github.com/prakashbask/$REPO_NAME.git
" >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then
  echo "Repository cloned successfully as deploy user." >> $LOG_FILE
else
  echo "Failed to clone repository as deploy user." >> $LOG_FILE
  exit 1
fi

sudo -u deploy bash -c "
  GITHUB_TOKEN=$GITHUB_TOKEN
  cd /home/deploy/$REPO_NAME &&
  cp .env.$ENVIRONMENT .env
" >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then
  echo ".env file copied successfully." >> $LOG_FILE
else
  echo "Failed to copy .env file." >> $LOG_FILE
  exit 1
fi


# Start Docker Compose as deploy user
echo "Starting Docker Compose as deploy user..." >> $LOG_FILE
sudo -u deploy bash -c "
  cd /home/deploy/$REPO_NAME &&
  docker-compose up -d
" >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then
  echo "Docker Compose started successfully as deploy user." >> $LOG_FILE
else
  echo "Failed to start Docker Compose as deploy user." >> $LOG_FILE
  exit 1
fi

echo "Startup script execution completed at $(date)" >> $LOG_FILE