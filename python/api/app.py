import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))  # Add parent directory to path


from fastapi import FastAPI
from pydantic import BaseModel
from model.Model import ModelHandler  # Now Python can find the model package

# Initialize FastAPI app
app = FastAPI()


# Define request format
class TextRequest(BaseModel):
    text: str
    model: str

# Define API endpoint
@app.post("/classify")
async def classify(request: TextRequest):
    # Initialize model handler
    print('REQUEST:', request)
    model_handler = ModelHandler(request.model)
    result = model_handler.classify_document(request.text)
    return result

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Property Risk Analysis API is running!"}

