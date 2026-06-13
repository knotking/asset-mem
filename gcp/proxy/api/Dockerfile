# Local Docker only: stage shared packages before build:
#   cp -R ../../common ./common
#   bash ../scripts/stage-agent-platform-for-proxy.sh
# Or from repo root: `docker build -f gcp/Dockerfile.proxy gcp`
FROM python:3.13.5-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the port that the container will listen on
ENV PORT 8080
EXPOSE $PORT

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
