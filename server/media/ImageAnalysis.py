import io
import json
import cv2
import numpy as np
from PIL import Image
from fastapi import UploadFile, File, Response
from fastapi.responses import JSONResponse
import os

class ImageAnalyzer:
    def __init__(self, file: UploadFile = File(...)):
        self.image = file 

    async def annotate_image(self, metadata):
        try:
            # Read image
            image_bytes = await self.image.read()
            image = Image.open(io.BytesIO(image_bytes))
        
            data = json.loads(metadata)

            # Extract bounding boxes
            problem_areas = data.get("Bounding Box Coordinates")
            print('Problem areas:', problem_areas)
            # Convert PIL image to OpenCV format
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Apply OpenCV-based contour detection for refining bounding boxes
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(blurred, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # for area in problem_areas:
            #     x1, y1, x2, y2 = area["x1"], area["y1"], area["x2"], area["y2"]
            #     cv2.rectangle(cv_image, (x1, y1), (x2, y2), (0, 0, 255), 2)
            
            # Overlay OpenCV-detected problem areas
            cv2.drawContours(cv_image, contours, -1, (255, 0, 0), 2)
            
            # Convert back to PIL Image
            highlighted_image = Image.fromarray(cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB))
            highlighted_image_data = io.BytesIO()
            highlighted_image.save(highlighted_image_data, format='PNG')
            highlighted_image_data.seek(0)
            
            return Response(content=highlighted_image_data.getvalue(), media_type="image/png")
        
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": str(e)})
