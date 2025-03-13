# N8N self host

### What’s included

✅ [**Self-hosted n8n**](https://n8n.io/) - Low-code platform with over 400
integrations and advanced AI components

✅ [**Qdrant**](https://qdrant.tech/) - Open-source, high performance vector
store with an comprehensive API

✅ [**PostgreSQL**](https://www.postgresql.org/) - Workhorse of the Data
Engineering world, handles large amounts of data safely.

## Installation

- ### For Mac / Apple Silicon users

```
docker compose pull
docker compose create && docker compose up -d
```

##### For Mac users running OLLAMA locally

If you're running OLLAMA locally on your Mac (not in Docker), you need to modify the OLLAMA_HOST environment variable
in the n8n service configuration. Update the x-n8n section in your Docker Compose file as follows:

```yaml
x-n8n: &service-n8n # ... other configurations ...
  environment:
    # ... other environment variables ...
    - OLLAMA_HOST=host.docker.internal:11434
```

Additionally, after you see "Editor is now accessible via: <http://localhost:5678/>":

1. Head to <http://localhost:5678/home/credentials>
2. Click on "Local Ollama service"
3. Change the base URL to "http://host.docker.internal:11434/"

## Quick start and usage

After completing the installation steps above, simply follow the steps below to get started.

1. Open <http://localhost:5678/> in your browser to set up n8n.
2. Open the included workflow:
   <http://localhost:5678/workflow/KOVfWXXl1byYtlCh>
3. Click the **Test Workflow** button at the bottom of the canvas, to start running the workflow.

## Tips & tricks

.env - Contains secrets that are injected into the docker container

Qdrant - Dashboard http://localhost:6333/dashboard#/console

Postgres - Install pgAdmin. Connect using the credentials in .env
