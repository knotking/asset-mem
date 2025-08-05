# Use the official Python image as a base
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Expose the port that the container will listen on
# Cloud Run injects the PORT environment variable, usually 8080
ENV PORT 8080
EXPOSE $PORT

# Command to run the application using Uvicorn
CMD ["uvicorn", "telegram_api:app", "--host", "0.0.0.0", "--port", "8080"]