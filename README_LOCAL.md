
## Step 1

```
brew install ngrok
Got to https://dashboard.ngrok.com/domains. Create a default domain.
Update .env.dev to point the N8N domain and subdomain as given by ngrok
This configuration will be used for Telegram Bot Setup.
Run ngrok so that it points the messages to n8n instance.
For example: ngrok http --url=https://funky-frankly-stingray.ngrok-free.app 5678
```

## Step 2
```
1) cp .env.dev .env
2) Create docker-compose.override.local.yml if not available
$ touch docker-compose.override.local.yml
Add the following lines to disable the looking up letsencrypt
# used only in local testing
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

## Tips & tricks

.env - Contains secrets that are injected into the docker container

Qdrant - Dashboard http://localhost:6333/dashboard#/console

Postgres - Install pgAdmin. Connect using the credentials in .env
