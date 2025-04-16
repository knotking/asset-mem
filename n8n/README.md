# 🧠 High-Level Descriptions of n8n Workflows

---

## 1. 📝 Document Analysis Workflow

**Purpose:**  
Process uploaded home inspection PDF reports via Telegram, extract defects, and generate a structured risk assessment report.

**Key Steps:**
- User sends a PDF document on Telegram.
- Deletes any existing entries in the Qdrant vector store for that user/file.
- Loads and splits the document into text chunks.
- Generates vector embeddings (OpenAI) and stores them in Qdrant.
- Each chunk is analyzed using a structured LLM prompt to extract inspection issues.
- Aggregates issues, calculates severity scores, and classifies overall risk (High, Medium, Low).
- Stores results in a PostgreSQL database.
- Responds with the summary report in text and CSV via Telegram.
- Chat with Store results in PostgreSQL or stored inspection document in Qdrant Vector Store

---

## 2. 🖼️ Image Analysis Workflow

**Purpose:**  
Analyze individual inspection images to identify visible problems and return annotated images with detailed findings.

**Key Steps:**
- User sends an image via Telegram.
- Sends a prompt with the image to OpenAI’s vision model using a structured format.
- The AI extracts:
  - Problem areas (e.g., leaks, cracks)
  - Classification (Civil, Electrical, Plumbing, etc.)
  - Estimated size, severity rating, repair cost
  - Bounding box coordinates for affected areas
- Annotated image is generated using an external API.
- Final output (report + image) is sent back to the user on Telegram.

---

## 3. 🎥 Video Analysis Workflow

**Purpose:**  
Allow users to send a video, extract key frames, and analyze each frame as if it were a standalone image to report home inspection issues.

**Key Steps:**
- User uploads a video via Telegram.
- Frames are extracted from the video using a backend API.
- Each frame is split, converted to binary, and passed to OpenAI with a prompt for visual analysis.
- Each frame's output includes identified issues, bounding boxes, and repair estimates.
- Images are annotated using metadata + API.
- Results are formatted and sent to the user as annotated photos with captions.

---
