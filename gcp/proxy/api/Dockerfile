# Local Docker only: run `cp -R ../../common ./common` from this directory first, or use
# Cloud Run build from repo root: `docker build -f gcp/Dockerfile.proxy gcp` (see gcp/Dockerfile.proxy).
FROM python:3.13.5-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the port that the container will listen on
ENV PORT 8080
EXPOSE $PORT

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
