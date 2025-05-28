#!/bin/bash
set -e

# Create backup directory
mkdir -p /tmp/backups

# Backup Docker volumes
VOLUMES_EXIST=false
docker volume ls -q | while read volume; do
    VOLUMES_EXIST=true
    docker run --rm \
        -v "$volume":/data \
        -v /tmp/backups:/backup \
        ubuntu \
        tar -czf "/backup/${volume}.tar.gz" -C /data .
done

# Backup acme.json if it exists
if [ -f /home/deploy/HomeApp/traefik/acme.json ]; then
    cp /home/deploy/HomeApp/traefik/acme.json /tmp/backups/acme.json
    chmod 644 /tmp/backups/acme.json
fi

# Upload backups to GCS
if [ -n "$(ls -A /tmp/backups/*.tar.gz 2>/dev/null)" ]; then
    echo 'Uploading volume backups to GCS...'
    gsutil -m cp /tmp/backups/*.tar.gz "gs://$1/$2/volumes/"
else
    echo 'No volume backups to upload'
fi

# Upload acme.json if it exists
if [ -f /tmp/backups/acme.json ]; then
    echo 'Uploading acme.json to GCS...'
    gsutil cp /tmp/backups/acme.json "gs://$1/$2/traefik/"
else
    echo 'No acme.json to upload'
fi

# Cleanup
rm -rf /tmp/backups