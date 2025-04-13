#!/bin/bash
set -e

# Log file for tracking installation
LOG_FILE="/var/log/startup_script.log"
echo "Startup script execution started at $(date)" >> $LOG_FILE

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
REPO="prakashbask/HomeAMA"
REPO_URL="https://$GITHUB_TOKEN@github.com/$REPO.git"
git clone "$REPO_URL" >> $LOG_FILE 2>&1
if [ $? -eq 0 ]; then
  echo "Repository cloned successfully." >> $LOG_FILE
else
  echo "Failed to clone repository." >> $LOG_FILE
  exit 1
fi

# Navigate to n8n directory
cd HomeAMA/deployment >> $LOG_FILE 2>&1

# Create .env file
echo "Creating .env file..." >> $LOG_FILE
rm -f .env
cat > .env <<EOL
POSTGRES_USER=n8n
POSTGRES_PASSWORD=password
POSTGRES_DB=n8n

N8N_ENCRYPTION_KEY=super-secret-key
N8N_USER_MANAGEMENT_JWT_SECRET=even-more-secret
EOL
if [ $? -eq 0 ]; then
  echo ".env file created successfully." >> $LOG_FILE
else
  echo "Failed to create .env file." >> $LOG_FILE
  exit 1
fi

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