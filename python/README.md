## Prerequisites

Make sure you have Python installed on your machine. You can download it from [python.org](https://www.python.org/downloads/).

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

## Installation

Once the virtual environment is activated, install the required packages using pip:

```bash
pip install -r requirements.txt
```

## Training the model

```
cd model
python run_training.py
```

## Running the API server

```
uvicorn api.app:app --reload
```

## Curl commands to test

```
curl -X POST "http://localhost:8000/annotate_image" \
-H "accept: application/json" \
-H "Content-Type: multipart/form-data" \
-F "file=@/Users/prakashbaskaran/projects/test.png" \
-F 'metadata={"coordinates": [{"x1": 10, "y1": 10, "x2": 50, "y2": 50}]}' > annotated.png
```
