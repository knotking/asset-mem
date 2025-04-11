FROM python:3.9-slim

WORKDIR /app

# Copy requirements.txt and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Copy the rest of the application code
RUN apt-get update && apt-get install python3-opencv -y --no-install-recommends
COPY . .
