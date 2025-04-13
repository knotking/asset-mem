# N8N self host

### What’s included

✅ [**Self-hosted n8n**](https://n8n.io/) 

✅ [**Qdrant**](https://qdrant.tech/) 

✅ [**PostgreSQL**](https://www.postgresql.org/) 

✅ Python FastAPI Server for CV processing 

## Installation

- ### For Mac / Apple Silicon users

```
docker compose pull
docker compose create && docker compose up -d
```

## Tips & tricks

.env - Contains secrets that are injected into the docker container

Qdrant - Dashboard http://localhost:6333/dashboard#/console

Postgres - Install pgAdmin. Connect using the credentials in .env
