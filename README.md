# HomeGeek

This project demonstrates a Proof of Concept (POC) using the following components:

1. **n8n** - Workflow automation tool.
2. **Postgres** - Database for storing n8n workflows and home information summaries.
3. **Qdrant** - Vector database.
4. **FastAPI Server** - Python-based API server for image processing, video frames extraction and document classification using pretrained local ML models.

---

## Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`.
2. Start a conversation with `BotFather`.
3. Use the `/newbot` command to create a new bot and follow the instructions.
4. Configure the bot to send messages to the webhook created with ngrok:

    ```bash
    curl -X POST "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{ "url": "{YOUR_WEBHOOK_URL}" }'
    ```

---

## Step 2: Set Up the Environment

1. Ensure Docker and Docker Compose are installed on your system.
2. Follow the instructions in `README_LOCAL.md` to run the project locally.
3. Start the services using the following command:

    ```bash
    docker compose -f docker-compose.yml -f docker-compose.override.local.yml up -d
    ```

---

## Step 3: Access the Application

1. Open your browser and navigate to [http://localhost:5678](http://localhost:5678).

---

For more details, refer to the documentation in `README_LOCAL.md`.