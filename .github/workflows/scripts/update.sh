# scripts/update.sh
#!/bin/bash
set -e
LOG_FILE="/home/deploy/update.log"
ENVIRONMENT="$1"  # Pass environment as an argument

echo "Update script execution started at $(date)" >> "$LOG_FILE"
echo "Checking for updates..." >> "$LOG_FILE"
cd /home/deploy/HomeAMA
git fetch origin main >> "$LOG_FILE" 2>&1
if git diff origin/main --quiet; then
  echo "Repository is already up-to-date. No action needed." >> "$LOG_FILE"
  echo "Update script execution completed at $(date)" >> "$LOG_FILE"
  exit 0
fi
echo "Pulling latest changes from repository..." >> "$LOG_FILE"
rm -f .env
git pull origin main >> "$LOG_FILE" 2>&1 || { echo "Failed to update repository." >> "$LOG_FILE"; exit 1; }
cp ".env.$ENVIRONMENT" .env || { echo "Failed to copy .env file." >> "$LOG_FILE"; exit 1; }
echo "Restarting Docker Compose..." >> "$LOG_FILE"
docker-compose down >> "$LOG_FILE" 2>&1
docker-compose up -d >> "$LOG_FILE" 2>&1 || { echo "Failed to restart Docker Compose." >> "$LOG_FILE"; exit 1; }
echo "Update script execution completed at $(date)" >> "$LOG_FILE"