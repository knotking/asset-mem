import cv2
import numpy as np
import tempfile
import os
from skimage.metrics import structural_similarity as ssim
from fastapi.responses import JSONResponse
from fastapi import Response  # Import Response for binary data
import base64

class VideoAnalyzer:
    def __init__(self, video_path, threshold=0.5):
        """Initialize the VideoAnalyzer with a binary video file and threshold."""
        self.threshold = threshold
        self.saved_count = 0
        self.scene_changed = False
        print("Video file:", video_path)
        # Create a temporary file to store the binary video data
        self.video_path =  video_path

    @classmethod
    async def create(cls, video_file, threshold=0.5):
        """Asynchronously create an instance of VideoAnalyzer."""
        instance = cls(video_file, threshold)  # Create an instance
        instance.video_path = await instance._create_temp_video_file(video_file)  # Await the temp file creation
        return instance
    
    async def _create_temp_video_file(self, video_file):
        """Create a temporary file from the binary video data."""
        file_suffix = os.path.splitext(video_file.filename)[1]  # Extract the suffix from the original file name
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_suffix)
        temp_file.write(await video_file.read())
        temp_file.close()
        print("Temp File:", temp_file)
        return temp_file.name
    
    def is_significant_change(self, frame1, frame2):
        """Determine if there is a significant change between two frames."""
        # Convert frames to grayscale
        gray1 = cv2.cvtColor(frame1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(frame2, cv2.COLOR_BGR2GRAY)

        # Compute SSIM between the two frames
        score, _ = ssim(gray1, gray2, full=True)
        return score < self.threshold  # Return True if the change is significant 

    def process_video(self):
        """Process the video to detect significant scene changes and return binary images as FastAPI JSON response."""
        
        # Open video
        print("VIDEO PATH:", self.video_path)
        cap = cv2.VideoCapture(self.video_path)
        ret, prev_frame = cap.read()
        if not ret:
            print("Error: Could not read video.")
            cap.release()
            exit()

        frames_data = []  # List to store binary image data
        while cap.isOpened():
            ret, curr_frame = cap.read()
            if not ret:
                break  # Stop if video ends

            # Check for significant scene change
            if self.is_significant_change(prev_frame, curr_frame):
                self.scene_changed = True  # At least one scene change detected
                # Encode the current frame as a JPEG image in memory
                _, buffer = cv2.imencode('.jpg', curr_frame)  # Encode frame to JPEG
                frames_data.append(buffer.tobytes())  # Append binary data to the list
                self.saved_count += 1

            prev_frame = curr_frame

        cap.release()
        cv2.destroyAllWindows()

        # If no scene change was detected, save only the first frame
        if not self.scene_changed:
            _, buffer = cv2.imencode('.jpg', prev_frame)  # Encode the single frame as JPEG
            frames_data.append(buffer.tobytes())  # Append binary data to the list
            print("Only one scene detected. Saved: single_scene.jpg")
        else:
            print(f"Total unique frames saved: {self.saved_count}")

        # Clean up the temporary video file
        os.remove(self.video_path)

        # Return binary images as FastAPI JSON response
        return JSONResponse(content={"images": [base64.b64encode(image).decode('utf-8') for image in frames_data]})  # Return binary images as base64 strings 