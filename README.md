# HomeAMA

Following are the components which are used to achieve this POC.

1. ngrok - Creates a tunnel to your localhost to enable your server to be connected
   to internet
2. n8n - Workflow automation tool
3. postgres - Storage for n8n as well as home information summaries
4. qdrant - Vector Database
5. Ollama - To run local embeddings server. This will be replace by OpenAI embeddings
6. Fast API server - Python based api server to classify documents with the help
   of pretrained local ML models.

## Step 1

```
brew install ngrok
Got to https://dashboard.ngrok.com/domains. Create a default domain.
Set the the domain name to ./n8n/docker-compose.yml -> WEBHOOK_URL
This configuration will be used for Telegram Bot Setup.
Run ngrok so that it points the messages to n8n instance.
For example: ngrok http --url=https://funky-frankly-stingray.ngrok-free.app 5678
```

## Step 2

```
cd n8n
Install n8n by following the instructions in n8n/README.md
```

## Step 3

```
cd python
Create virtual environment and follow the instructions in python/README.md
```

## Step 4

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

## Step 5 (Optional)

If OpenAI is not configured, then install Ollama locally by following the instructions at https://ollama.com/
Use llama3.2 as the model.

## Step 6

Go to http://localhost:5678. Click on the workflow HomeAMAPoC

For the following nodes in n8n, configure credentials on the node

1. Telegram - Copy the bot token and create credentials for the Telegram node in n8n node
2. Postgres - Configure host->postgres, database->n8n, user->root, password->password
3. Groq - Configure API access token at https://groq.com/

## ToDo

Configure OpenAI embeddings and Chat Model in n8n workflow
