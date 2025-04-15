# HomeGeek

Following are the components which are used to achieve this POC.

2. n8n - Workflow automation tool
3. postgres - Storage for n8n as well as home information summaries
4. qdrant - Vector Database
6. Fast API server - Python based api server to do image processing or 
   classify documents with the help of pretrained local ML models.


## Step 1

```
Create Telegram Bot
Open Telegram and search for "@BotFather" .
Start a conversation with BotFather .
Use the /newbot command: to create a new bot and follow further instructions.
Configure the Bot to send messages to the webhook that was created with ngrok

    curl -X POST "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{ "url": "{YOUR_WEBHOOK_URL}" }'

```

## Step 3

```
Make sure docker and docker-compose are installed
Follow the instructions in README_LOCAL.md to run it locally.
$ docker compose -f docker-compose.yml -f docker-compose.override.local.yml up -d
```
## Step 3

Go to http://localhost:5678

