from fastapi import FastAPI, UploadFile, Form
from pydantic import BaseModel
from model.Model import ModelHandler  # Now Python can find the model package
from media.ImageAnalysis import ImageAnalyzer
from media.VideoAnalysis import VideoAnalyzer
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

@app.post("/annotate_image")
async def annotate_image(file: UploadFile, metadata: str = Form(...)):
    print('REQUEST:', file, metadata)
    image_analyser = ImageAnalyzer(file)
    result = await image_analyser.annotate_image(metadata)
    print('REsult:', result)
    return result

@app.post("/extract_frames")
async def upload_video(file: UploadFile):
    video_analyzer = await VideoAnalyzer.create(file)
    result = video_analyzer.process_video()
    return result

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Property Risk Analysis API is running!"}

