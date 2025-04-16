# Local Setup Guide

This guide provides instructions to set up and run the project locally.

---

## Step 1: Install and Configure ngrok

1. Install ngrok using Homebrew:

    ```bash
    brew install ngrok
    ```

2. Go to [ngrok Dashboard](https://dashboard.ngrok.com/domains) and create a default domain.
3. Update `.env.dev` to set the `N8N` domain and subdomain as provided by ngrok. This configuration will be used for the Telegram Bot setup.
4. Run ngrok to forward messages to the n8n instance. For example:

    ```bash
    ngrok http --url=https://funky-frankly-stingray.ngrok-free.app 5678
    ```

---

## Step 2: Set Up the Environment

1. Copy the development environment file:

    ```bash
    cp .env.dev .env
    ```

2. Create the `docker-compose.override.local.yml` file if it does not exist:

    ```bash
    touch docker-compose.override.local.yml
    ```

3. Add the following lines to `docker-compose.override.local.yml` to disable Let's Encrypt lookup (used only for local testing):

    ```yaml
    services:
      traefik:
        profiles:
          - disabled
      n8n:
        # Explicitly clear all labels for the n8n service
        labels:
          - "traefik.enable=false"
          - "traefik.http.routers.n8n.tls.certresolver="
    ```

---

## Tips & Tricks

- **`.env`**: Contains secrets that are injected into the Docker container.
- **Qdrant Dashboard**: Access the Qdrant dashboard at [http://localhost:6333/dashboard#/console](http://localhost:6333/dashboard#/console).
- **Postgres**: Install pgAdmin and connect using the credentials specified in `.env`.

---

For further assistance, refer to the main `README.md` file.