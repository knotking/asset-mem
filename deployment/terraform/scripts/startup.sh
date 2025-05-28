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

# Create deploy user and add to Docker group if not exists
if ! id "deploy" &>/dev/null; then
    echo "Creating deploy user..." >> $LOG_FILE
    useradd -m -s /bin/bash deploy >> $LOG_FILE 2>&1
    usermod -aG docker deploy >> $LOG_FILE 2>&1
    if [ $? -eq 0 ]; then
        echo "Deploy user created and added to Docker group successfully." >> $LOG_FILE
    else
        echo "Failed to create deploy user or add to Docker group." >> $LOG_FILE
        exit 1
    fi
else
    echo "Deploy user already exists, ensuring Docker group membership..." >> $LOG_FILE
    usermod -aG docker deploy >> $LOG_FILE 2>&1
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
REPO_NAME="HomeApp"

# Fetch the backup bucket from metadata
BACKUP_BUCKET="gs://$(curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/backup-bucket" -H "Metadata-Flavor: Google")"
if [ $? -eq 0 ]; then
  echo "Backup bucket fetched successfully: $BACKUP_BUCKET" >> $LOG_FILE
else
  echo "Failed to fetch backup bucket." >> $LOG_FILE
  exit 1
fi

# Define backup paths
BACKUP_DIR="/tmp/volume-backups"
TRAEFIK_BACKUP_DIR="/tmp/traefik-backup"
VOLUME_PATH="/var/lib/docker/volumes"  # Add the missing VOLUME_PATH variable

# Create backup directories
mkdir -p $BACKUP_DIR $TRAEFIK_BACKUP_DIR >> $LOG_FILE 2>&1

# Download volume backups from GCS
echo "Downloading volume backups from GCS..." >> $LOG_FILE
if gsutil -q ls "${BACKUP_BUCKET}/${ENVIRONMENT}/volumes/" &>/dev/null; then
  gsutil -m cp -r "${BACKUP_BUCKET}/${ENVIRONMENT}/volumes/$(echo $REPO_NAME | tr '[:upper:]' '[:lower:]')*" $BACKUP_DIR/ >> $LOG_FILE 2>&1
  echo "Volume backups downloaded successfully." >> $LOG_FILE
else
  echo "No volume backups found in bucket ${BACKUP_BUCKET}/${ENVIRONMENT}/volumes/" >> $LOG_FILE
fi

# Download Traefik acme.json from GCS
echo "Downloading Traefik acme.json from GCS..." >> $LOG_FILE
if gsutil -q ls "${BACKUP_BUCKET}/${ENVIRONMENT}/traefik/acme.json" &>/dev/null; then
  gsutil cp "${BACKUP_BUCKET}/${ENVIRONMENT}/traefik/acme.json" $TRAEFIK_BACKUP_DIR/acme.json >> $LOG_FILE 2>&1
  echo "Traefik acme.json downloaded successfully." >> $LOG_FILE
else
  echo "No acme.json found in bucket ${BACKUP_BUCKET}/${ENVIRONMENT}/traefik/" >> $LOG_FILE
fi

# Execute commands as deploy user
echo "Executing commands as deploy user..." >> $LOG_FILE
sudo -u deploy bash <<EOF >> $LOG_FILE 2>&1
set -e

# Clone repository
echo "Cloning repository..."
GITHUB_TOKEN=$GITHUB_TOKEN
cd /home/deploy
git clone https://$GITHUB_TOKEN@github.com/HomeGeekAI/$REPO_NAME.git

# Copy environment file
echo "Copying environment file..."
cd /home/deploy/$REPO_NAME
cp .env.$ENVIRONMENT .env

# Change permissions for acme.json
echo "Changing permissions for acme.json..."
cd /home/deploy/$REPO_NAME/traefik
chmod 600 acme.json

# Create Traefik directory and restore acme.json if backup exists
echo "Setting up Traefik configuration..."
cd /home/deploy/$REPO_NAME
mkdir -p traefik
if [ -f "$TRAEFIK_BACKUP_DIR/acme.json" ]; then
  cp $TRAEFIK_BACKUP_DIR/acme.json traefik/acme.json
  chmod 600 traefik/acme.json
  echo "Restored acme.json from backup" >> $LOG_FILE
else
  touch traefik/acme.json
  chmod 600 traefik/acme.json
  echo "Created new acme.json file" >> $LOG_FILE
fi

# Restore volumes if backups exist
if [ -d "$BACKUP_DIR" ] && [ "\$(ls -A $BACKUP_DIR)" ]; then
  echo "Restoring Docker volumes..."
  for volume_backup in $BACKUP_DIR/*; do
    if [ -f "\$volume_backup" ]; then
      volume_name=\$(basename "\$volume_backup" .tar.gz)
      docker volume create "\$volume_name" >> $LOG_FILE 2>&1
      tar xzf "\$volume_backup" -C $VOLUME_PATH >> $LOG_FILE 2>&1
      echo "Restored volume: \$volume_name" >> $LOG_FILE
    fi
  done
fi

# Start Docker Compose
echo "Starting Docker Compose..."
cd /home/deploy/$REPO_NAME
docker-compose -f docker-compose.yml up -d
EOF

# Cleanup backup directories
rm -rf $BACKUP_DIR $TRAEFIK_BACKUP_DIR >> $LOG_FILE 2>&1

if [ $? -eq 0 ]; then
  echo "All commands executed successfully as deploy user." >> $LOG_FILE
else
  echo "Failed to execute commands as deploy user." >> $LOG_FILE
  exit 1
fi

echo "Startup script execution completed at $(date)" >> $LOG_FILE