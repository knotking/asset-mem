#!/bin/bash

# ==== CONFIG ====
REPO="prakashbask/HomeAMA"
FOLDER_NAME="HomeAMA"
DOCKER_COMPOSE_FILE="./n8n/docker-compose.yml"
GCS_BUCKET_NAME="homegeekdemo"  # GCS bucket for backups
TAGS="homegeek-demo"

# Exposed ports (adjust as needed)
PORTS=(5678 5432 6333 8000)
# =================

set -e

# echo "🚀 Updating system packages..."
# sudo apt update && sudo apt upgrade -y

# echo "🐳 Installing Docker and Docker Compose..."
# sudo apt install -y docker.io docker-compose

# echo "👤 Adding user to docker group..."
# sudo usermod -aG docker $USER
# # echo "👤 Adding newgrp docker..."
# # newgrp docker
# echo "👤 Docker setup done."

# GITHUB_TOKEN=$(gcloud secrets versions access latest --secret=github-token)
# REPO_URL=https://$GITHUB_TOKEN@github.com/$REPO.git
# ENV=".env"

# # Remove the folder if it already exists
# if [[ -d "$FOLDER_NAME" ]]; then
#   echo "📁 Removing existing folder: $FOLDER_NAME"
#   rm -rf "$FOLDER_NAME"
# fi
# # Clone
# git clone "$REPO_URL"

# cd "$FOLDER_NAME/n8n"

# # Function to create environment variables
# create_env() {
#   cat > "$ENV" <<EOF
# POSTGRES_USER=n8n
# POSTGRES_PASSWORD=password
# POSTGRES_DB=n8n

# N8N_ENCRYPTION_KEY=super-secret-key
# N8N_USER_MANAGEMENT_JWT_SECRET=even-more-secret
# EOF
# }

# echo "Creating Env file..."
# create_env

# echo "🛑 Stopping and removing existing Docker containers..."
# sudo docker ps -q | xargs -r sudo docker stop
# sudo docker ps -aq | xargs -r sudo docker rm

# echo "🚀 Running Docker Compose..."
# sudo docker-compose up -d

# Set up firewall rules
echo "🌐 Setting firewall rules..."
for PORT in "${PORTS[@]}"; do
  sudo gcloud compute firewall-rules create "allow-port-$PORT" \
    --allow=tcp:$PORT --target-tags="$TAGS" --description="Allow port $PORT" --direction=INGRESS --priority=1000 --quiet || true
done

# Tag the VM for firewall rule
VM_NAME=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/name)
ZONE=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/zone | awk -F/ '{print $NF}')
gcloud compute instances add-tags "$VM_NAME" --zone "$ZONE" --tags="$TAGS"
# Set up backup script
# echo "🧠 Creating backup script..."
# BACKUP_SCRIPT="/usr/local/bin/backup_to_gcs.sh"
# sudo tee "$BACKUP_SCRIPT" > /dev/null <<EOF
# #!/bin/bash
# TIMESTAMP=\$(date +%Y%m%d_%H%M%S)

# # Postgres dump
# docker exec \$(docker ps -qf "name=postgres") pg_dump -U postgres -F c postgres > /tmp/postgres_backup_\$TIMESTAMP.dump

# # Qdrant archive
# docker cp \$(docker ps -qf "name=qdrant"):/qdrant/storage /tmp/qdrant_storage_\$TIMESTAMP
# tar czf /tmp/qdrant_backup_\$TIMESTAMP.tar.gz /tmp/qdrant_storage_\$TIMESTAMP

# # Upload to GCS
# gsutil cp /tmp/*.dump gs://$GCS_BUCKET_NAME/backups/postgres/
# gsutil cp /tmp/*.tar.gz gs://$GCS_BUCKET_NAME/backups/qdrant/

# # Clean up
# rm -rf /tmp/qdrant_storage* /tmp/*.tar.gz /tmp/*.dump
# EOF

# sudo chmod +x "$BACKUP_SCRIPT"

# # Setup cron job for daily backup at 2 AM
# echo "🕑 Setting up daily cron job for backup..."
# (crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_SCRIPT") | crontab -

# echo "✅ Setup complete. Stack is running. Backups are automated daily!"
