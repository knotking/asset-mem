# HomeGeek

Following are the components which are used to achieve this POC.

1. ngrok - Creates a tunnel to your localhost to enable your server to be connected
   to internet
2. n8n - Workflow automation tool
3. postgres - Storage for n8n as well as home information summaries
4. qdrant - Vector Database
6. Fast API server - Python based api server to do image processing or classify documents with the    
   help of pretrained local ML models.


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

## Step 2

```
brew install ngrok
Got to https://dashboard.ngrok.com/domains. Create a default domain.
Set the the domain name to ./docker-compose.yml -> WEBHOOK_URL
This configuration will be used for Telegram Bot Setup.
Run ngrok so that it points the messages to n8n instance.
For example: ngrok http --url=https://funky-frankly-stingray.ngrok-free.app 5678
```

## Step 3

```
Make sure docker and docker-compose are installed
docker compose up -d
```
## Step 3

Go to http://localhost:5678. Click on the workflow HomeAMADocumentAnalysis

For the following nodes in n8n, configure credentials on the node

1. Telegram - Copy the bot token and create credentials for the Telegram node in n8n node
2. Postgres - Configure host->postgres, database->n8n, user->n8n, password->password

