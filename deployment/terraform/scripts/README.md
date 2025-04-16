# Startup Script Guide

This document provides an overview of the `startup.sh` script, its purpose, and how to use it. It is triggered as part of terraform deployment during creation of VM.

---

## Overview

The `startup.sh` script is designed to automate the initialization and setup of a cloud instance for running the `HomeAMA` application. It performs the following tasks:

1. Fetches the deployment environment from the instance metadata.
2. Installs Docker and Docker Compose.
3. Creates a `deploy` user and grants it Docker permissions.
4. Fetches a GitHub token from Google Cloud Secret Manager.
5. Clones the `HomeAMA` repository and sets up the environment.
6. Starts the application using Docker Compose.

---

## Prerequisites

Before running the script, ensure the following:

1. **Instance Metadata**:
   - The instance must have an `environment` attribute set in its metadata (e.g., `demo`, `staging`, `prod`).

2. **Google Cloud Secret Manager**:
   - A secret named `github-token` must exist in Google Cloud Secret Manager, containing a valid GitHub personal access token.

3. **Permissions**:
   - The script requires root privileges to install software and manage users.

4. **Repository Configuration**:
   - The `HomeAMA` repository must have environment-specific `.env` files (e.g., `.env.demo`, `.env.staging`, `.env.prod`).

---

## Script Workflow

### 1. Fetch Environment Variable
The script retrieves the `environment` value from the instance metadata using the following command:
```bash
curl -s "http://metadata.google.internal/computeMetadata/v1/instance/attributes/environment" -H "Metadata-Flavor: Google"
```

### 2. Install Docker and Docker Compose
The script installs Docker and Docker Compose using `apt-get`:
```bash
apt-get update
apt-get install -y docker.io docker-compose
```

### 3. Create Deploy User
A `deploy` user is created and added to the Docker group:
```bash
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
```

### 4. Fetch GitHub Token
The script retrieves the GitHub token from Google Cloud Secret Manager:
```bash
gcloud secrets versions access latest --secret=github-token
```

### 5. Clone Repository and Set Up Environment
The script clones the `HomeAMA` repository and sets up the environment:
```bash
git clone https://$GITHUB_TOKEN@github.com/prakashbask/HomeAMA.git
cp .env.$ENVIRONMENT .env
```

### 6. Start Docker Compose
The script starts the application using Docker Compose:
```bash
docker-compose -f docker-compose.yml up -d
```

---

## Usage

### Running the Script
To execute the script, run the following command as root:
```bash
bash startup.sh
```

### Logs
The script logs all operations to `/var/log/startup_script.log`. You can view the log file for debugging:
```bash
cat /var/log/startup_script.log
```

---

## Error Handling

The script uses `set -e` to terminate on any error. Key error scenarios include:
1. Failure to fetch the `environment` variable from metadata.
2. Failure to install Docker or Docker Compose.
3. Failure to fetch the GitHub token from Secret Manager.
4. Failure to clone the repository or start Docker Compose.

Check the log file (`/var/log/startup_script.log`) for detailed error messages.

---

## Customization

You can customize the script by modifying the following:
1. **Environment Metadata**:
   - Update the metadata URL if using a different cloud provider.
2. **Secrets**:
   - Replace `gcloud` commands with equivalent commands for other secret managers.
3. **Repository**:
   - Update the repository URL and branch if needed.

---

## Example Log Output

```plaintext
Startup script execution started at Tue Apr 15 10:00:00 UTC 2025
Fetching environment variable from metadata...
Environment variable fetched successfully: staging
Installing Docker and Docker Compose...
Docker and Docker Compose installed successfully.
Deploy user created and added to Docker group successfully.
Fetching GitHub token from Secret Manager...
GitHub token fetched successfully.
Executing commands as deploy user...
Cloning repository...
Copying environment file...
Changing permissions for acme.json...
Starting Docker Compose...
All commands executed successfully as deploy user.
Startup script execution completed at Tue Apr 15 10:05:00 UTC 2025
```

---

## Notes

- Ensure the instance has internet access to fetch dependencies and clone the repository.
- The script assumes the use of Google Cloud Platform (GCP). Modify it as needed for other cloud providers.

For further assistance, contact the project maintainer.