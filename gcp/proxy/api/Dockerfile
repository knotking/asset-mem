# Use the official Python image as a base
FROM python:3.13.5-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Expose the port that the container will listen on
# Cloud Run injects the PORT environment variable, usually 8080
EXPOSE 8080

# Command to run the application using Uvicorn
# Use PORT environment variable provided by Cloud Run (defaults to 8080 if not set)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]