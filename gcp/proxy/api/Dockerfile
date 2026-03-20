# Use the official Python image as a base
# Build context must include `common/` next to this Dockerfile (see README: CI copies gcp/common → ./common).
FROM python:3.13.5-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the port that the container will listen on
ENV PORT 8080
EXPOSE $PORT

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
