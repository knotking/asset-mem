# HomeAMA API Server Guide

This document provides instructions for setting up, training the model, running the API server, and testing it using curl commands. It also includes details on how to use Docker for containerized deployment.

---

## Prerequisites

1. **Python**:
   - Make sure you have Python installed on your machine. You can download it from [python.org](https://www.python.org/downloads/).

2. **Docker (Optional)**:
   - Install Docker if you want to run the API server in a container. You can download it from [docker.com](https://www.docker.com/products/docker-desktop).

---

## Setting Up a Virtual Environment

1. **Create a virtual environment**:
   Open your terminal and navigate to your project directory. Then run:

   ```bash
   python -m venv .venv
   ```

2. **Activate the virtual environment**:
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS and Linux:
     ```bash
     source .venv/bin/activate
     ```

---

## Installation

Once the virtual environment is activated, install the required packages using pip:

```bash
pip install -r requirements.txt
```

---

## Training the Model

To train the model, navigate to the `model` directory and run the training script:

```bash
cd model
python run_training.py
```

---

## Running the API Server

To start the API server, run the following command:

```bash
uvicorn api.app:app --reload
```

The server will be available at `http://localhost:8000`.

---

## Using Docker

### 1. **Build the Docker Image**
To containerize the API server, build a Docker image using the provided `Dockerfile`:

```bash
docker build -t homeama-api .
```

### 2. **Run the Docker Container**
Run the containerized API server:

```bash
docker run -p 8000:8000 homeama-api
```

The server will be accessible at `http://localhost:8000`.

---

## Testing the API Server

### Using Curl
You can test the API server using the following curl command:

```bash
curl -X POST "http://localhost:8000/annotate_image" \
-H "accept: application/json" \
-H "Content-Type: multipart/form-data" \
-F "file=@/Users/prakashbaskaran/projects/test.png" \
-F 'metadata={"coordinates": [{"x1": 10, "y1": 10, "x2": 50, "y2": 50}]}' > annotated.png
```

This command:
- Sends an image (`test.png`) and metadata (bounding box coordinates) to the `/annotate_image` endpoint.
- Saves the annotated image as `annotated.png`.

---

## Notes

1. **Virtual Environment**:
   - Always activate the virtual environment before running Python commands to ensure dependencies are correctly resolved.

2. **Docker**:
   - Using Docker simplifies deployment by containerizing the application and its dependencies.

3. **API Endpoints**:
   - Refer to the API documentation for details on available endpoints and their usage.

For further assistance, contact the project maintainer.